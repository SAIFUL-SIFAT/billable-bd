from typing import Any
from rest_framework import serializers # type: ignore[assignment]
from apps.clients.models import Client, Project

class ClientSerializer(serializers.ModelSerializer):
    """Serializer for managing Client model data.

    Attributes:
        owner: Read-only field representing the owning user's email or ID.
        created_at: Read-only timestamp when the client was created.
    """

    outstanding_by_currency = serializers.SerializerMethodField()
    total_received_bdt = serializers.SerializerMethodField()
    last_invoice_date = serializers.SerializerMethodField()

    class Meta:
        model = Client
        fields = [
            'id',
            'name',
            'email',
            'company',
            'country',
            'default_currency',
            'address',
            'notes',
            'created_at',
            'outstanding_by_currency',
            'total_received_bdt',
            'last_invoice_date',
        ]
        read_only_fields = ['id', 'created_at', 'outstanding_by_currency', 'total_received_bdt', 'last_invoice_date']

    def get_outstanding_by_currency(self, obj: Client) -> list:
        from django.db.models import Sum, F, DecimalField#type: ignore[attr-defined]
        from apps.billing.models import Invoice
        qs = (
            Invoice.objects.filter(
                client=obj,
                status__in=[Invoice.Status.SENT, Invoice.Status.PARTIALLY_PAID],
            )
            .values('client__default_currency')
            .annotate(
                amount=Sum(F('total_amount') - F('paid_amount'), output_field=DecimalField(max_digits=12, decimal_places=2))
            )
        )
        return [{'currency': r['client__default_currency'], 'amount': str(r['amount'] or '0.00')} for r in qs]

    def get_total_received_bdt(self, obj: Client) -> str:
        from django.db.models import Sum #type: ignore[attr-defined]
        from apps.billing.models import Payment
        total = Payment.objects.filter(invoice__client=obj).aggregate(t=Sum('received_bdt'))['t']
        return str(total or '0.00')

    def get_last_invoice_date(self, obj: Client) -> str | None:
        last_inv = obj.invoices.order_by('-issue_date').first()#type: ignore[attr-defined]
        return str(last_inv.issue_date) if last_inv else None

class ProjectSerializer(serializers.ModelSerializer):
    """Serializer for managing Project model data with billing validation.

    Attributes:
        client_name: Read-only helper field displaying the associated client's name.
        billing_type: Choice field ('hourly' or 'fixed') defining billing logic.
    """

    client_name = serializers.ReadOnlyField(source='client.name')

    class Meta:
        model = Project
        fields = [
            'id',
            'client',
            'client_name',
            'name',
            'billing_type',
            'currency',
            'hourly_rate',
            'fixed_price',
            'is_archived',
            'created_at',
        ]
        read_only_fields = ['id', 'created_at']

    def validate_client(self, value: Client) -> Client:
        """Validate that the selected client belongs to the authenticated user.

        Args:
            value (Client): The client instance selected in the payload.

        Returns:
            Client: The validated client instance if ownership matches.

        Raises:
            serializers.ValidationError: If the client belongs to a different user.
        """
        # NOTE: Check if client's owner matches current request user to enforce tenancy security.
        request = self.context.get('request')
        if request and value.owner != request.user:
            raise serializers.ValidationError("Invalid client selection. Client does not belong to you.")
        return value

    def validate(self, attrs: dict[str, Any]) -> dict[str, Any]:
        """Validate that billing type matches rate/price inputs to mirror database CheckConstraint.

        Args:
            attrs (dict[str, Any]): Dictionary of deserialized field values.

        Returns:
            dict[str, Any]: Validated dictionary of values.

        Raises:
            serializers.ValidationError: If billing_type is mismatched with rate or price fields.
        """
        # Extract values or fallback to instance values during updates
        billing_type = attrs.get('billing_type', getattr(self.instance, 'billing_type', 'hourly'))
        hourly_rate = attrs.get('hourly_rate', getattr(self.instance, 'hourly_rate', None))
        fixed_price = attrs.get('fixed_price', getattr(self.instance, 'fixed_price', None))

        # Enforce hourly project rate constraints
        if billing_type == 'hourly':
            if hourly_rate is None:
                raise serializers.ValidationError({'hourly_rate': 'Hourly projects require an hourly rate.'})
            attrs['fixed_price'] = None

        # Enforce fixed project price constraints
        elif billing_type == 'fixed':
            if fixed_price is None:
                raise serializers.ValidationError({'fixed_price': 'Fixed projects require a fixed price.'})
            attrs['hourly_rate'] = None

        return attrs
