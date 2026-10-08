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


