"""
TimeEntry ViewSets, Filters, and Aggregation Endpoints.

Queryset-Level Tenant Scoping & N+1 Performance Strategy:
User data isolation is enforced strictly inside get_queryset() by filtering on owner=self.request.user.
If User B requests a time entry ID belonging to User A, Django ORM evaluates WHERE owner=User_B AND id=ID_A,
returning an empty result set that DRF translates into a 404 Not Found (preventing resource enumeration).

select_related('project', 'project__client') is applied globally to get_queryset().
This executes an SQL JOIN between TimeEntry, Project, and Client tables, guaranteeing
list endpoints execute in a constant number of queries regardless of database row count (N+1 protection).
"""

import csv
from decimal import Decimal
from typing import Any

from django.core.mail import send_mail  # type: ignore[assignment]
from django.db.models import Sum, Q, F, DecimalField, ExpressionWrapper  # type: ignore[assignment]
from django.http import HttpResponse, Http404  # type: ignore[assignment]
from django.shortcuts import get_object_or_404  # type: ignore
from django_filters import rest_framework as filters  # type: ignore[assignment]

from rest_framework import viewsets, permissions, mixins, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle
from rest_framework.views import APIView

from apps.clients.models import Client
from apps.core.exceptions import InvoiceStateError, TimeEntryLockedError
from apps.billing.models import TimeEntry, Invoice, Payment, Expense
from apps.billing.serializers import (
    TimeEntrySerializer,
    InvoiceSerializer,
    PaymentSerializer,
    InvoiceFromTimeSerializer,
    PublicInvoiceSerializer,
    ExpenseSerializer,
)
from apps.billing.services import (
    create_invoice_from_time,
    void_invoice,
    record_payment,
    delete_payment,
    send_invoice,
    generate_public_token,
    revoke_public_link,
    resolve_public_token,
)


class TimeEntryFilter(filters.FilterSet):
    """FilterSet for filtering time entries by project, date range, and billed status."""

    date_after = filters.DateFilter(field_name='date', lookup_expr='gte')
    date_before = filters.DateFilter(field_name='date', lookup_expr='lte')

    class Meta:
        model = TimeEntry
        fields = ['project', 'is_billed', 'date_after', 'date_before']


class TimeEntryViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing user time entries.

    Provides standard CRUD endpoints and an aggregated totals summary endpoint.
    """

    serializer_class = TimeEntrySerializer
    permission_classes = [permissions.IsAuthenticated]
    filterset_class = TimeEntryFilter
    search_fields = ['description', 'project__name']
    ordering_fields = ['date', 'hours', 'created_at']

    def get_queryset(self):
        """
        Return owner-scoped time entries with select_related optimization.

        Returns:
            QuerySet: Filtered TimeEntry queryset with joined project and client tables.
        """
        return TimeEntry.objects.filter(owner=self.request.user).select_related(
            'project',
            'project__client'
        )

    def perform_create(self, serializer: TimeEntrySerializer) -> None:
        """
        Set the authenticated user as the owner when creating a time entry.

        Args:
            serializer: TimeEntrySerializer instance.
        """
        serializer.save(owner=self.request.user)

    def perform_update(self, serializer: TimeEntrySerializer) -> None:
        """Enforce US-07: Billed time entries cannot be updated."""
        if serializer.instance.is_billed:  # type: ignore
            raise TimeEntryLockedError("Billed time entries are locked and cannot be edited.")
        serializer.save()

    def perform_destroy(self, instance: TimeEntry) -> None:
        """Enforce US-07: Billed time entries cannot be deleted."""
        if instance.is_billed:
            raise TimeEntryLockedError("Billed time entries are locked and cannot be deleted.")
        instance.delete()

    @action(detail=False, methods=["get"], url_path="export-csv")
    def export_csv(self, request) -> Response:
        """Export time entries to CSV with active filters (US-23)."""
        queryset = self.filter_queryset(self.get_queryset())
        response = HttpResponse(content_type='text/csv')
        response['Content-Disposition'] = 'attachment; filename="time_entries.csv"'

        writer = csv.writer(response)
        writer.writerow(['Date', 'Project', 'Client', 'Hours', 'Description', 'Is Billed'])

        for entry in queryset:
            writer.writerow([
                entry.date,
                entry.project.name,
                entry.project.client.name,
                entry.hours,
                entry.description,
                entry.is_billed,
            ])
        return response# type: ignore[assignment]

    @action(detail=False, methods=['get'])
    def totals(self, request) -> Response:
        """
        Calculate total hours and unbilled totals grouped per currency for the filtered set of time entries.

        Returns:
            Response: JSON response with total_hours, unbilled_hours, unbilled_amount, and unbilled_by_currency.
        """
        qs = self.filter_queryset(self.get_queryset())
        amount_expr = ExpressionWrapper(
            F('hours') * F('project__hourly_rate'),
            output_field=DecimalField(max_digits=12, decimal_places=2)
        )
        stats = qs.annotate(_calc_amt=amount_expr).aggregate(
            total_hours=Sum('hours'),
            unbilled_hours=Sum('hours', filter=Q(is_billed=False)),
            unbilled_amount=Sum('_calc_amt', filter=Q(is_billed=False, project__billing_type='hourly'))
        )
        
        # Calculate unbilled value per currency (never mix heterogeneous currencies)
        unbilled_by_curr_qs = (
            qs.annotate(_calc_amt=amount_expr)
            .filter(is_billed=False, project__billing_type='hourly')
            .values('project__currency')
            .annotate(
                hours=Sum('hours'),
                amount=Sum('_calc_amt')
            )
            .order_by('project__currency')
        )
        unbilled_by_currency = [
            {
                'currency': row['project__currency'],
                'hours': str(row['hours']),
                'amount': str(row['amount']),
            }
            for row in unbilled_by_curr_qs
        ]

        return Response({
            'total_hours': stats['total_hours'] or 0,
            'unbilled_hours': stats['unbilled_hours'] or 0,
            'unbilled_amount': stats['unbilled_amount'] or 0,
            'unbilled_by_currency': unbilled_by_currency,
        })


class InvoiceViewSet(viewsets.ModelViewSet):
    """ViewSet for managing Invoices and their lifecycle."""

    serializer_class = InvoiceSerializer
    permission_classes = [permissions.IsAuthenticated]
    filterset_fields = ['status', 'client']
    search_fields = ['number', 'client__name', 'notes']
    ordering_fields = ['issue_date', 'due_date', 'total_amount', 'created_at']
    ordering = ['-issue_date', '-created_at']

    def get_queryset(self):
        """Filter invoices to owner and prefetch related items."""
        return Invoice.objects.filter(owner=self.request.user).prefetch_related('items')

    def perform_create(self, serializer: InvoiceSerializer) -> None:
        serializer.save(owner=self.request.user)

    def perform_update(self, serializer: InvoiceSerializer) -> None:
        """Block edits to non-draft invoices."""
        if serializer.instance.status != Invoice.Status.DRAFT:  # type: ignore
            raise InvoiceStateError("Only DRAFT invoices can be edited.")
        serializer.save()

    def perform_destroy(self, instance: Invoice) -> None:
        """Block deletion of non-draft invoices and release time entries on draft deletion."""
        if instance.status != Invoice.Status.DRAFT:
            raise InvoiceStateError("Only DRAFT invoices can be deleted.")
        instance.time_entries.update(is_billed=False, invoice=None)
        instance.delete()

    @action(detail=True, methods=['post'])
    def void(self, request, pk=None) -> Response:
        """Transition invoice to VOID."""
        invoice = self.get_object()
        if invoice.status == Invoice.Status.VOID:
            raise InvoiceStateError("Invoice is already void.")
        if invoice.status == Invoice.Status.PAID:
            raise InvoiceStateError("Paid invoices cannot be voided.")
        invoice.status = Invoice.Status.VOID
        invoice.save()
        return Response({"status": "void"})

    @action(detail=False, methods=['post'], url_path='from-time')
    def from_time(self, request) -> Response:
        """Create a draft invoice from unbilled time entries (US-09)."""
        serializer = InvoiceFromTimeSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        client = get_object_or_404(Client, id=data['client'], owner=request.user)
        invoice = create_invoice_from_time(  # type: ignore[operator,call-arg]
            owner=request.user,  #type: ignore
            client=client,  #type: ignore
            date_from=data['date_from'],  #type: ignore
            date_to=data['date_to'],  #type: ignore
            project_ids=data.get('project_ids'),  #type: ignore
            tax_rate=data.get('tax_rate', Decimal('0.00'))  #type: ignore
        )
        return Response(InvoiceSerializer(invoice).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['get', 'post'], url_path='payments')
    def payments(self, request, pk=None) -> Response:
        """List or record payments for this invoice (US-15, BR-11, BR-12)."""
        invoice = self.get_object()
        if request.method == 'GET':
            serializer = PaymentSerializer(invoice.payments.all(), many=True)
            return Response(serializer.data)
        serializer = PaymentSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        payment = record_payment(invoice, serializer.validated_data)  # type: ignore[operator,call-arg]
        return Response(PaymentSerializer(payment).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'])
    def send(self, request, pk=None) -> Response:
        invoice = self.get_object()
        if invoice.status != Invoice.Status.DRAFT:
            raise InvoiceStateError("Only DRAFT invoices can be sent.")
        invoice = send_invoice(invoice)
        return Response(InvoiceSerializer(invoice).data)

    @action(detail=True, methods=["post"], url_path="share")
    def share(self, request: Any, pk: Any = None) -> Response:
        """Generate a signed public link token for sharing the invoice."""
        invoice = self.get_object()
        token = generate_public_token(invoice)# type: ignore[assignment]
        return Response({"token": token, "token_version": invoice.token_version}, status=status.HTTP_200_OK)
    
    @action(detail=True, methods=["post"], url_path="revoke-public-link")
    def revoke_public_link(self, request: Any, pk: Any = None) -> Response:
        """Revoke current public link by incrementing token version."""
        invoice = self.get_object()
        invoice = revoke_public_link(invoice)# type: ignore[assignment]
        return Response(
            {"detail": "Public link revoked successfully.", "token_version": invoice.token_version},
            status=status.HTTP_200_OK,
        )

    @action(detail=True, methods=["post"], url_path="send-reminder")
    def send_reminder(self, request: Any, pk: Any = None) -> Response:
        """Send a payment reminder email to the client (US-25)."""
        invoice = self.get_object()
        client = invoice.client
        if not client.email:
            return Response({"detail": "Client has no email address configured."}, status=status.HTTP_400_BAD_REQUEST)
        
        balance_due = max(Decimal("0.00"), invoice.total_amount - invoice.paid_amount)
        subject = f"Payment Reminder: Invoice {invoice.number or 'Pending'}"
        message = (
            f"Dear {client.name},\n\n"
            f"This is a reminder regarding Invoice {invoice.number or 'Pending'}, issued on {invoice.issue_date}.\n"
            f"Outstanding Balance: {invoice.currency} {balance_due}\n"
            f"Due Date: {invoice.due_date}\n\n"
            f"Please let us know once payment has been remitted.\n\n"
            f"Best regards,\n"
            f"{request.user.first_name or request.user.email}"
        )
        send_mail(
            subject=subject,
            message=message,
            from_email="billing@billable.test",
            recipient_list=[client.email],
            fail_silently=False,
        )
        return Response({"detail": f"Reminder email successfully sent to {client.email}."})

    @action(detail=False, methods=["get"], url_path="export-csv")
    def export_csv(self, request: Any) -> Response:
        """Export invoices to CSV with date filtering (US-23)."""
        queryset = self.filter_queryset(self.get_queryset())
        response = HttpResponse(content_type='text/csv')
        response['Content-Disposition'] = 'attachment; filename="invoices.csv"'

        writer = csv.writer(response)
        writer.writerow(['Number', 'Client', 'Currency', 'Issue Date', 'Due Date', 'Status', 'Subtotal', 'Tax Amount', 'Total Amount', 'Paid Amount', 'Balance Due'])

        for inv in queryset:
            balance = max(Decimal("0.00"), inv.total_amount - inv.paid_amount)
            writer.writerow([
                inv.number,
                inv.client.name,
                inv.currency,
                inv.issue_date,
                inv.due_date,
                inv.status,
                inv.subtotal,
                inv.tax_amount,
                inv.total_amount,
                inv.paid_amount,
                balance,
            ])
        return response# type: ignore[assignment]


class PaymentViewSet(mixins.CreateModelMixin, mixins.DestroyModelMixin, mixins.RetrieveModelMixin, mixins.ListModelMixin, viewsets.GenericViewSet):
    """ViewSet for managing individual payments (US-16)."""

    serializer_class = PaymentSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Payment.objects.filter(invoice__owner=self.request.user)  # type: ignore[attr-defined]

    def create(self, request, *args, **kwargs):
        invoice_id = request.data.get('invoice')
        try:
            invoice = Invoice.objects.get(id=invoice_id, owner=request.user)
        except Invoice.DoesNotExist:  # type: ignore[assignment]
            raise Http404("Invoice not found.")

        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        payment = record_payment(invoice, serializer.validated_data)  # type: ignore[assignment]
        return Response(PaymentSerializer(payment).data, status=status.HTTP_201_CREATED)

    def perform_destroy(self, instance: Any) -> None:
        """Delete payment and recompute invoice balance and status."""
        delete_payment(instance)

    @action(detail=False, methods=["get"], url_path="export-csv")
    def export_csv(self, request: Any) -> Response:
        """Export payments to CSV (US-23)."""
        queryset = self.get_queryset()
        response = HttpResponse(content_type='text/csv')
        response['Content-Disposition'] = 'attachment; filename="payments.csv"'

        writer = csv.writer(response)
        writer.writerow(['Invoice Number', 'Client', 'Amount Applied', 'Fee Amount', 'Received BDT', 'Payment Method', 'Paid On', 'Reference'])

        for p in queryset:
            writer.writerow([
                p.invoice.number,
                p.invoice.client.name,
                p.amount_applied,
                p.fee_amount,
                p.received_bdt,
                p.method,
                p.paid_on,
                p.reference,
            ])
        return response  # type: ignore[assignment]


class ExpenseViewSet(viewsets.ModelViewSet):
    """ViewSet for logging and managing business expenses (US-24)."""

    serializer_class = ExpenseSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Expense.objects.filter(owner=self.request.user)  # type: ignore[assignment]

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user)

    @action(detail=False, methods=["get"], url_path="export-csv")
    def export_csv(self, request: Any) -> Response:
        """Export expenses to CSV (US-23)."""
        queryset = self.get_queryset()
        response = HttpResponse(content_type='text/csv')
        response['Content-Disposition'] = 'attachment; filename="expenses.csv"'

        writer = csv.writer(response)
        writer.writerow(['Date', 'Category', 'Description', 'Amount', 'Currency', 'Amount BDT'])

        for exp in queryset:
            writer.writerow([
                exp.date,
                exp.category,
                exp.description,
                exp.amount,
                exp.currency,
                exp.amount_bdt,
            ])
        return response# type: ignore[assignment]


class PublicInvoiceView(APIView):
    """Unauthenticated public view for external clients to view shared invoices."""

    permission_classes = [permissions.AllowAny]
    throttle_classes = [AnonRateThrottle]

    def get(self, request: Any, token: str) -> Response:
        """Resolve signed token and return sanitized public invoice details."""
        invoice = resolve_public_token(token)
        serializer = PublicInvoiceSerializer(invoice)
        return Response(serializer.data, status=status.HTTP_200_OK)


