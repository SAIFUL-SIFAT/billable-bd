"""
TimeEntry serializers and validation logic.

Cross-Tenant Boundary Enforcement:
Cross-relation validation occurs HERE in the serializer layer (validate_project):
Every foreign key reference to a Project is checked against request.user.
If User B passes a project_id belonging to User A in a POST/PUT body,
validate_project raises a ValidationError ("Project does not exist or does not belong to you").
This prevents malicious or accidental cross-tenant data leakage across project boundaries.
"""

from rest_framework import serializers
from apps.billing.models import TimeEntry
from apps.clients.models import Project


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
