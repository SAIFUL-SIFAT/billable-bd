from django.db import models
from django.conf import settings
from apps.core.constants import CURRENCY_CHOICES

class Client(models.Model):
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    name = models.CharField(max_length=255)
    email = models.EmailField(blank=True)
    company = models.CharField(max_length=255, blank=True)
    country = models.CharField(max_length=2, blank=True, help_text="2-letter country code")
    default_currency = models.CharField(max_length=3, choices=CURRENCY_CHOICES, default='BDT')
    address = models.TextField(blank=True)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['owner', 'name'], name='unique_client_name_per_owner')
        ]

    def __str__(self) -> str:
        return self.name

class Project(models.Model):
    BILLING_TYPE_CHOICES = (
        ('hourly', 'Hourly'),
        ('fixed', 'Fixed'),
    )

    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    client = models.ForeignKey(Client, on_delete=models.PROTECT, related_name='projects')
    name = models.CharField(max_length=255)
    billing_type = models.CharField(max_length=10, choices=BILLING_TYPE_CHOICES, default='hourly')
    currency = models.CharField(max_length=3, choices=CURRENCY_CHOICES, default='BDT')
    hourly_rate = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    fixed_price = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    is_archived = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [
            models.Index(fields=['owner', 'client']),
        ]
        constraints = [
            models.UniqueConstraint(fields=['owner', 'name'], name='unique_project_name_per_owner'),
            models.CheckConstraint(
                condition=(
                    models.Q(billing_type='hourly', hourly_rate__isnull=False, fixed_price__isnull=True) |
                    models.Q(billing_type='fixed', fixed_price__isnull=False, hourly_rate__isnull=True)
                ),
                name='check_billing_type_rates',
                violation_error_message="Hourly projects must have an hourly rate and no fixed price. Fixed projects must have a fixed price and no hourly rate."
            )
        ]

    def __str__(self) -> str:
        return f"{self.name} ({self.client.name})"
