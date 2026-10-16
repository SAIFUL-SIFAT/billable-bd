from typing import TYPE_CHECKING
from rest_framework import serializers  # type: ignore[assignment]
from django.contrib.auth import get_user_model  # type: ignore[assignment]
from django.contrib.auth.password_validation import validate_password  # type: ignore[assignment]
from .models import Profile, User as UserModel

User = get_user_model()

class UserSerializer(serializers.ModelSerializer):
    """Serializer for the /me/ endpoint, exposing safe user details and logo."""
    logo_url = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = User
        fields = ('id', 'email', 'first_name', 'last_name', 'logo_url')
        read_only_fields = fields

    def get_logo_url(self, obj: UserModel) -> str | None:
        """Return the absolute URL of the user's profile logo if uploaded."""
        profile = getattr(obj, "profile", None)
        if profile and profile.logo:
            request = self.context.get("request")
            if request is not None:
                return request.build_absolute_uri(profile.logo.url)
            return profile.logo.url
        return None

class RegisterSerializer(serializers.ModelSerializer):
    """Handles new user registration, enforcing password validation and email normalization."""
    password = serializers.CharField(write_only=True,required=True,validators=[validate_password])

    class Meta:
        model = User
        fields = ('email', 'password', 'first_name', 'last_name')

    def validate_email(self, value: str) -> str:
        """Normalize the email to lowercase to prevent duplicate signups with varying cases.
        
        Args:
            value (str): The provided email string.
        Returns:
            str: The lowercased email.
        """
        
        return value.lower()

    def create(self, validated_data: dict):
        """Creates the user securely by using create_user which hashes the password.
        
        Args:
            validated_data (dict): The validated input data.
        Returns:
            User: The created user instance.
        """
        user = User.objects.create_user(
            email = validated_data['email'],
            password = validated_data['password'],
            first_name = validated_data.get('first_name', ''),
            last_name = validated_data.get('last_name', '')
        )
        return user

class ProfileSerializer(serializers.ModelSerializer):
    """Serializes freelancer business branding and logo settings."""
    logo_url = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = Profile
        fields = (
            "id",
            "business_name",
            "business_address",
            "tax_number",
            "tax_rate_presets",
            "custom_exchange_rate",
            "logo",
            "logo_url",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "created_at", "updated_at", "logo_url")

    def get_logo_url(self, obj: Profile) -> str | None:
        """Build absolute URL for logo image if it exists.

        Args:
            obj: Profile instance.

        Returns:
            str | None: Full URL for frontend consumption or None.
        """
        if not obj.logo:
            return None
        request = self.context.get("request")
        if request is not None:
            return request.build_absolute_uri(obj.logo.url) #type: ignore
        return obj.logo.url #type: ignore


class UserProfileUpdateSerializer(serializers.ModelSerializer):
    """Serializes User first_name, last_name, and nested Profile data."""
    profile = ProfileSerializer(read_only=True)

    class Meta:
        model = User
        fields = ("id", "email", "first_name", "last_name", "profile")
        read_only_fields = ("id", "email", "profile")

