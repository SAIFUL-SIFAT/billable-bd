from django.contrib.auth import get_user_model #type:ignore
from rest_framework.test import APITestCase
from rest_framework import status

from apps.notifications.models import Notification
from datetime import date, timedelta
from decimal import Decimal
from io import StringIO
from django.core.management import call_command#type:ignore
from apps.clients.models import Client
from apps.billing.models import Invoice


User = get_user_model()


class NotificationAPITests(APITestCase):
    """Integration tests for notification endpoints and multi-tenant scoping."""

    def setUp(self) -> None:
        """Initialize two distinct users with sample notifications."""
        self.user_a = User.objects.create_user(email="user_a@test.com", password="password123")
        self.user_b = User.objects.create_user(email="user_b@test.com", password="password123")

        # Notifications for User A
        self.notif_a1 = Notification.objects.create(#type:ignore
            user=self.user_a,
            kind=Notification.Kind.INVOICE_OVERDUE,
            message="Invoice INV-001 is overdue.",
            is_read=False,
        )
        self.notif_a2 = Notification.objects.create(#type:ignore
            user=self.user_a,
            kind=Notification.Kind.PAYMENT_RECEIVED,
            message="Payment of 100 received.",
            is_read=True,
        )

        # Notification for User B
        self.notif_b = Notification.objects.create(#type:ignore
            user=self.user_b,
            kind=Notification.Kind.INVOICE_OVERDUE,
            message="Invoice INV-999 is overdue for User B.",
            is_read=False,
        )

    def test_list_notifications_tenant_isolation(self) -> None:
        """Ensure user only sees their own notifications."""
        self.client.force_authenticate(user=self.user_a) #type: ignore
        res = self.client.get("/api/notifications/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)#type:ignore
        ids = [n["id"] for n in res.data["results"]] #type: ignore
        self.assertIn(self.notif_a1.id, ids)
        self.assertIn(self.notif_a2.id, ids)
        self.assertNotIn(self.notif_b.id, ids)

    def test_filter_unread_notifications(self) -> None:
        """Ensure filtering with is_read=false returns only unread items."""
        self.client.force_authenticate(user=self.user_a) #type: ignore
        res = self.client.get("/api/notifications/?is_read=false")
        self.assertEqual(res.status_code, status.HTTP_200_OK)#type:ignore
        self.assertEqual(len(res.data["results"]), 1) #type: ignore
        self.assertEqual(res.data["results"][0]["id"], self.notif_a1.id) #type: ignore

    def test_mark_individual_notification_read(self) -> None:
        """Ensure POST /api/notifications/{id}/read/ updates is_read to true."""
        self.client.force_authenticate(user=self.user_a) #type: ignore
        res = self.client.post(f"/api/notifications/{self.notif_a1.id}/read/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)#type:ignore
        self.notif_a1.refresh_from_db()
        self.assertTrue(self.notif_a1.is_read)

    def test_cannot_mark_other_user_notification_read(self) -> None:
        """Ensure User A cannot mark User B's notification as read (returns 404)."""
        self.client.force_authenticate(user=self.user_a) #type: ignore
        res = self.client.post(f"/api/notifications/{self.notif_b.id}/read/")
        self.assertEqual(res.status_code, status.HTTP_404_NOT_FOUND)#type:ignore
        self.notif_b.refresh_from_db()
        self.assertFalse(self.notif_b.is_read)

    def test_mark_all_read(self) -> None:
        """Ensure POST /api/notifications/read-all/ marks all unread items as read for caller."""
        self.client.force_authenticate(user=self.user_a) #type: ignore
        res = self.client.post("/api/notifications/read-all/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)#type:ignore
        self.assertEqual(res.data["updated"], 1) #type: ignore
        self.notif_a1.refresh_from_db()
        self.assertTrue(self.notif_a1.is_read)
        # User B notification remains unread
        self.notif_b.refresh_from_db()
        self.assertFalse(self.notif_b.is_read)



class NotifyOverdueInvoicesCommandTests(APITestCase):
    """Integration tests for the notify_overdue_invoices management command."""

    def setUp(self) -> None:
        """Initialize user, client, and invoices with varying statuses and due dates."""
        self.user = User.objects.create_user(email="freelancer@test.com", password="password123")
        self.client_obj = Client.objects.create(owner=self.user, name="Acme Corp")#type:ignore

        self.today = date(2026, 10, 14)
        yesterday = self.today - timedelta(days=1)
        tomorrow = self.today + timedelta(days=1)

        # Overdue invoice: SENT and due yesterday
        self.overdue_inv = Invoice.objects.create(
            owner=self.user,
            client=self.client_obj,
            status=Invoice.Status.SENT,
            issue_date=self.today - timedelta(days=30),
            due_date=yesterday,
            total_amount=Decimal("1000.00"),
        )

        # Future invoice: SENT and due tomorrow (NOT overdue)
        self.future_inv = Invoice.objects.create(
            owner=self.user,
            client=self.client_obj,
            status=Invoice.Status.SENT,
            issue_date=self.today,
            due_date=tomorrow,
            total_amount=Decimal("500.00"),
        )

        # Draft invoice: due yesterday but DRAFT status (NOT eligible)
        self.draft_inv = Invoice.objects.create(
            owner=self.user,
            client=self.client_obj,
            status=Invoice.Status.DRAFT,
            issue_date=self.today - timedelta(days=30),
            due_date=yesterday,
            total_amount=Decimal("200.00"),
        )

    def test_command_creates_overdue_notification_and_is_idempotent(self) -> None:
        """Run command twice and assert exactly 1 notification is created total."""
        out = StringIO()

        # First run: should create 1 notification for overdue_inv
        call_command("notify_overdue_invoices", "--today", "2026-10-14", stdout=out)
        self.assertEqual(Notification.objects.filter(user=self.user).count(), 1)#type:ignore

        notif = Notification.objects.get(user=self.user)#type:ignore
        self.assertEqual(notif.kind, Notification.Kind.INVOICE_OVERDUE)
        self.assertEqual(notif.invoice, self.overdue_inv)
        self.assertIn("overdue:invoice:", str(notif.dedupe_key))

        # Second run (checkpoint test): should create 0 new notifications
        out_second = StringIO()
        call_command("notify_overdue_invoices", "--today", "2026-10-14", stdout=out_second)
        self.assertEqual(Notification.objects.filter(user=self.user).count(), 1)#type:ignore
        self.assertIn("Created: 0, Skipped (already notified): 1", out_second.getvalue())

