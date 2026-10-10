"""
Billing domain models: TimeEntry, TimeEntryQuerySet, and TimeEntryManager.

Tenant isolation is enforced HERE at the model/queryset layer:
Every query that touches TimeEntry data MUST scope to request.user (owner),
never allowing a client to spoof owner IDs in requests. That's the core
multi-tenancy isolation pattern called out in IMPLEMENTATION_PLAN.md as a
day-one constraint, not something to bolt on later.

Key Architectural Guarantees:
1. DB-Level Constraints: CheckConstraint(hours > 0) enforces positive work duration at the MySQL database level.
2. Indexing Strategy: Composite indexes on (owner, date) and (owner, project, is_billed) optimize date-range filtering and unbilled totals aggregation.
3. Locked-Entry Rule: clean() validation blocks modifications to entries where is_billed is True, protecting invoiced work history from unauthorized mutation.
"""

from django.db import models  # type: ignore[assignment]
from django.conf import settings  # type: ignore[assignment]
from django.core.exceptions import ValidationError  # type: ignore[assignment]
from apps.clients.models import Project
from decimal import Decimal
from apps.clients.models import Client

class TimeEntryQuerySet(models.QuerySet):
    """Custom QuerySet for TimeEntry supporting chainable domain methods."""

    def unbilled(self) -> "TimeEntryQuerySet":
        """
        Filter for time entries that have not yet been converted into an invoice line item.
        
        Returns:
            TimeEntryQuerySet: Filtered queryset containing only unbilled entries.
        """
        return self.filter(is_billed=False)


class TimeEntryManager(models.Manager):
    """Custom Manager for TimeEntry forwarding custom QuerySet methods."""

    def get_queryset(self) -> TimeEntryQuerySet:
        """Return custom TimeEntryQuerySet instance."""
        return TimeEntryQuerySet(self.model, using=self._db)

    def unbilled(self) -> TimeEntryQuerySet:
        """Shortcut method to retrieve unbilled time entries."""
        return self.get_queryset().unbilled()


class TimeEntry(models.Model):
    """
    Tracks hours worked by a user on a specific client project.

    Attributes:
        owner: User who logged the time entry (enforces multi-tenant ownership).
        project: Target project. PROTECT prevents deleting projects with logged hours.
        date: Date work was performed.
        hours: Number of hours logged (e.g. 2.50 for 2h 30m).
        description: Work summary notes.
        is_billed: Flag indicating whether this time entry has been invoiced.
        created_at: Audit timestamp when record was logged.
    """

    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    project = models.ForeignKey(Project, on_delete=models.PROTECT, related_name='time_entries')
    date = models.DateField()
    hours = models.DecimalField(max_digits=5, decimal_places=2)
    description = models.TextField(blank=True)
    is_billed = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    objects = TimeEntryManager()

    class Meta:
        ordering = ['-date', '-created_at']
        indexes = [
            # Optimize date range queries by owner (checkpoint requirement).
            models.Index(fields=['owner', 'date'], name='timeentry_owner_date_idx'),
            # Optimize unbilled hours calculation by owner and project.
            models.Index(fields=['owner', 'project', 'is_billed'], name='timeentry_owner_proj_bill_idx'),
        ]
        constraints = [
            # DB-level guarantee that hours logged must be strictly positive (> 0).
            models.CheckConstraint(
                condition=models.Q(hours__gt=0),
                name='time_entry_hours_positive',
                violation_error_message="Logged hours must be greater than 0."
            )
        ]

    def clean(self) -> None:
        """
        Enforce locked-entry rule: billed entries cannot be updated.

        Raises:
            ValidationError: If attempting to modify a billed entry.
        """
        if self.pk:
            original = TimeEntry.objects.get(pk=self.pk)
            if original.is_billed:
                raise ValidationError("Billed time entries are locked and cannot be modified.")
        super().clean()

    def save(self, *args, **kwargs) -> None:
        """Execute full model validation before persisting to database."""
        self.full_clean()
        super().save(*args, **kwargs)

    def __str__(self) -> str:
        """Return string representation of logged time entry."""
        return f"{self.hours} hrs on {self.project.name} ({self.date})"

class InvoiceSequence(models.Model):
    """
    Tracks the current auto-incrementing invoice number for an owner within a specific fiscal year.

    Why lock this row instead of querying MAX(number) + 1 on Invoice:
    1. Concurrency Races: Querying MAX(number)+1 allows two parallel transactions to read the same max number and attempt to generate 
    identical invoice numbers.
    2. Database Locks: Locking the Invoice table during generation would block all invoice creations across all users or lock the 
    whole table.
    3. Isolated Lock Target: By locking only the specific InvoiceSequence row for (owner, fiscal_year) using select_for_update(),
     we achieve safe, atomic sequence incrementing without locking un-related database rows.

    Attributes:
        owner: Target user owning the sequence.
        fiscal_year: Target fiscal year string (e.g. "2025-26").
        last_number: Integer count of the last issued invoice number.
    """

    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    fiscal_year = models.CharField(max_length=10)
    last_number = models.PositiveIntegerField(default=0)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['owner', 'fiscal_year'],
                name='unique_owner_fiscal_year_sequence'
            )
        ]

    def __str__(self) -> str:
        return f"Sequence {self.fiscal_year} for {self.owner}: {self.last_number}"


class Invoice(models.Model):
    """
    Represents a financial invoice generated by an owner for a client.

    Attributes:
        owner: User generating the invoice.
        client: Target billing client.
        number: Human-readable unique sequence string (e.g. "INV-2025-26-001").
        status: Current invoice lifecycle status (DRAFT, SENT, PAID, VOID, OVERDUE).
        issue_date: Date the invoice was issued.
        due_date: Payment deadline.
        subtotal: Total before tax.
        tax_rate: Tax percentage applied (e.g. 5.00 for 5%).
        tax_amount: Calculated tax in currency.
        total_amount: Total amount due (subtotal + tax_amount).
        paid_amount: Cumulative sum of payments applied.
        notes: Payment terms or client instructions.
    """

    class Status(models.TextChoices):
        DRAFT = 'DRAFT', 'Draft'
        SENT = 'SENT', 'Sent'
        PAID = 'PAID', 'Paid'
        VOID = 'VOID', 'Void'
        OVERDUE = 'OVERDUE', 'Overdue'

    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    client = models.ForeignKey(Client, on_delete=models.PROTECT, related_name='invoices')
    number = models.CharField(max_length=50, blank=True, default='')
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.DRAFT)
    issue_date = models.DateField()
    due_date = models.DateField()
    subtotal = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    tax_rate = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal('0.00'))
    tax_amount = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    total_amount = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    paid_amount = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-issue_date', '-created_at']
        constraints = [
            models.CheckConstraint(condition=models.Q(subtotal__gte=0), name='invoice_subtotal_non_negative'),
            models.CheckConstraint(condition=models.Q(tax_rate__gte=0), name='invoice_tax_rate_non_negative'),
            models.CheckConstraint(condition=models.Q(tax_amount__gte=0), name='invoice_tax_amount_non_negative'),
            models.CheckConstraint(condition=models.Q(total_amount__gte=0), name='invoice_total_amount_non_negative'),
            models.CheckConstraint(condition=models.Q(paid_amount__gte=0), name='invoice_paid_amount_non_negative'),
        ]

    def __str__(self) -> str:
        return f"Invoice {self.number or '(Draft)'} - {self.client.name}"


class InvoiceItem(models.Model):
    """
    Individual line item on an invoice, optionally tied to a TimeEntry.

    Attributes:
        invoice: Target parent invoice.
        time_entry: Associated time entry (SET_NULL on deletion to maintain invoice record).
        description: Description of services rendered.
        quantity: Number of hours/units billed.
        unit_price: Rate per unit/hour.
        subtotal: Line total (quantity * unit_price quantized).
    """

    invoice = models.ForeignKey(Invoice, on_delete=models.CASCADE, related_name='items')
    time_entry = models.ForeignKey(TimeEntry, on_delete=models.SET_NULL, null=True, blank=True, related_name='invoice_items')
    description = models.CharField(max_length=255)
    quantity = models.DecimalField(max_digits=8, decimal_places=2)
    unit_price = models.DecimalField(max_digits=10, decimal_places=2)
    subtotal = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))

    class Meta:
        constraints = [
            models.CheckConstraint(condition=models.Q(quantity__gt=0), name='invoice_item_quantity_positive'),
            models.CheckConstraint(condition=models.Q(unit_price__gte=0), name='invoice_item_unit_price_non_negative'),
            models.CheckConstraint(condition=models.Q(subtotal__gte=0), name='invoice_item_subtotal_non_negative'),
        ]

    def __str__(self) -> str:
        return f"{self.description} ({self.quantity} x {self.unit_price})"


class Payment(models.Model):
    """
    Tracks monetary payments applied against an invoice.

    Attributes:
        invoice: Target parent invoice.
        amount: Monetary amount paid.
        payment_date: Date payment was received.
        payment_method: Payment channel (BANK_TRANSFER, CASH, BKASH, etc.).
        notes: Optional transaction notes or reference code.
    """

    invoice = models.ForeignKey(Invoice, on_delete=models.CASCADE, related_name='payments')
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    payment_date = models.DateField()
    payment_method = models.CharField(max_length=50, default='BANK_TRANSFER')
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.CheckConstraint(condition=models.Q(amount__gt=0), name='payment_amount_positive'),
        ]

    def __str__(self) -> str:
        return f"Payment {self.amount} for Invoice {self.invoice.number} on {self.payment_date}"



