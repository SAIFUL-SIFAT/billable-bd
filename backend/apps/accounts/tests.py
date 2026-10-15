from django.test import TestCase#type:ignore
import io
import pytest
from PIL import Image
from django.core.files.uploadedfile import SimpleUploadedFile#type:ignore
from rest_framework.test import APIClient
from rest_framework import status
from apps.accounts.models import User, Profile

@pytest.mark.django_db
class TestProfileSettingsAndUploads:
    """Integration tests for freelancer profile settings and secure logo uploads."""

    @pytest.fixture(autouse=True)
    def setup(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            email="freelancer@billable.test",
            password="password123",
            first_name="Rahim",
            last_name="Uddin",
        )
        self.client.force_authenticate(user=self.user)

    def create_mock_image(self, format="PNG", size=(100, 100), color="blue") -> SimpleUploadedFile:
        """Generate an in-memory valid raster image file."""
        image_buffer = io.BytesIO()
        img = Image.new("RGB", size, color=color)
        img.save(image_buffer, format=format)
        image_buffer.seek(0)
        return SimpleUploadedFile(
            f"logo.{format.lower()}",
            image_buffer.read(),
            content_type=f"image/{format.lower()}",
        )

    def test_get_profile_auto_creates_instance(self):
        """GET /api/accounts/profile/ returns 200 and auto-initializes profile."""
        res = self.client.get("/api/accounts/profile/")
        assert res.status_code == status.HTTP_200_OK#type:ignore
        assert "business_name" in res.data#type:ignore
        assert Profile.objects.filter(user=self.user).exists()#type:ignore

    def test_patch_profile_metadata(self):
        """PATCH /api/accounts/profile/ updates business details successfully."""
        payload = {
            "business_name": "Rahim Code Labs",
            "business_address": "Dhanmondi, Dhaka-1209, Bangladesh",
            "tax_number": "BIN-9876543210",
        }
        res = self.client.patch("/api/accounts/profile/", payload, format="json")
        assert res.status_code == status.HTTP_200_OK#type:ignore
        assert res.data["business_name"] == "Rahim Code Labs"#type:ignore
        assert res.data["tax_number"] == "BIN-9876543210"#type:ignore

    def test_upload_valid_logo_image(self):
        """Uploading a legitimate PNG image succeeds and updates logo_url."""
        valid_file = self.create_mock_image("PNG")
        res = self.client.patch(
            "/api/accounts/profile/",
            {"logo": valid_file},
            format="multipart",
        )
        assert res.status_code == status.HTTP_200_OK#type:ignore
        assert res.data["logo"] is not None#type:ignore
        assert "logo" in res.data["logo"]#type:ignore

    def test_reject_php_file_renamed_to_png(self):
        """CHECKPOINT: A .php script renamed to .png MUST be rejected by server validation.

        Even though the filename ends in .png and Content-Type is 'image/png',
        Pillow's Image.open(file).verify() inspects the payload and raises an exception
        because the bytes contain '<?php echo "evil"; ?>' rather than PNG magic bytes.
        """
        malicious_php_payload = b"<?php phpinfo(); system($_GET['cmd']); ?>"
        spoofed_file = SimpleUploadedFile(
            "exploit.png",
            malicious_php_payload,
            content_type="image/png",
        )
        res = self.client.patch(
            "/api/accounts/profile/",
            {"logo": spoofed_file},
            format="multipart",
        )
        assert res.status_code == status.HTTP_400_BAD_REQUEST#type:ignore
        # Verify error message specifically highlights image corruption/validation failure
        error_str = str(res.data)#type:ignore
        assert "not a valid image" in error_str or "corrupted" in error_str

    def test_reject_oversized_file(self):
        """Uploading a file exceeding 2MB limit is rejected with 400 Bad Request."""
        # Start with valid raster PNG bytes from helper
        valid_image = self.create_mock_image("PNG")
        # Append padding to exceed 2MB limit (2MB + 1KB)
        oversized_bytes = valid_image.read() + b"\x00" * (2 * 1024 * 1024 + 1024)
        oversized_file = SimpleUploadedFile(
            "heavy.png",
            oversized_bytes,
            content_type="image/png",
        )
        res = self.client.patch(
            "/api/accounts/profile/",
            {"logo": oversized_file},
            format="multipart",
        )
        assert res.status_code == status.HTTP_400_BAD_REQUEST  # type: ignore
        assert "File size exceeds 2MB limit" in str(res.data)  # type: ignore

    def test_reject_oversized_file(self):
        """Uploading a file exceeding 2MB limit is rejected with 400 Bad Request."""
        oversized_bytes = b"0" * (2 * 1024 * 1024 + 1024)  # 2MB + 1KB
        oversized_file = SimpleUploadedFile(
            "heavy.png",
            oversized_bytes,
            content_type="image/png",
        )
        res = self.client.patch(
            "/api/accounts/profile/",
            {"logo": oversized_file},
            format="multipart",
        )
        assert res.status_code == status.HTTP_400_BAD_REQUEST#type:ignore
        assert "File size exceeds 2MB limit" in str(res.data)#type:ignore

    def test_delete_profile_logo(self):
        """DELETE /api/accounts/profile/logo/ clears the logo from profile."""
        # First attach a logo
        profile, _ = Profile.objects.get_or_create(user=self.user)#type:ignore
        profile.logo = self.create_mock_image("PNG")
        profile.save()

        res = self.client.delete("/api/accounts/profile/logo/")
        assert res.status_code == status.HTTP_200_OK#type:ignore
        assert res.data["logo"] is None#type:ignore
        profile.refresh_from_db()
        assert not profile.logo

