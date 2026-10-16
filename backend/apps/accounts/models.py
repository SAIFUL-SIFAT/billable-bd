from django.db import models # type: ignore[assignment]
from django.contrib.auth.models import AbstractUser, BaseUserManager # type: ignore[assignment]
import os
from django.core.exceptions import ValidationError# type: ignore[assignment]
from PIL import Image
class UserManager(BaseUserManager):
    use_in_migrations = True

    def _create_user(self, email, password, **extra_fields):
        if not email:
            raise ValueError('The given email must be set')
        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user


    def create_user(self, email, password=None, **extra_fields):
        extra_fields.setdefault('is_staff', False)
        extra_fields.setdefault('is_superuser', False)
        return self._create_user(email, password, **extra_fields)

    
    def create_superuser(self, email, password, **extra_fields):
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)

        if extra_fields.get('is_staff') is not True:
            raise ValueError('Superuser must have is_staff=True.')
        if extra_fields.get('is_superuser') is not True:
            raise ValueError('Superuser must have is_superuser=True.')

        return self._create_user(email, password, **extra_fields)       

class User(AbstractUser):
    username = None  # type: ignore[assignment]
    email = models.EmailField('email address', unique=True)

    USERNAME_FIELD = 'email'        
    REQUIRED_FIELDS = []

    objects = UserManager()  # type: ignore[assignment]

    def __str__(self):
        return self.email


def user_logo_path(instance: "Profile", filename: str) -> str:
    """Generate upload storage path scoped to the user ID.

    Args:
        instance: Profile model instance.
        filename: Original client-provided filename.

    Returns:
        str: Sanitized path e.g. 'logos/user_1/filename.png'.
    """
    # Keep base filename and clean directory
    clean_name = os.path.basename(filename)
    return f"logos/user_{instance.user_id}/{clean_name}" #type: ignore


def validate_logo_file(file) -> None:
    """Server-side validation for profile logo uploads.

    Enforces:
    1. Max file size: 2MB (2 * 1024 * 1024 bytes).
    2. File extension: .png, .jpg, .jpeg, .webp.
    3. Content inspection: Uses Pillow Image.open to parse image header/signature
       and verify the payload contains valid raster pixels, not spoofed executable text.

    Args:
        file: UploadedFile object passed from DRF or Django forms.

    Raises:
        ValidationError: If size, extension, or image decoding fails.
    """
    max_size_bytes = 2 * 1024 * 1024  # 2 Megabytes
    if file.size > max_size_bytes:
        raise ValidationError(f"File size exceeds 2MB limit (size: {file.size / (1024 * 1024):.2f}MB).")

    ext = os.path.splitext(file.name)[1].lower()
    allowed_extensions = {".png", ".jpg", ".jpeg", ".webp"}
    if ext not in allowed_extensions:
        raise ValidationError(f"Unsupported file extension '{ext}'. Allowed: {', '.join(allowed_extensions)}")

    # Deep Content Inspection using Pillow:
    # An attacker can rename 'shell.php' to 'shell.png'. Checking extension or MIME type
    # only reads the client-controlled header. Pillow inspects the binary magic bytes.
    try:
        file.seek(0)
        image = Image.open(file)
        image.verify()  # Verifies image header and integrity without decoding entire raster
        # NOTE: Reset file read pointer back to beginning so storage backend can read it for saving
        file.seek(0)
    except Exception as exc:
        file.seek(0)
        raise ValidationError("Uploaded file is not a valid image or is corrupted.") from exc


class Profile(models.Model):
    """Extended profile holding freelancer branding and invoice preferences.

    Attributes:
        user: OneToOne link to authenticated User.
        business_name: Name of company or freelancer practice appearing on invoices.
        business_address: Physical or mailing address for invoice sender section.
        tax_number: Tax identification or BIN number in Bangladesh.
        logo: Optional branding image verified by validate_logo_file.
        created_at: Creation timestamp.
        updated_at: Last modification timestamp.
    """
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="profile")
    business_name = models.CharField(max_length=255, blank=True, default="")
    business_address = models.TextField(blank=True, default="")
    tax_number = models.CharField(max_length=100, blank=True, default="")
    logo = models.ImageField(
        upload_to=user_logo_path,
        validators=[validate_logo_file],
        null=True,
        blank=True,
    )
    # Tier 2: Tax rate presets (e.g. [0, 5, 15]) and custom BDT exchange rate estimate
    tax_rate_presets = models.JSONField(default=list, blank=True)
    custom_exchange_rate = models.DecimalField(
        max_digits=10, decimal_places=2, null=True, blank=True,
        help_text="User-defined BDT conversion rate override per USD/EUR base"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self) -> str:
        return self.business_name or self.user.email # type: ignore[return-value]

