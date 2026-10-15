from django.shortcuts import render  # type: ignore[assignment]
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework import status
from .serializers import UserSerializer, RegisterSerializer
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from .models import Profile
from .serializers import ProfileSerializer, UserProfileUpdateSerializer

class MeView(APIView):
    """Returns the details of the currently authenticated user."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        """
        Args: request (Request)
        Returns: Response with serialized user data.
        """
        serializer = UserSerializer(request.user)
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


