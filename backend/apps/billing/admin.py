from django.contrib import admin # type: ignore[assignment]
from apps.billing.models import TimeEntry, InvoiceSequence, Invoice, InvoiceItem, Payment
from apps.billing.services import compute_invoice_totals


@admin.register(TimeEntry)
class TimeEntryAdmin(admin.ModelAdmin):
    """Admin configuration for TimeEntry model."""
    list_display = ('id', 'owner', 'project', 'date', 'hours', 'is_billed', 'created_at')# type: ignore[assignment]
    list_filter = ('is_billed', 'date', 'project')
    search_fields = ('description', 'owner__email', 'project__name')


@admin.register(InvoiceSequence)
class InvoiceSequenceAdmin(admin.ModelAdmin):
    """Admin configuration for InvoiceSequence model."""
    list_display = ('id', 'owner', 'fiscal_year', 'last_number')# type: ignore[assignment]
    list_filter = ('fiscal_year',)
    search_fields = ('owner__email', 'fiscal_year')


class InvoiceItemInline(admin.TabularInline):
    """Inline admin editing for line items attached to an Invoice."""
    model = InvoiceItem
    extra = 1
    fields = ('description', 'quantity', 'unit_price', 'subtotal')


class PaymentInline(admin.TabularInline):
    """Inline admin editing for payments applied against an Invoice."""
    model = Payment
    extra = 0
    fields = ('amount', 'payment_date', 'payment_method', 'notes')


@admin.register(Invoice)
class InvoiceAdmin(admin.ModelAdmin):
    """Admin configuration for Invoice model including items and payments inlines."""
    list_display = ('number', 'client', 'owner', 'status', 'issue_date', 'due_date', 'subtotal', 'tax_amount', 'total_amount', 'paid_amount')# type: ignore[assignment]
    list_filter = ('status', 'issue_date')
    search_fields = ('number', 'client__name', 'owner__email', 'notes')
    inlines = [InvoiceItemInline, PaymentInline]# type: ignore[assignment]

    def save_related(self, request, form, formsets, change):
        """
        Override save_related to automatically re-compute invoice totals after inlines are saved.
        """
        super().save_related(request, form, formsets, change)
        compute_invoice_totals(form.instance)


@admin.register(Payment)
class PaymentAdmin(admin.ModelAdmin):
    """Admin configuration for Payment model."""
    list_display = ('id', 'invoice', 'amount', 'payment_date', 'payment_method', 'created_at')# type: ignore[assignment]
    list_filter = ('payment_date', 'payment_method')
    search_fields = ('invoice__number', 'notes')

