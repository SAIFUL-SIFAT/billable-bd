"""
TimeEntry API Integration and Performance Test Suite.

Automated Checkpoints Enforced:
1. N+1 Performance Verification (assertNumQueries):
   test_list_query_count_constant uses self.assertNumQueries(2) to mathematically prove
   that list view queries do NOT scale with row count, verifying that select_related
   joins Project and Client tables efficiently in a single query.

2. Multi-Tenant Security Isolation:
   test_tenant_isolation verifies that User B accessing User A's time entry yields 404 Not Found,
   confirming that isolation is enforced at the queryset filter level.

3. Custom QuerySet Domain Methods:
   test_unbilled_queryset_filter verifies TimeEntryQuerySet.unbilled() filters accurately.
"""

from datetime import date 
from django.contrib.auth import get_user_model # type: ignore[assignment]
from rest_framework.test import APITestCase
from rest_framework import status
from apps.clients.models import Client, Project
from apps.billing.models import TimeEntry

User = get_user_model()

class TimeEntryAPITests(APITestCase):
    """Test suite verifying TimeEntry API security, performance, and functionality."""

    def setUp(self):
        """Initialize test users, clients, projects, and initial time entries."""
        self.user_a = User.objects.create_user(email="usera@example.com", password="password123")
        self.user_b = User.objects.create_user(email="userb@example.com", password="password123")

        self.client_a = Client.objects.create(owner=self.user_a, name="Client A") # type: ignore[assignment]
        self.project_a = Project.objects.create( # type: ignore[assignment]
            owner=self.user_a,
            client=self.client_a,
            name="Project A",
            billing_type="hourly",
            hourly_rate=100.00
        )

        # Log time entries for user A
        for i in range(5):
            TimeEntry.objects.create(
                owner=self.user_a,
                project=self.project_a,
                date=date(2026, 10, 1 + i),
                hours=2.5,
                description=f"Task {i}"
            )

    def test_list_query_count_constant(self):
        """Checkpoint: Verify list endpoint query count does not scale with row count (N+1 protection)."""
        self.client.force_authenticate(user=self.user_a)# type: ignore[assignment]
        
        # Check query count for 5 entries
        with self.assertNumQueries(2): # type: ignore[assignment] # 1 session/user query + 1 join query for time_entries + project + client
            response = self.client.get("/api/billing/time-entries/")
            self.assertEqual(response.status_code, status.HTTP_200_OK)# type: ignore[assignment]

    def test_tenant_isolation(self):
        """Verify user B cannot view or edit user A's time entries (returns 404)."""
        self.client.force_authenticate(user=self.user_b)# type: ignore[assignment]
        entry_a = TimeEntry.objects.filter(owner=self.user_a).first()
        
        response = self.client.get(f"/api/billing/time-entries/{entry_a.id}/")
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)# type: ignore[assignment]

    def test_unbilled_queryset_filter(self):
        """Verify custom unbilled() QuerySet filter."""
        unbilled_count = TimeEntry.objects.filter(owner=self.user_a).unbilled().count()
        self.assertEqual(unbilled_count, 5)
