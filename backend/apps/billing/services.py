"""
Billing domain services: compute_invoice_totals (BR-02/BR-03) and send_invoice with select_for_update sequence lock.
"""

from decimal import Decimal
from django.db import transaction # type: ignore[assignment]
from apps.core.utils import quantize_money, fiscal_year_for
from apps.billing.models import Invoice, InvoiceSequence


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

    # 5. Format invoice number (e.g. INV-2025-26-001) and update status
    invoice.number = f"INV-{fy}-{sequence.last_number:03d}"# type: ignore[assignment]
    invoice.status = Invoice.Status.SENT# type: ignore[assignment]
    invoice.save(update_fields=['number', 'status'])

    return invoice
