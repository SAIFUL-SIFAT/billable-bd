from django.shortcuts import render  # type: ignore[assignment]
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework import status
from .serializers import UserSerializer, RegisterSerializer
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from .models import Profile
from .serializers import ProfileSerializer, UserProfileUpdateSerializer

from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
from django.conf import settings as django_settings# type: ignore[assignment]

class CookieTokenObtainPairView(TokenObtainPairView):
    """
    Issue access token in JSON response and secure refresh token in httpOnly cookie (US-30).
    Mitigates XSS attack vectors by preventing client JavaScript from reading the refresh token.
    """
    def post(self, request, *args, **kwargs):
        response = super().post(request, *args, **kwargs)
        if response.status_code == status.HTTP_200_OK:
            refresh_token = response.data.get("refresh")# type: ignore[assignment]
            if refresh_token:
                # Cookie flags: httpOnly=True, SameSite=Lax, Secure depending on environment
                is_secure = not django_settings.DEBUG
                response.set_cookie(
                    key="refresh_token",
                    value=refresh_token,
                    httponly=True,
                    secure=is_secure,
                    samesite="Lax",
                    max_age=7 * 24 * 60 * 60,  # 7 days
                    path="/api/accounts/",
                )
        return response


class CookieTokenRefreshView(TokenRefreshView):
    """
    Refresh access token reading refresh token from either request body OR httpOnly cookie.
    """
    def post(self, request, *args, **kwargs):
        # Fallback to cookie if refresh token not provided in JSON body
        data = request.data.copy() if hasattr(request.data, "copy") else dict(request.data)
        if "refresh" not in data or not data["refresh"]:
            cookie_refresh = request.COOKIES.get("refresh_token")
            if cookie_refresh:
                data["refresh"] = cookie_refresh
        
        serializer = self.get_serializer(data=data)
        try:
            serializer.is_valid(raise_exception=True)
        except TokenError as e:
            raise InvalidToken(e.args[0])
        
        response = Response(serializer.validated_data, status=status.HTTP_200_OK)
        # If rotation is enabled and new refresh token issued, update cookie
        new_refresh = serializer.validated_data.get("refresh")
        if new_refresh:
            is_secure = not django_settings.DEBUG
            response.set_cookie(
                key="refresh_token",
                value=new_refresh,
                httponly=True,
                secure=is_secure,
                samesite="Lax",
                max_age=7 * 24 * 60 * 60,
                path="/api/accounts/",
            )
        return response


class LogoutView(APIView):
    """Log out user by blacklisting refresh token and clearing httpOnly cookie."""
    permission_classes = [AllowAny]

    def post(self, request):
        refresh_token = request.data.get("refresh") or request.COOKIES.get("refresh_token")
        if refresh_token:
            try:
                token = RefreshToken(refresh_token)
                token.blacklist()
            except Exception:
                pass  # Token already expired or invalid
        
        response = Response({"detail": "Successfully logged out."}, status=status.HTTP_200_OK)
        response.delete_cookie("refresh_token", path="/api/accounts/")
        return response


class MeView(APIView):
    """Returns the details of the currently authenticated user."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        """
        Args: request (Request)
        Returns: Response with serialized user data.
        """
        serializer = UserSerializer(request.user, context={"request": request})
        return Response(serializer.data)

class RegisterView(APIView):
    """Handles new user registration."""
    permission_classes = [AllowAny]

    def post(self, request):
        """
        Args: request (Request)
        Returns: Response with created user data or validation errors.
        """
        serializer = RegisterSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class ProfileView(APIView):
    """Manage freelancer business profile settings."""
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get(self, request):
        """Retrieve current user's profile information."""
        profile, _ = Profile.objects.get_or_create(user=request.user) #type:ignore
        serializer = ProfileSerializer(profile, context={"request": request})
        return Response(serializer.data)

    def patch(self, request):
        """Update profile settings (business_name, address, tax_number, optional logo)."""
        profile, _ = Profile.objects.get_or_create(user=request.user)#type:ignore
        serializer = ProfileSerializer(
            profile,
            data=request.data,
            partial=True,
            context={"request": request},
        )
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class ProfileLogoDeleteView(APIView):
    """Dedicated endpoint to remove the existing profile logo."""
    permission_classes = [IsAuthenticated]

    def delete(self, request):
        """Delete logo file from storage and clear profile field."""
        profile, _ = Profile.objects.get_or_create(user=request.user)#type:ignore
        if profile.logo:
            # Delete physical file from storage backend (local disk or S3)
            profile.logo.delete(save=True)
        serializer = ProfileSerializer(profile, context={"request": request})
        return Response(serializer.data, status=status.HTTP_200_OK)


