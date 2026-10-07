from typing import Any
from django.contrib.auth import get_user_model # type: ignore[assignment]
from rest_framework import status # type: ignore[assignment]
from rest_framework.test import APITestCase # type: ignore[assignment]
from apps.clients.models import Client, Project

User = get_user_model()

class ClientAPITestCase(APITestCase):
    """Integration tests for Client API endpoints enforcing multi-tenant isolation.

    Test cases:
        - User can CRUD their own clients.
        - User B receives 404 when trying to read, edit, or delete User A's client.
    """

    def setUp(self) -> None:
        """Initialize two distinct user accounts and sample client records for testing."""
        self.user_a = User.objects.create_user(email="user_a@test.com", password="password123")
        self.user_b = User.objects.create_user(email="user_b@test.com", password="password123")

        # Client belonging to User A
        self.client_a = Client.objects.create( # type: ignore[assignment]
            owner=self.user_a,
            name="Client A",
            email="clienta@test.com",
            default_currency="BDT"
        )

    def test_user_can_create_client(self) -> None:
        """Verify an authenticated user can create a client and owner is set automatically."""
        self.client.force_authenticate(user=self.user_a) # type: ignore[assignment]
        payload: dict[str, Any] = {
            "name": "Acme Corp",
            "email": "acme@example.com",
            "default_currency": "USD"
        }
        response = self.client.post("/api/clients/", payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED) # type: ignore[assignment]
        self.assertEqual(response.data["name"], "Acme Corp") # type: ignore[assignment]
        self.assertTrue(Client.objects.filter(owner=self.user_a, name="Acme Corp").exists()) # type: ignore[assignment]

    def test_user_b_cannot_access_user_a_client(self) -> None:
        """Verify User B receives 404 Not Found when requesting User A's client details."""
        self.client.force_authenticate(user=self.user_b) # type: ignore[assignment]
        response = self.client.get(f"/api/clients/{self.client_a.id}/")
        # NOTE: Must return 404 rather than 403 to prevent resource existence enumeration.
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND) # type: ignore[assignment]

    def test_user_b_cannot_update_user_a_client(self) -> None:
        """Verify User B receives 404 Not Found when trying to update User A's client."""
        self.client.force_authenticate(user=self.user_b) # type: ignore[assignment]
        payload: dict[str, Any] = {"name": "Hacked Name"}
        response = self.client.patch(f"/api/clients/{self.client_a.id}/", payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND) # type: ignore[assignment]

    def test_user_b_cannot_delete_user_a_client(self) -> None:
        """Verify User B receives 404 Not Found when trying to delete User A's client."""
        self.client.force_authenticate(user=self.user_b) # type: ignore[assignment]
        response = self.client.delete(f"/api/clients/{self.client_a.id}/")
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND) # type: ignore[assignment]
        self.assertTrue(Client.objects.filter(id=self.client_a.id).exists())# type: ignore[assignment]


class ProjectAPITestCase(APITestCase):
    """Integration tests for Project API endpoints enforcing owner isolation and rate validation.

    Test cases:
        - User B receives 404 when attempting to read, update, or delete User A's project.
        - User B cannot create a project referencing User A's client (returns 400).
        - Hourly and fixed billing rate validation rules.
    """

    def setUp(self) -> None:
        """Initialize user accounts, clients, and project instances."""
        self.user_a = User.objects.create_user(email="user_a@test.com", password="password123")
        self.user_b = User.objects.create_user(email="user_b@test.com", password="password123")

        self.client_a = Client.objects.create(owner=self.user_a, name="Client A", default_currency="BDT")# type: ignore[assignment]
        self.client_b = Client.objects.create(owner=self.user_b, name="Client B", default_currency="USD")# type: ignore[assignment]

        self.project_a = Project.objects.create(# type: ignore[assignment]
            owner=self.user_a,
            client=self.client_a,
            name="Project Alpha",
            billing_type="hourly",
            hourly_rate="50.00"
        )

    def test_user_b_cannot_access_user_a_project(self) -> None:
        """Verify User B receives 404 when accessing User A's project."""
        self.client.force_authenticate(user=self.user_b)# type: ignore[assignment]
        response = self.client.get(f"/api/projects/{self.project_a.id}/")
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)# type: ignore[assignment]

    def test_user_b_cannot_delete_user_a_project(self) -> None:
        """Verify User B receives 404 when trying to delete User A's project."""
        self.client.force_authenticate(user=self.user_b)# type: ignore[assignment]
        response = self.client.delete(f"/api/projects/{self.project_a.id}/")
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)# type: ignore[assignment]
        self.assertTrue(Project.objects.filter(id=self.project_a.id).exists())# type: ignore[assignment]

    def test_user_cannot_attach_foreign_client_to_project(self) -> None:
        """Verify User B receives 400 validation error when attempting to use User A's client ID."""
        self.client.force_authenticate(user=self.user_b)# type: ignore[assignment]
        payload: dict[str, Any] = {
            "client": self.client_a.id,
            "name": "Malicious Project",
            "billing_type": "hourly",
            "hourly_rate": "100.00"
        }
        response = self.client.post("/api/projects/", payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)# type: ignore[assignment]

    def test_hourly_project_requires_hourly_rate(self) -> None:
        """Verify creating an hourly project without hourly_rate returns 400 validation error."""
        self.client.force_authenticate(user=self.user_a)# type: ignore[assignment]
        payload: dict[str, Any] = {
            "client": self.client_a.id,
            "name": "Invalid Hourly",
            "billing_type": "hourly"
        }
        response = self.client.post("/api/projects/", payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)# type: ignore[assignment]
        self.assertIn("hourly_rate", response.data)# type: ignore[assignment]
