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

from django.db.models import Sum, Q, F, DecimalField, ExpressionWrapper # type: ignore[assignment]
from django_filters import rest_framework as filters # type: ignore[assignment]
from rest_framework import viewsets, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from apps.billing.models import TimeEntry
from apps.billing.serializers import TimeEntrySerializer

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

    @action(detail=False, methods=['get'])
    def totals(self, request) -> Response:
        """
        Calculate total hours and unbilled totals for the filtered set of time entries.

        Returns:
            Response: JSON response with total_hours, unbilled_hours, and unbilled_amount.
        """
        qs = self.filter_queryset(self.get_queryset())
        stats = qs.aggregate(
            total_hours=Sum('hours'),
            unbilled_hours=Sum('hours', filter=Q(is_billed=False)),
            unbilled_amount=Sum(
                ExpressionWrapper(
                    F('hours') * F('project__hourly_rate'),
                    output_field=DecimalField(max_digits=12, decimal_places=2)
                ),
                filter=Q(is_billed=False, project__billing_type='hourly')
            )
        )
        return Response({
            'total_hours': stats['total_hours'] or 0,
            'unbilled_hours': stats['unbilled_hours'] or 0,
            'unbilled_amount': stats['unbilled_amount'] or 0,
        })

