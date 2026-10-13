"""
Billing domain services: compute_invoice_totals (BR-02/BR-03) and send_invoice with select_for_update sequence lock.
"""

from decimal import Decimal
from django.db import transaction # type: ignore[assignment]
from apps.core.utils import quantize_money, fiscal_year_for
from apps.billing.models import Invoice, InvoiceSequence
from datetime import timedelta
from apps.core.exceptions import DomainError, InvoiceStateError, PaymentValidationError
from django.utils import timezone # type: ignore[assignment]
from apps.billing.models import TimeEntry, InvoiceItem, Payment
from apps.clients.models import Client

def compute_invoice_totals(invoice: Invoice) -> Invoice:
    """
    Compute and update subtotals, tax, and grand totals for an invoice (BR-02/BR-03).

    Quantization Rule (BR-02/BR-03):
    - Quantize each line item subtotal (quantity * unit_price) once using ROUND_HALF_UP.
    - Sum all line item subtotals to determine invoice subtotal.
    - Calculate tax_amount = quantize_money(subtotal * (tax_rate / 100)).
    - Total amount = quantize_money(subtotal + tax_amount).

    Args:
        invoice: Target Invoice instance.

    Returns:
        Invoice: The updated and saved Invoice instance.
    """
    running_subtotal = Decimal('0.00')
    
    # Iterate line items, quantize line subtotals, and accumulate running subtotal
    for item in invoice.items.all():# type: ignore[assignment]
        line_subtotal = quantize_money(item.quantity * item.unit_price)
        if item.subtotal != line_subtotal:
            item.subtotal = line_subtotal
            item.save(update_fields=['subtotal'])
        running_subtotal += item.subtotal

    invoice.subtotal = quantize_money(running_subtotal)# type: ignore[assignment]
    invoice.tax_amount = quantize_money(invoice.subtotal * (invoice.tax_rate / Decimal('100')))# type: ignore[assignment]
    invoice.total_amount = quantize_money(invoice.subtotal + invoice.tax_amount)# type: ignore[assignment]
    invoice.save(update_fields=['subtotal', 'tax_amount', 'total_amount'])
    
    return invoice


@transaction.atomic
def send_invoice(invoice: Invoice) -> Invoice:
    """
    Transition invoice status from DRAFT to SENT and assign an auto-incremented invoice number.

    Concurrency & Row Lock Mechanism (select_for_update):
    - Uses select_for_update() to acquire an exclusive row lock on the InvoiceSequence record for (owner, fiscal_year).
    - Why inside transaction.atomic: MySQL InnoDB requires select_for_update() to run inside an active database transaction. Without atomic, InnoDB releases the lock immediately.
    - Why lock InvoiceSequence row instead of Invoice table: Locking InvoiceSequence locks only 1 small row per user/fiscal_year, allowing concurrent invoice creation across different users without database table contention or race conditions.

    Args:
        invoice: Draft Invoice instance to send.

    Returns:
        Invoice: Sent invoice instance with updated status and number.
    """
    # 1. First ensure totals are accurate
    compute_invoice_totals(invoice)

    # 2. Determine fiscal year from issue_date
    fy = fiscal_year_for(invoice.issue_date)# type: ignore[assignment]

    # 3. Acquire exclusive row lock on sequence for this owner & fiscal year
    sequence, created = InvoiceSequence.objects.select_for_update().get_or_create(# type: ignore[assignment]
        owner=invoice.owner,
        fiscal_year=fy,
        defaults={'last_number': 0}
    )

    # 4. Increment sequence number atomically
    sequence.last_number += 1
    sequence.save(update_fields=['last_number'])

    # 5. Format invoice number (e.g. INV-FY2026-27-0001) and update status
    invoice.number = f"INV-FY{fy}-{sequence.last_number:04d}"# type: ignore[assignment]
    invoice.status = Invoice.Status.SENT# type: ignore[assignment]
    invoice.save(update_fields=['number', 'status'])

    return invoice

@transaction.atomic
def create_invoice_from_time(
    owner,
    client: Client,
    date_from,
    date_to,
    project_ids: list[int] | None = None,
    tax_rate: Decimal = Decimal('0.00')
) -> Invoice:
    """Create a draft invoice grouping unbilled hourly entries by project atomically (US-09).

    Args:
        owner: Authenticated user.
        client: Client instance to invoice.
        date_from: Start of the date filter.
        date_to: End of the date filter.
        project_ids: Optional list of project IDs to restrict to.
        tax_rate: Tax percentage to apply.

    Returns:
        Invoice: Newly created draft Invoice with populated items.

    Raises:
        DomainError: If no unbilled entries exist, or projects have mixed currencies.
    """
    entries_qs = TimeEntry.objects.select_for_update().filter(
        owner=owner,
        project__client=client,
        project__billing_type='hourly',
        is_billed=False,
        date__gte=date_from,
        date__lte=date_to,
    )
    if project_ids:
        entries_qs = entries_qs.filter(project_id__in=project_ids)

    if not entries_qs.exists():
        raise DomainError("No unbilled time entries found in the specified range.")

    currencies = set(entries_qs.values_list('project__currency', flat=True))
    if len(currencies) > 1:
        raise DomainError("Projects in the range must share a single currency.")

    invoice = Invoice.objects.create(
        owner=owner,
        client=client,
        issue_date=timezone.localdate(),
        due_date=timezone.localdate() + timedelta(days=14),
        tax_rate=tax_rate,
        status=Invoice.Status.DRAFT,
    )

    project_groups: dict[int, dict] = {}
    for entry in entries_qs:
        pid = entry.project_id
        if pid not in project_groups:
            project_groups[pid] = {
                'project': entry.project,
                'hours': Decimal('0.00'),
            }
        project_groups[pid]['hours'] += entry.hours

    for p_data in project_groups.values():
        proj = p_data['project']
        hrs = p_data['hours']
        rate = proj.hourly_rate or Decimal('0.00')
        subtotal = quantize_money(hrs * rate)
        InvoiceItem.objects.create( # type: ignore[assignment]
            invoice=invoice,
            description=f"{proj.name} - Logged Time ({hrs} hrs @ {rate})",
            quantity=hrs,
            unit_price=rate,
            subtotal=subtotal,
        )


    entries_qs.update(is_billed=True, invoice=invoice)

    return compute_invoice_totals(invoice)


@transaction.atomic
def void_invoice(invoice: Invoice) -> Invoice:
    """Transition invoice to VOID and release associated time entries (US-12).

    Args:
        invoice: The invoice to void.

    Returns:
        Invoice: Voided invoice instance.

    Raises:
        InvoiceStateError: If invoice is not SENT or already has payments recorded.
    """
    invoice = Invoice.objects.select_for_update().get(pk=invoice.pk)

    if invoice.status != Invoice.Status.SENT:
        raise InvoiceStateError("Only SENT invoices can be voided.")
    if invoice.payments.exists():
        raise InvoiceStateError("Cannot void an invoice that has payments recorded.")

    invoice.time_entries.update(is_billed=False, invoice=None)

    invoice.status = Invoice.Status.VOID # type: ignore[assignment]
    invoice.save(update_fields=['status'])
    return invoice


@transaction.atomic
def record_payment(invoice: Invoice, payment_data: dict) -> Payment:
    """Record payment, validate business rules (BR-11, BR-12), and update invoice status.

    Args:
        invoice: The invoice being paid.
        payment_data: Dictionary containing amount_applied, fee_amount, received_bdt, etc.

    Returns:
        Payment: Created Payment instance.

    Raises:
        PaymentValidationError: If rules (status, overpayment, fees) are violated.
    """
    invoice = Invoice.objects.select_for_update().get(pk=invoice.pk)

    if invoice.status not in [Invoice.Status.SENT, Invoice.Status.PARTIALLY_PAID]:# type: ignore[assignment]
        raise PaymentValidationError("Payments can only be recorded on SENT or PARTIALLY_PAID invoices.")

    amount_applied = Decimal(str(payment_data['amount_applied']))
    balance_due = invoice.total_amount - invoice.paid_amount # type: ignore[assignment]

    if amount_applied <= 0:
        raise PaymentValidationError("Payment amount must be greater than 0.")
    if amount_applied > balance_due:
        raise PaymentValidationError(f"Payment amount ({amount_applied}) exceeds balance due ({balance_due}).")

    fee_amount = Decimal(str(payment_data.get('fee_amount', '0.00')))
    if fee_amount < 0 or fee_amount >= amount_applied:
        raise PaymentValidationError("Fee must be non-negative and strictly less than the applied amount.")

    received_bdt = Decimal(str(payment_data['received_bdt']))
    if received_bdt <= 0:
        raise PaymentValidationError("Received BDT must be greater than 0.")

    if invoice.client.default_currency == 'BDT':
        expected_bdt = quantize_money(amount_applied - fee_amount)
        if received_bdt != expected_bdt:
            raise PaymentValidationError(f"For BDT invoices, received BDT must equal applied amount minus fees ({expected_bdt}).")

    payment = Payment.objects.create( # type: ignore[assignment]
        invoice=invoice,
        amount_applied=amount_applied,
        fee_amount=fee_amount,
        received_bdt=received_bdt,
        method=payment_data.get('method', 'bank_transfer'),
        paid_on=payment_data.get('paid_on', timezone.localdate()),
        reference=payment_data.get('reference', ''),
    )

    invoice.paid_amount = quantize_money(invoice.paid_amount + amount_applied)# type: ignore[assignment]
    if invoice.paid_amount == invoice.total_amount:
        invoice.status = Invoice.Status.PAID # type: ignore[assignment]
    else:
        invoice.status = Invoice.Status.PARTIALLY_PAID # type: ignore[assignment]
    invoice.save(update_fields=['paid_amount', 'status'])
    try:
        from apps.notifications.models import Notification
        Notification.objects.create( # type: ignore[assignment]
            user=invoice.owner,
            kind=Notification.Kind.PAYMENT_RECEIVED,
            message=f"Received payment of {amount_applied} for invoice {invoice.number or invoice.id}.",# type: ignore[assignment]
            invoice=invoice,
            dedupe_key=f"payment:{payment.id}",
        )
    except Exception:
        pass  # Keep notification resilient if notifications app isn't ready

    return payment


@transaction.atomic
def delete_payment(payment: Payment) -> Invoice:
    """Delete a payment and recompute invoice balance and status (US-16).

    Args:
        payment: The Payment to remove.

    Returns:
        Invoice: The invoice with recomputed paid_amount and status.
    """
    invoice = Invoice.objects.select_for_update().get(pk=payment.invoice_id)# type: ignore[assignment]
    payment.delete()

    total_paid = sum((p.amount_applied for p in invoice.payments.all()), Decimal('0.00'))
    invoice.paid_amount = quantize_money(total_paid)

    if invoice.paid_amount == Decimal('0.00'):
        invoice.status = Invoice.Status.SENT
    elif invoice.paid_amount < invoice.total_amount:
        invoice.status = Invoice.Status.PARTIALLY_PAID# type: ignore[assignment]
    else:
        invoice.status = Invoice.Status.PAID

    invoice.save(update_fields=['paid_amount', 'status'])
    return invoice

