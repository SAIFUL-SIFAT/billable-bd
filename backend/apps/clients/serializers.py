from typing import Any
from rest_framework import serializers # type: ignore[assignment]
from apps.clients.models import Client, Project

class ClientSerializer(serializers.ModelSerializer):
    """Serializer for managing Client model data.

    Attributes:
        owner: Read-only field representing the owning user's email or ID.
        created_at: Read-only timestamp when the client was created.
    """

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
        ]
        read_only_fields = ['id', 'created_at']

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
