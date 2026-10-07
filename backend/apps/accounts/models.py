from django.db import models # type: ignore[assignment]
from django.contrib.auth.models import AbstractUser, BaseUserManager # type: ignore[assignment]

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


class Profile(models.Model):

    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profile')

    def __str__(self) -> str:
        return self.user.email # type: ignore[return-value]
