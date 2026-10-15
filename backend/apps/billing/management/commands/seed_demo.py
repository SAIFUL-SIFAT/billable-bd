"""
Management command to populate deterministic seed data for verification.
"""
from datetime import date, timedelta
from decimal import Decimal
from django.contrib.auth import get_user_model #type: ignore
from django.core.management.base import BaseCommand #type: ignore
from django.db import transaction #type: ignore

from apps.billing.models import Invoice, InvoiceItem, Payment, TimeEntry
from apps.clients.models import Client, Project

User = get_user_model()


class Command(BaseCommand):
    """Seed command populating realistic multi-currency financial records."""

    help = "Seeds deterministic test data for dashboard and fiscal-year reporting verification."

    def handle(self, *args, **options) -> None:
        """Execute deterministic database seeding."""
        with transaction.atomic():#type: ignore
            # 1. Demo User
            user, _ = User.objects.get_or_create(
                email="demo@billable.test",
                defaults={"is_active": True},
            )
            user.set_password("password123")
            user.save()

            # 2. Clients
            client_usd, _ = Client.objects.get_or_create(#type: ignore
                owner=user,
                name="Acme Corp (USA)",
                defaults={"default_currency": "USD", "country": "US"},
            )
            client_eur, _ = Client.objects.get_or_create(#type: ignore
                owner=user,
                name="Nordic Labs (EU)",
                defaults={"default_currency": "EUR", "country": "DE"},
            )
            client_bdt, _ = Client.objects.get_or_create(#type: ignore
                owner=user,
                name="Dhaka Fintech (BD)",
                defaults={"default_currency": "BDT", "country": "BD"},
            )

            # 3. Clean existing invoices/payments for idempotency
            Payment.objects.filter(invoice__owner=user).delete()
            Invoice.objects.filter(owner=user).delete()

            # Reference date: October 12, 2026
            today = date(2026, 10, 12)

            # Invoice 1: Acme Corp (USD) - Fully Paid in current month (October 2026)
            inv1 = Invoice.objects.create(
                owner=user,
                client=client_usd,
                number="INV-FY2026-27-0001",
                status=Invoice.Status.PAID,
                issue_date=date(2026, 10, 1),
                due_date=date(2026, 10, 15),
                subtotal=Decimal("1000.00"),
                total_amount=Decimal("1000.00"),
                paid_amount=Decimal("1000.00"),
            )
            Payment.objects.create(
                invoice=inv1,
                amount_applied=Decimal("1000.00"),
                fee_amount=Decimal("25.00"),
                received_bdt=Decimal("118000.00"),
                method=Payment.Method.WISE,
                paid_on=date(2026, 10, 5),
            )

            # Invoice 2: Acme Corp (USD) - Partially Paid & OVERDUE (due Sept 24, 2026)
            inv2 = Invoice.objects.create(
                owner=user,
                client=client_usd,
                number="INV-FY2026-27-0002",
                status=Invoice.Status.PARTIALLY_PAID,
                issue_date=date(2026, 9, 10),
                due_date=date(2026, 9, 24),  # Past due -> Overdue!
                subtotal=Decimal("1500.00"),
                total_amount=Decimal("1500.00"),
                paid_amount=Decimal("500.00"),
            )
            Payment.objects.create(
                invoice=inv2,
                amount_applied=Decimal("500.00"),
                fee_amount=Decimal("15.00"),
                received_bdt=Decimal("59000.00"),
                method=Payment.Method.BANK_TRANSFER,
                paid_on=date(2026, 9, 15),
            )

            # Invoice 3: Nordic Labs (EUR) - SENT, NOT Overdue (due Oct 25, 2026)
            Invoice.objects.create(
                owner=user,
                client=client_eur,
                number="INV-FY2026-27-0003",
                status=Invoice.Status.SENT,
                issue_date=date(2026, 10, 2),
                due_date=date(2026, 10, 25),  # Future due date -> NOT overdue
                subtotal=Decimal("800.00"),
                total_amount=Decimal("800.00"),
                paid_amount=Decimal("0.00"),
            )

            # Invoice 4: Nordic Labs (EUR) - SENT, OVERDUE (due August 15, 2026)
            Invoice.objects.create(
                owner=user,
                client=client_eur,
                number="INV-FY2026-27-0004",
                status=Invoice.Status.SENT,
                issue_date=date(2026, 8, 1),
                due_date=date(2026, 8, 15),  # Past due -> Overdue!
                subtotal=Decimal("600.00"),
                total_amount=Decimal("600.00"),
                paid_amount=Decimal("0.00"),
            )

            # Invoice 5: Fiscal Year Boundary Test (June 30, 2026 -> FY 2025-26)
            inv5 = Invoice.objects.create(
                owner=user,
                client=client_usd,
                number="INV-FY2025-26-0088",
                status=Invoice.Status.PAID,
                issue_date=date(2026, 6, 30),
                due_date=date(2026, 7, 14),
                subtotal=Decimal("500.00"),
                total_amount=Decimal("500.00"),
                paid_amount=Decimal("500.00"),
            )
            Payment.objects.create(
                invoice=inv5,
                amount_applied=Decimal("500.00"),
                fee_amount=Decimal("10.00"),
                received_bdt=Decimal("58000.00"),
                method=Payment.Method.WISE,
                paid_on=date(2026, 6, 30),
            )

            # Invoice 6: Fiscal Year Boundary Test (July 1, 2026 -> FY 2026-27 start)
            inv6 = Invoice.objects.create(
                owner=user,
                client=client_bdt,
                number="INV-FY2026-27-0005",
                status=Invoice.Status.PAID,
                issue_date=date(2026, 7, 1),
                due_date=date(2026, 7, 15),
                subtotal=Decimal("25000.00"),
                total_amount=Decimal("25000.00"),
                paid_amount=Decimal("25000.00"),
            )
            Payment.objects.create(
                invoice=inv6,
                amount_applied=Decimal("25000.00"),
                fee_amount=Decimal("0.00"),
                received_bdt=Decimal("25000.00"),
                method=Payment.Method.BANK_TRANSFER,
                paid_on=date(2026, 7, 1),
            )

        self.stdout.write(self.style.SUCCESS("Successfully seeded deterministic demo data for demo@billable.test!"))#type: ignore
