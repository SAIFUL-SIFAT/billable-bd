from django.shortcuts import render  # type: ignore[assignment]
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework import status
from .serializers import UserSerializer, RegisterSerializer

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

