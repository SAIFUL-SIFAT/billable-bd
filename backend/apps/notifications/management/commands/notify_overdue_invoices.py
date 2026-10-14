from datetime import date, datetime
from typing import Any
from django.core.management.base import BaseCommand, CommandParser#type:ignore
from django.utils import timezone#type:ignore

from apps.billing.models import Invoice
from apps.notifications.models import Notification


class Command(BaseCommand):
    """Management command to scan for overdue invoices and notify invoice owners.

    Command Options:
        --today: Optional string date in YYYY-MM-DD format to simulate running on a specific date.
    """

    help = "Scan for overdue invoices and generate notifications idempotently using dedupe_key."

    def add_arguments(self, parser: CommandParser) -> None:
        """Define command-line arguments for the management command."""
        parser.add_argument(
            "--today",
            type=str,
            help="Override the evaluation date in YYYY-MM-DD format (defaults to current local date).",
        )

    def handle(self, *args: Any, **options: Any) -> None:
        """Execute the overdue invoice check and create notifications.
        """
        today_str = options.get("today")
        if today_str:
            try:
                target_date = datetime.strptime(today_str, "%Y-%m-%d").date()
            except ValueError:
                self.stderr.write(self.style.ERROR(f"Invalid date format '{today_str}'. Expected YYYY-MM-DD."))#type:ignore
                return
        else:
            target_date = timezone.localdate()

        self.stdout.write(f"Checking for overdue invoices as of {target_date}...")

        # Select invoices eligible for overdue notification
        overdue_invoices = (
            Invoice.objects.filter(
                status__in=[Invoice.Status.SENT, Invoice.Status.PARTIALLY_PAID],
                due_date__lt=target_date,
            )
            .select_related("owner", "client")
        )

        created_count = 0
        skipped_count = 0

        for invoice in overdue_invoices:
            # Deterministic dedupe key per invoice and due date cycle
            dedupe_key = f"overdue:invoice:{invoice.id}:{invoice.due_date}"
            inv_identifier = invoice.number or f"#{invoice.id}"
            message = (
                f"Invoice {inv_identifier} for {invoice.client.name} "
                f"is overdue (due on {invoice.due_date})."
            )

            # get_or_create enforces idempotency via the unique dedupe_key constraint
            _, created = Notification.objects.get_or_create(#type:ignore
                dedupe_key=dedupe_key,
                defaults={
                    "user": invoice.owner,
                    "kind": Notification.Kind.INVOICE_OVERDUE,
                    "message": message,
                    "invoice": invoice,
                    "is_read": False,
                },
            )

            if created:
                created_count += 1
            else:
                skipped_count += 1

        self.stdout.write(
            self.style.SUCCESS(#type:ignore
                f"Overdue processing complete. Created: {created_count}, Skipped (already notified): {skipped_count}."
            )
        )
