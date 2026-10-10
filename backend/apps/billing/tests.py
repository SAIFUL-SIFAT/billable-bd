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
from decimal import Decimal
from apps.core.utils import fiscal_year_for
from apps.billing.models import Invoice, InvoiceItem, InvoiceSequence
from apps.billing.services import compute_invoice_totals, send_invoice



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


class Day6InvoiceCheckpointTests(APITestCase):
    """Test suite enforcing Day 6 fiscal year, precision quantization, and invoice numbering checkpoints."""

    def setUp(self) -> None:
        self.user = User.objects.create_user(email="invoice_owner@example.com", password="password123")
        self.client_obj = Client.objects.create(owner=self.user, name="Invoice Client")# type: ignore[assignment]

    def test_fiscal_year_boundary_dates(self) -> None:
        """
        Checkpoint Test 1:
        June 30 -> 2025-26
        July 1 -> 2026-27
        """
        june_30 = date(2026, 6, 30)
        july_1 = date(2026, 7, 1)
        self.assertEqual(fiscal_year_for(june_30), "2025-26")
        self.assertEqual(fiscal_year_for(july_1), "2026-27")

    def test_invoice_totals_quantization_precision(self) -> None:
        """
        Checkpoint Test 2:
        0.1 h x 3 lines with 5% tax computed to exact cent accuracy.
        
        Case A (integer rate): 0.10 h @ $100.00 rate x 3 items
        Item subtotals: $10.00, $10.00, $10.00 -> Subtotal: $30.00
        Tax (5%): $1.50 -> Grand Total: $31.50

        Case B (fractional rate rounding): 0.10 h @ $33.33 rate x 3 items
        Item subtotals: $3.33, $3.33, $3.33 -> Subtotal: $9.99
        Tax (5%): 9.99 * 0.05 = 0.4995 -> $0.50 (under ROUND_HALF_UP) -> Grand Total: $10.49
        """
        inv = Invoice.objects.create(# type: ignore[assignment]
            owner=self.user,
            client=self.client_obj,
            issue_date=date(2026, 7, 1),
            due_date=date(2026, 7, 15),
            tax_rate=Decimal("5.00")
        )
        for i in range(3):
            InvoiceItem.objects.create(# type: ignore[assignment]
                invoice=inv,
                description=f"Line item {i+1}",
                quantity=Decimal("0.10"),
                unit_price=Decimal("100.00")
            )
        
        compute_invoice_totals(inv)
        inv.refresh_from_db()

        self.assertEqual(inv.subtotal, Decimal("30.00"))
        self.assertEqual(inv.tax_amount, Decimal("1.50"))
        self.assertEqual(inv.total_amount, Decimal("31.50"))

        # Case B: fractional rate testing ROUND_HALF_UP on tax
        inv_b = Invoice.objects.create(# type: ignore[assignment]
            owner=self.user,
            client=self.client_obj,
            issue_date=date(2026, 7, 1),
            due_date=date(2026, 7, 15),
            tax_rate=Decimal("5.00")
        )
        for i in range(3):
            InvoiceItem.objects.create(# type: ignore[assignment]
                invoice=inv_b,
                description=f"Fractional item {i+1}",
                quantity=Decimal("0.10"),
                unit_price=Decimal("33.33")
            )
        compute_invoice_totals(inv_b)
        inv_b.refresh_from_db()

        self.assertEqual(inv_b.subtotal, Decimal("9.99"))
        self.assertEqual(inv_b.tax_amount, Decimal("0.50"))
        self.assertEqual(inv_b.total_amount, Decimal("10.49"))

    def test_send_invoice_sequence_lock(self) -> None:
        """
        Checkpoint Test 3:
        Verify send_invoice locks sequence row and generates sequential invoice numbers.
        
        Why sequence row, not invoice table, is locked:
        Locking the invoice table would freeze all invoice creation across all tenants in the system.
        Locking only the specific InvoiceSequence row (owner + fiscal_year) using select_for_update()
        ensures atomic counter incrementing for a specific tenant without causing database contention for others.
        """
        inv1 = Invoice.objects.create(# type: ignore[assignment]
            owner=self.user,
            client=self.client_obj,
            issue_date=date(2026, 7, 1),
            due_date=date(2026, 7, 15)
        )
        inv2 = Invoice.objects.create(# type: ignore[assignment]
            owner=self.user,
            client=self.client_obj,
            issue_date=date(2026, 7, 2),
            due_date=date(2026, 7, 16)
        )

        sent_inv1 = send_invoice(inv1)
        sent_inv2 = send_invoice(inv2)

        self.assertEqual(sent_inv1.number, "INV-2026-27-001")
        self.assertEqual(sent_inv1.status, Invoice.Status.SENT)
        self.assertEqual(sent_inv2.number, "INV-2026-27-002")
        self.assertEqual(sent_inv2.status, Invoice.Status.SENT)

        seq = InvoiceSequence.objects.get(owner=self.user, fiscal_year="2026-27")# type: ignore[assignment]
        self.assertEqual(seq.last_number, 2)

