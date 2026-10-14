from typing import Any
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend #type:ignore
from rest_framework.filters import OrderingFilter

from apps.notifications.models import Notification
from apps.notifications.serializers import NotificationSerializer


class NotificationViewSet(viewsets.ReadOnlyModelViewSet):
    """ViewSet for managing and reading user notifications.

    Provides list, retrieve, mark-as-read, and mark-all-read operations.
    Creation and deletion are prohibited through standard endpoints.
    """

    serializer_class = NotificationSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, OrderingFilter]
    filterset_fields = ["is_read", "kind"]
    ordering_fields = ["created_at"]
    ordering = ["-created_at"]

    def get_queryset(self) -> Any:
        """Return only notifications belonging to the authenticated caller.

        Returns:
            Notification queryset filtered by the authenticated user.
        """
        return Notification.objects.filter(user=self.request.user).select_related("invoice")#type:ignore

    @action(detail=True, methods=["post"], url_path="read")
    def mark_read(self, request: Request, pk: Any = None) -> Response:
        """Mark a specific notification as read.

        Args:
            request: Incoming HTTP request.
            pk: Primary key of target notification.

        Returns:
            Response containing updated notification details.
        """
        notification = self.get_object()
        if not notification.is_read:
            notification.is_read = True
            notification.save(update_fields=["is_read"])
        return Response(self.get_serializer(notification).data, status=status.HTTP_200_OK)

    @action(detail=False, methods=["post"], url_path="read-all")
    def mark_all_read(self, request: Request) -> Response:
        """Mark all unread notifications of the current user as read.

        Args:
            request: Incoming HTTP request.

        Returns:
            Response with count of updated records.
        """
        updated_count = self.get_queryset().filter(is_read=False).update(is_read=True)
        return Response({"updated": updated_count}, status=status.HTTP_200_OK)
