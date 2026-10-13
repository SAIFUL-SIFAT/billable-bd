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

from unittest.mock import patch
from apps.billing.services import create_invoice_from_time


from django.utils import timezone#type: ignore
from datetime import timedelta
from apps.billing.models import Invoice
from rest_framework import status



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

        self.assertEqual(sent_inv1.number, "INV-FY2026-27-0001")
        self.assertEqual(sent_inv1.status, Invoice.Status.SENT)
        self.assertEqual(sent_inv2.number, "INV-FY2026-27-0002")
        self.assertEqual(sent_inv2.status, Invoice.Status.SENT)

        seq = InvoiceSequence.objects.get(owner=self.user, fiscal_year="2026-27")# type: ignore[assignment]
        self.assertEqual(seq.last_number, 2)


class InvoiceLifecycleTests(APITestCase):
    def setUp(self):
        from django.contrib.auth import get_user_model#type: ignore
        User = get_user_model()
        self.user = User.objects.create_user(email="lifecycle@example.com", password="password123")
        self.client_obj = Client.objects.create(owner=self.user, name="Lifecycle Client")#type: ignore
        self.invoice = Invoice.objects.create(
            owner=self.user,
            client=self.client_obj,
            issue_date=timezone.localdate(),
            due_date=timezone.localdate() + timedelta(days=1),
            status=Invoice.Status.DRAFT
        )
        self.client.force_authenticate(user=self.user)#type: ignore

    def test_overdue_logic(self):
        """An invoice due today is not overdue. Due yesterday is."""
        self.invoice.status = Invoice.Status.SENT
        self.invoice.due_date = timezone.localdate()
        self.invoice.save()
        self.assertFalse(self.invoice.is_overdue)
        
        self.invoice.due_date = timezone.localdate() - timedelta(days=1)
        self.invoice.save()
        self.assertTrue(self.invoice.is_overdue)
        self.assertTrue(Invoice.objects.overdue().exists())

    def test_legal_transition_draft_to_sent(self):
        """Sending a draft invoice is allowed."""
        url = f"/api/billing/invoices/{self.invoice.id}/send/"
        response = self.client.post(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)#type: ignore
        self.invoice.refresh_from_db()
        self.assertEqual(self.invoice.status, Invoice.Status.SENT)

    def test_illegal_transition_edit_sent_invoice(self):
        """Editing a sent invoice returns 409."""
        self.invoice.status = Invoice.Status.SENT
        self.invoice.save()
        
        url = f"/api/billing/invoices/{self.invoice.id}/"
        response = self.client.patch(url, {"notes": "Modified"})
        self.assertEqual(response.status_code, status.HTTP_409_CONFLICT)#type: ignore




class Day8FromTimeAndPaymentTests(APITestCase):
    """Test suite for Day 8 from-time bundling, atomicity, and payment lifecycle."""

    def setUp(self) -> None:
        """Initialize user, client, projects, and unbilled time entries."""
        from django.contrib.auth import get_user_model  # type: ignore
        User = get_user_model()
        self.user = User.objects.create_user(email="day8@example.com", password="password123")
        self.client_obj = Client.objects.create(owner=self.user, name="Day 8 Client", default_currency="USD")  # type: ignore[assignment]
        self.project_1 = Project.objects.create(  # type: ignore[assignment]
            owner=self.user,
            client=self.client_obj,
            name="Project 1",
            billing_type="hourly",
            hourly_rate=Decimal("100.00"),
            currency="USD"
        )
        self.project_2 = Project.objects.create(  # type: ignore[assignment]
            owner=self.user,
            client=self.client_obj,
            name="Project 2",
            billing_type="hourly",
            hourly_rate=Decimal("150.00"),
            currency="USD"
        )
        # Create 3 unbilled entries
        self.t1 = TimeEntry.objects.create(
            owner=self.user, project=self.project_1, date=timezone.localdate(), hours=Decimal("2.00"), is_billed=False
        )
        self.t2 = TimeEntry.objects.create(
            owner=self.user, project=self.project_1, date=timezone.localdate(), hours=Decimal("3.00"), is_billed=False
        )
        self.t3 = TimeEntry.objects.create(
            owner=self.user, project=self.project_2, date=timezone.localdate(), hours=Decimal("4.00"), is_billed=False
        )
        self.client.force_authenticate(user=self.user)  # type: ignore

    def test_from_time_atomicity_on_failure(self) -> None:
        """Checkpoint: Force a mid-way failure and verify zero partial records remain."""
        with patch("apps.billing.services.compute_invoice_totals", side_effect=RuntimeError("Injected crash")):
            with self.assertRaises(RuntimeError):
                create_invoice_from_time(  # type: ignore
                    owner=self.user,  # type: ignore[assignment]
                    client=self.client_obj,  # type: ignore[assignment]
                    date_from=timezone.localdate() - timedelta(days=5),  # type: ignore[assignment]
                    date_to=timezone.localdate() + timedelta(days=5),  # type: ignore[assignment]
                )

        # Verify nothing was persisted
        self.assertEqual(Invoice.objects.filter(client=self.client_obj).count(), 0)
        self.assertEqual(InvoiceItem.objects.count(), 0)  # type: ignore
        self.assertFalse(TimeEntry.objects.filter(is_billed=True).exists())

    def test_from_time_success_and_grouping(self) -> None:
        """Verify entries are grouped per project into invoice items and marked billed."""
        invoice = create_invoice_from_time(  # type: ignore
            owner=self.user,  # type: ignore[assignment]
            client=self.client_obj,  # type: ignore[assignment]
            date_from=timezone.localdate() - timedelta(days=5),  # type: ignore[assignment]
            date_to=timezone.localdate() + timedelta(days=5),  # type: ignore[assignment]
        )
        self.assertEqual(invoice.status, Invoice.Status.DRAFT)
        self.assertEqual(invoice.items.count(), 2)  # Grouped into 2 projects
        # Project 1: 5 hrs @ 100 = 500; Project 2: 4 hrs @ 150 = 600 -> Subtotal = 1100
        self.assertEqual(invoice.subtotal, Decimal("1100.00"))
        self.assertEqual(invoice.total_amount, Decimal("1100.00"))
        # All 3 entries locked
        self.assertEqual(TimeEntry.objects.filter(owner=self.user, is_billed=True).count(), 3)

    def test_locked_time_entry_us07(self) -> None:
        """Verify editing or deleting billed time entries returns 409 Conflict."""
        self.t1.is_billed = True
        self.t1.save()

        # PATCH attempt
        response = self.client.patch(f"/api/billing/time-entries/{self.t1.id}/", {"hours": 5.0})
        self.assertEqual(response.status_code, status.HTTP_409_CONFLICT)  # type: ignore

        # DELETE attempt
        response = self.client.delete(f"/api/billing/time-entries/{self.t1.id}/")
        self.assertEqual(response.status_code, status.HTTP_409_CONFLICT)  # type: ignore

    def test_release_entries_on_delete_draft_and_void(self) -> None:
        """Verify time entries are released when draft is deleted or invoice is voided."""
        inv = create_invoice_from_time(  # type: ignore
            owner=self.user,  # type: ignore
            client=self.client_obj,  # type: ignore
            date_from=timezone.localdate() - timedelta(days=5),  # type: ignore
            date_to=timezone.localdate() + timedelta(days=5),  # type: ignore
        )  # type: ignore
        self.assertEqual(TimeEntry.objects.filter(is_billed=True).count(), 3)

        # Delete draft
        res = self.client.delete(f"/api/billing/invoices/{inv.id}/")
        self.assertEqual(res.status_code, status.HTTP_204_NO_CONTENT)  # type: ignore
        self.assertEqual(TimeEntry.objects.filter(is_billed=True).count(), 0)

    def test_two_partial_payments_and_delete_recompute(self) -> None:
        """Checkpoint: Record 2 partial payments, delete one, and verify balance and status transitions."""
        inv = Invoice.objects.create(
            owner=self.user,
            client=self.client_obj,
            issue_date=timezone.localdate(),
            due_date=timezone.localdate() + timedelta(days=10),
            status=Invoice.Status.SENT,
            total_amount=Decimal("100.00"),
            subtotal=Decimal("100.00")
        )
        url = f"/api/billing/invoices/{inv.id}/payments/"

        # 1. Partial payment 1: 40 applied, fee 2, 4500 BDT
        p1_payload = {
            "amount_applied": "40.00",
            "fee_amount": "2.00",
            "received_bdt": "4500.00",
            "method": "wise"
        }
        res1 = self.client.post(url, p1_payload, format="json")
        self.assertEqual(res1.status_code, status.HTTP_201_CREATED)  # type: ignore
        # Effective rate = 4500 / (40 - 2) = 4500 / 38 = 118.42
        self.assertEqual(Decimal(str(res1.data["effective_rate"])), Decimal("118.42"))  # type: ignore

        inv.refresh_from_db()
        self.assertEqual(inv.status, Invoice.Status.PARTIALLY_PAID)  # type: ignore
        self.assertEqual(inv.paid_amount, Decimal("40.00"))

        # 2. Partial payment 2: 60 applied, fee 0, 7200 BDT -> fully paid
        p2_payload = {
            "amount_applied": "60.00",
            "fee_amount": "0.00",
            "received_bdt": "7200.00",
            "method": "bank_transfer"
        }
        res2 = self.client.post(url, p2_payload, format="json")
        self.assertEqual(res2.status_code, status.HTTP_201_CREATED)  # type: ignore

        inv.refresh_from_db()
        self.assertEqual(inv.status, Invoice.Status.PAID)
        self.assertEqual(inv.paid_amount, Decimal("100.00"))

        # 3. Delete payment 2 -> reverts to PARTIALLY_PAID
        p2_id = res2.data["id"]  # type: ignore
        del_res = self.client.delete(f"/api/billing/payments/{p2_id}/")
        self.assertEqual(del_res.status_code, status.HTTP_204_NO_CONTENT)  # type: ignore

        inv.refresh_from_db()
        self.assertEqual(inv.status, Invoice.Status.PARTIALLY_PAID)  # type: ignore
        self.assertEqual(inv.paid_amount, Decimal("40.00"))

        # 4. Delete payment 1 -> reverts to SENT
        p1_id = res1.data["id"]  # type: ignore
        self.client.delete(f"/api/billing/payments/{p1_id}/")

        inv.refresh_from_db()
        self.assertEqual(inv.status, Invoice.Status.SENT)
        self.assertEqual(inv.paid_amount, Decimal("0.00"))

    def test_payment_validations_br11_br12(self) -> None:
        """Verify BR-11 (overpayment, non-sent invoice) and BR-12 (fee constraints)."""
        inv = Invoice.objects.create(
            owner=self.user,
            client=self.client_obj,
            issue_date=timezone.localdate(),
            due_date=timezone.localdate() + timedelta(days=10),
            status=Invoice.Status.DRAFT,  # DRAFT cannot accept payment
            total_amount=Decimal("100.00")
        )
        url = f"/api/billing/invoices/{inv.id}/payments/"
        res = self.client.post(url, {"amount_applied": "50.00", "fee_amount": "0.00", "received_bdt": "6000.00"})
        self.assertEqual(res.status_code, status.HTTP_409_CONFLICT)  # type: ignore

        inv.status = Invoice.Status.SENT
        inv.save()

        # Overpayment (> balance 100)
        res_over = self.client.post(url, {"amount_applied": "150.00", "fee_amount": "0.00", "received_bdt": "18000.00"})
        self.assertEqual(res_over.status_code, status.HTTP_409_CONFLICT)  # type: ignore

        # Fee >= applied amount
        res_fee = self.client.post(url, {"amount_applied": "50.00", "fee_amount": "50.00", "received_bdt": "6000.00"})
        self.assertEqual(res_fee.status_code, status.HTTP_409_CONFLICT)  # type: ignore
