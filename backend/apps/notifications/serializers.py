from rest_framework import serializers
from apps.notifications.models import Notification


class NotificationSerializer(serializers.ModelSerializer):

    invoice_number = serializers.CharField(source="invoice.number", read_only=True, default=None)

    class Meta:
        model = Notification
        fields = [
            "id",
            "kind",
            "message",
            "invoice",
            "invoice_number",
            "is_read",
            "created_at",
        ]
        read_only_fields = [
            "id",
            "kind",
            "message",
            "invoice",
            "invoice_number",
            "created_at",
        ]

