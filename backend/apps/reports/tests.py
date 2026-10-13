"""
Automated unit and integration test suite for the reports and dashboard app.
"""
from datetime import date, timedelta
from decimal import Decimal
from django.contrib.auth import get_user_model#type: ignore
from django.core.cache import cache#type: ignore
from django.utils import timezone#type: ignore
from rest_framework import status
from rest_framework.test import APITestCase

from apps.billing.models import Invoice, Payment
from apps.clients.models import Client
from apps.core.utils import fiscal_year_for

User = get_user_model()


class DashboardViewTests(APITestCase):
    """Test suite for GET /api/dashboard/ endpoint."""

    def setUp(self) -> None:
        cache.clear()
        self.user_a = User.objects.create_user(email="alice@example.com", password="password123")  # type: ignore[assignment]
        self.user_b = User.objects.create_user(email="bob@example.com", password="password123")  # type: ignore[assignment]

        # Clients for user_a
        self.client_usd = Client.objects.create(owner=self.user_a, name="Acme Corp (US)", default_currency="USD")  # type: ignore[assignment]
        self.client_eur = Client.objects.create(owner=self.user_a, name="Globex (EU)", default_currency="EUR")  # type: ignore[assignment]
        self.client_bdt = Client.objects.create(owner=self.user_a, name="Dhaka Tech", default_currency="BDT")  # type: ignore[assignment]

        self.today = timezone.localdate()

    def test_unauthenticated_request_returns_401(self) -> None:
        """Unauthenticated requests must be blocked by DRF permission classes."""
        response = self.client.get("/api/dashboard/")
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)#type: ignore

    def test_currency_isolation_and_no_mixing(self) -> None:
        """
        BR-13: Outstanding receivables must group strictly by currency.
        Summing USD and EUR balances into a single mixed number is prohibited.
        """
        self.client.force_authenticate(user=self.user_a)#type: ignore

        # Create USD invoice: $1,000 total, $200 paid -> $800 outstanding
        inv_usd = Invoice.objects.create(
            owner=self.user_a,
            client=self.client_usd,
            number="INV-USD-001",
            status=Invoice.Status.SENT,
            issue_date=self.today,
            due_date=self.today + timedelta(days=14),
            subtotal=Decimal("1000.00"),
            total_amount=Decimal("1000.00"),
            paid_amount=Decimal("200.00"),
        )

        # Create EUR invoice: €500 total, €0 paid -> €500 outstanding
        inv_eur = Invoice.objects.create(
            owner=self.user_a,
            client=self.client_eur,
            number="INV-EUR-001",
            status=Invoice.Status.SENT,
            issue_date=self.today,
            due_date=self.today + timedelta(days=14),
            subtotal=Decimal("500.00"),
            total_amount=Decimal("500.00"),
            paid_amount=Decimal("0.00"),
        )

        response = self.client.get("/api/dashboard/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)#type: ignore
        data = response.json()#type: ignore

        outstanding_map = {row["currency"]: row["amount"] for row in data["outstanding_by_currency"]}
        self.assertIn("USD", outstanding_map)
        self.assertIn("EUR", outstanding_map)
        self.assertEqual(outstanding_map["USD"], "800.00")
        self.assertEqual(outstanding_map["EUR"], "500.00")

    def test_six_month_series_includes_zero_months(self) -> None:
        """The 6-month continuous series must contain exactly 6 elements with zero-months filled."""
        self.client.force_authenticate(user=self.user_a)#type: ignore

        # Record a single payment in the current month
        inv = Invoice.objects.create(
            owner=self.user_a,
            client=self.client_usd,
            number="INV-USD-002",
            status=Invoice.Status.PAID,
            issue_date=self.today,
            due_date=self.today,
            subtotal=Decimal("100.00"),
            total_amount=Decimal("100.00"),
            paid_amount=Decimal("100.00"),
        )
        Payment.objects.create(
            invoice=inv,
            amount_applied=Decimal("100.00"),
            fee_amount=Decimal("3.00"),
            received_bdt=Decimal("11800.00"),
            method=Payment.Method.WISE,
            paid_on=self.today,
        )

        response = self.client.get("/api/dashboard/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)#type: ignore
        data = response.json()#type: ignore

        monthly = data["monthly_income_bdt"]
        self.assertEqual(len(monthly), 6)

        # Current month has income; previous months should have '0.00'
        current_month_key = self.today.strftime("%Y-%m")
        self.assertEqual(monthly[-1]["month"], current_month_key)
        self.assertEqual(monthly[-1]["amount"], "11800.00")
        self.assertEqual(monthly[0]["amount"], "0.00")

    def test_overdue_invoices_properly_filtered(self) -> None:
        """An invoice due today is NOT overdue; only due_date < today is overdue."""
        self.client.force_authenticate(user=self.user_a)#type: ignore

        # Due today (not overdue)
        Invoice.objects.create(
            owner=self.user_a,
            client=self.client_usd,
            number="INV-DUE-TODAY",
            status=Invoice.Status.SENT,
            issue_date=self.today - timedelta(days=7),
            due_date=self.today,
            subtotal=Decimal("300.00"),
            total_amount=Decimal("300.00"),
            paid_amount=Decimal("0.00"),
        )
        # Due yesterday (is overdue)
        Invoice.objects.create(
            owner=self.user_a,
            client=self.client_usd,
            number="INV-DUE-YESTERDAY",
            status=Invoice.Status.SENT,
            issue_date=self.today - timedelta(days=14),
            due_date=self.today - timedelta(days=1),
            subtotal=Decimal("700.00"),
            total_amount=Decimal("700.00"),
            paid_amount=Decimal("0.00"),
        )

        response = self.client.get("/api/dashboard/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)#type: ignore
        data = response.json()#type: ignore

        overdue_map = {row["currency"]: row["amount"] for row in data["overdue_by_currency"]}
        outstanding_map = {row["currency"]: row["amount"] for row in data["outstanding_by_currency"]}

        # Overdue should only reflect the 700.00 invoice
        self.assertEqual(overdue_map.get("USD"), "700.00")
        # Outstanding should reflect both (300 + 700 = 1000.00)
        self.assertEqual(outstanding_map.get("USD"), "1000.00")

    def test_per_user_cache_isolation(self) -> None:
        """Cached dashboard data for User A must never leak to User B."""
        # Seed User A data
        Invoice.objects.create(
            owner=self.user_a,
            client=self.client_usd,
            number="INV-A-1",
            status=Invoice.Status.SENT,
            issue_date=self.today,
            due_date=self.today + timedelta(days=7),
            subtotal=Decimal("5000.00"),
            total_amount=Decimal("5000.00"),
            paid_amount=Decimal("0.00"),
        )

        # Request as User A
        self.client.force_authenticate(user=self.user_a)#type: ignore
        res_a = self.client.get("/api/dashboard/")
        self.assertEqual(res_a.json()["outstanding_by_currency"][0]["amount"], "5000.00")#type: ignore

        # Request as User B (has zero invoices)
        self.client.force_authenticate(user=self.user_b)#type: ignore
        res_b = self.client.get("/api/dashboard/")
        self.assertEqual(res_b.json()["outstanding_by_currency"], [])#type: ignore


class FiscalYearReportViewTests(APITestCase):
    """Test suite for GET /api/reports/fiscal-year/ endpoint."""

    def setUp(self) -> None:
        cache.clear()
        self.user = User.objects.create_user(email="carol@example.com", password="password123")  # type: ignore[assignment]
        self.client_usd = Client.objects.create(owner=self.user, name="Beta Corp", default_currency="USD")  # type: ignore[assignment]
        self.client.force_authenticate(user=self.user)#type: ignore

    def test_invalid_fiscal_year_format_returns_400(self) -> None:
        """Malformed FY parameter must be rejected with HTTP 400 Bad Request."""
        response = self.client.get("/api/reports/fiscal-year/?fy=invalid-fy")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)#type: ignore
        self.assertIn("detail", response.json())#type: ignore

        response2 = self.client.get("/api/reports/fiscal-year/?fy=2026-28")
        self.assertEqual(response2.status_code, status.HTTP_400_BAD_REQUEST)#type: ignore

    def test_fiscal_year_report_aggregates_within_boundaries(self) -> None:
        """Records inside FY 2026-27 (2026-07-01 to 2027-06-30) must be counted; others excluded."""
        # Payment inside FY 2026-27 (Aug 15, 2026)
        inv1 = Invoice.objects.create(
            owner=self.user,
            client=self.client_usd,
            number="INV-FY-001",
            status=Invoice.Status.PAID,
            issue_date=date(2026, 8, 10),
            due_date=date(2026, 8, 24),
            subtotal=Decimal("2000.00"),
            total_amount=Decimal("2000.00"),
            paid_amount=Decimal("2000.00"),
        )
        Payment.objects.create(
            invoice=inv1,
            amount_applied=Decimal("2000.00"),
            fee_amount=Decimal("50.00"),
            received_bdt=Decimal("240000.00"),
            method=Payment.Method.WISE,
            paid_on=date(2026, 8, 15),
        )

        # Payment outside FY 2026-27 (June 20, 2026 -> falls in FY 2025-26)
        inv2 = Invoice.objects.create(
            owner=self.user,
            client=self.client_usd,
            number="INV-FY-PREV",
            status=Invoice.Status.PAID,
            issue_date=date(2026, 6, 10),
            due_date=date(2026, 6, 24),
            subtotal=Decimal("1000.00"),
            total_amount=Decimal("1000.00"),
            paid_amount=Decimal("1000.00"),
        )
        Payment.objects.create(
            invoice=inv2,
            amount_applied=Decimal("1000.00"),
            fee_amount=Decimal("25.00"),
            received_bdt=Decimal("120000.00"),
            method=Payment.Method.WISE,
            paid_on=date(2026, 6, 20),
        )

        response = self.client.get("/api/reports/fiscal-year/?fy=2026-27")
        self.assertEqual(response.status_code, status.HTTP_200_OK)#type: ignore
        data = response.json()#type: ignore

        self.assertEqual(data["fy"], "2026-27")
        # Only inv1 should be counted
        self.assertEqual(data["received_bdt"], "240000.00")
        self.assertEqual(data["invoiced_by_currency"][0]["total"], "2000.00")
        self.assertEqual(data["fees_by_currency"][0]["total"], "50.00")
