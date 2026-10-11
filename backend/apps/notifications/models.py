from django.db import models #type: ignore
from django.conf import settings #type: ignore
from apps.billing.models import Invoice

class Notification(models.Model):

    class Kind(models.TextChoices):
        INVOICE_OVERDUE = 'invoice_overdue','Invoice Overdue'
        PAYMENT_RECEIVED = 'payment_received','Payment Received'

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='notifications')
    kind = models.CharField(max_length=50, choices=Kind.choices)
    message = models.CharField(max_length=255)
    invoice = models.ForeignKey(Invoice, on_delete=models.SET_NULL, null=True, blank=True, related_name='notifications')
    is_read = models.BooleanField(default=False)
    dedupe_key = models.CharField(max_length=255, null=True, blank=True, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', 'is_read', 'created_at'], name='notif_user_read_created_idx'),
        ]

    def __str__(self) -> str:
        return f"Notification({self.user}, {self.kind}): {self.message}"