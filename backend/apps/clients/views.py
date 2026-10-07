from typing import Any
from django.db.models import QuerySet # type: ignore[assignment]
from rest_framework import viewsets, permissions, filters # type: ignore[assignment]
from django_filters.rest_framework import DjangoFilterBackend # type: ignore[assignment]
from apps.clients.models import Client, Project
from apps.clients.serializers import ClientSerializer, ProjectSerializer

class ClientViewSet(viewsets.ModelViewSet):
    """ViewSet for performing CRUD operations on Client records.

    Responsibilities:
        - Restrict client access strictly to the authenticated owner.
        - Automatically set owner field upon client creation.
        - Support filtering, searching, and sorting across client fields.
    """

    serializer_class = ClientSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['default_currency', 'country']
    search_fields = ['name', 'company', 'email']
    ordering_fields = ['name', 'created_at']
    ordering = ['-created_at']

    def get_queryset(self) -> QuerySet[Client]:
        """Filter client queryset so users can only view their own clients.

        Returns:
            QuerySet[Client]: QuerySet of Client records belonging to the requesting user.
        """
        # NOTE: Filtering by owner at the queryset level ensures foreign resources return 404 instead of 403.
        return Client.objects.filter(owner=self.request.user)# type: ignore[assignment]

    def perform_create(self, serializer: ClientSerializer) -> None:
        """Inject the authenticated user as the owner when creating a client instance.

        Args:
            serializer (ClientSerializer): The validated client serializer.
        """
        serializer.save(owner=self.request.user)

class ProjectViewSet(viewsets.ModelViewSet):
    """ViewSet for performing CRUD operations on Project records.

    Responsibilities:
        - Restrict project access strictly to the authenticated owner.
        - Use select_related('client') to prevent N+1 queries when building client names.
        - Provide filtering by client, billing_type, and archived status.
    """

    serializer_class = ProjectSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['client', 'billing_type', 'is_archived', 'currency']
    search_fields = ['name', 'client__name']
    ordering_fields = ['name', 'created_at']
    ordering = ['-created_at']

    def get_queryset(self) -> QuerySet[Project]:
        """Filter project queryset to current owner and prefetch related client.

        Returns:
            QuerySet[Project]: QuerySet of Project records for current user with client prefetched.
        """
        # NOTE: select_related('client') performs an INNER JOIN to fetch client details in a single query.
        return Project.objects.filter(owner=self.request.user).select_related('client')# type: ignore[assignment]

    def perform_create(self, serializer: ProjectSerializer) -> None:
        """Inject the authenticated user as owner when creating a project instance.

        Args:
            serializer (ProjectSerializer): The validated project serializer.
        """
        serializer.save(owner=self.request.user)
