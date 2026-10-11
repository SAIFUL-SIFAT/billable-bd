"""
TimeEntry serializers and validation logic.

Cross-Tenant Boundary Enforcement:
Cross-relation validation occurs HERE in the serializer layer (validate_project):
Every foreign key reference to a Project is checked against request.user.
If User B passes a project_id belonging to User A in a POST/PUT body,
validate_project raises a ValidationError ("Project does not exist or does not belong to you").
This prevents malicious or accidental cross-tenant data leakage across project boundaries.
"""

from decimal import Decimal

from rest_framework import serializers
from apps.billing.models import TimeEntry
from apps.clients.models import Project
from django.db import transaction #type: ignore
from apps.billing.models import Invoice, InvoiceItem #type: ignore
from apps.billing.models import Payment



class TimeEntrySerializer(serializers.ModelSerializer):
    """Serializer for TimeEntry model providing validation and display fields.

    Attributes:
        project_name: Read-only string representation of associated project name.
        client_name: Read-only string representation of client owning the project.
    """

    project_name = serializers.CharField(source='project.name', read_only=True)
    client_name = serializers.CharField(source='project.client.name', read_only=True)

    class Meta:
        model = TimeEntry
        fields = [
            'id',
            'project',
            'project_name',
            'client_name',
            'date',
            'hours',
            'description',
            'is_billed',
            'created_at',
        ]
        read_only_fields = ['id', 'is_billed', 'created_at']

    def validate_project(self, value: Project) -> Project:
        """
        Validate that the selected project belongs to the requesting authenticated user.

        Args:
            value: The Project instance referenced by the client request payload.

        Returns:
            Project: Validated project instance owned by caller.

        Raises:
            serializers.ValidationError: If the project belongs to another tenant.
        """
        user = self.context['request'].user
        if value.owner != user:
            raise serializers.ValidationError("Project does not exist or does not belong to you.")
        return value

    def validate_hours(self, value):
        """
        Validate that logged hours are strictly positive.

        Args:
            value: Decimal value for hours.

        Returns:
            Decimal: Validated positive hours value.

        Raises:
            serializers.ValidationError: If hours <= 0.
        """
        if value <= 0:
            raise serializers.ValidationError("Hours must be greater than 0.")
        return value

class InvoiceItemSerializer(serializers.ModelSerializer):
    """Serializer for Invoice line items."""
    class Meta:
        model = InvoiceItem
        fields = ['id', 'time_entry', 'description', 'quantity', 'unit_price', 'subtotal']
        read_only_fields = ['id', 'subtotal']

class InvoiceSerializer(serializers.ModelSerializer):
    """Serializer for Invoice, handling nested items."""
    items = InvoiceItemSerializer(many=True, required=False)
    client_name = serializers.CharField(source='client.name', read_only=True)

    class Meta:
        model = Invoice
        fields = [
            'id', 'client', 'client_name', 'number', 'status', 'issue_date', 'due_date',
            'subtotal', 'tax_rate', 'tax_amount', 'total_amount', 'paid_amount', 'notes', 'items'
        ]
        read_only_fields = ['id', 'number', 'status', 'subtotal', 'tax_amount', 'total_amount', 'paid_amount']

    def create(self, validated_data: dict) -> Invoice:
        """Create invoice and nested items atomically.
        
        Args:
            validated_data: Validated payload data including nested items.
            
        Returns:
            Invoice: Created invoice instance.
        """
        items_data = validated_data.pop('items', [])
        with transaction.atomic():#type: ignore
            invoice = Invoice.objects.create(**validated_data)
            for item_data in items_data:
                InvoiceItem.objects.create(invoice=invoice, **item_data)#type: ignore
            return invoice

    def update(self, instance: Invoice, validated_data: dict) -> Invoice:
        """Update invoice and replace nested items atomically.
        
        Args:
            instance: The invoice to update.
            validated_data: Validated payload data.
            
        Returns:
            Invoice: Updated invoice instance.
        """
        items_data = validated_data.pop('items', None)
        with transaction.atomic():#type: ignore
            # Update invoice fields
            for attr, value in validated_data.items():
                setattr(instance, attr, value)
            instance.save()
            
            # Replace items completely if items_data is provided
            if items_data is not None:
                instance.items.all().delete()#type: ignore
                for item_data in items_data:
                    InvoiceItem.objects.create(invoice=instance, **item_data)#type: ignore
            return instance


class PaymentSerializer(serializers.ModelSerializer):
    """Serializer for recording and inspecting invoice payments."""
    effective_rate = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)

    class Meta:
        model = Payment
        fields = [
            'id', 'invoice', 'amount_applied', 'fee_amount', 'received_bdt',
            'method', 'paid_on', 'reference', 'effective_rate', 'created_at'
        ]
        read_only_fields = ['id', 'invoice', 'effective_rate', 'created_at']


class InvoiceFromTimeSerializer(serializers.Serializer):
    """Serializer validating parameters for creating an invoice from unbilled time (US-09)."""
    client = serializers.IntegerField(required=True)
    date_from = serializers.DateField(required=True)
    date_to = serializers.DateField(required=True)
    project_ids = serializers.ListField(
        child=serializers.IntegerField(),
        required=False,
        allow_empty=True
    )
    tax_rate = serializers.DecimalField(
        max_digits=5,
        decimal_places=2,
        required=False,
        default=Decimal('0.00')#type: ignore
    )

    def validate(self, data: dict) -> dict:#type: ignore
        """Ensure date_from is before or equal to date_to."""
        if data['date_from'] > data['date_to']:
            raise serializers.ValidationError({"date_to": "date_to must be on or after date_from."})
        return data

