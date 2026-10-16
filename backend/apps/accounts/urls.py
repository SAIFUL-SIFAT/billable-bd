from django.urls import path # type: ignore[assignment]
from .views import (
    MeView,
    RegisterView,
    ProfileView,
    ProfileLogoDeleteView,
    CookieTokenObtainPairView,
    CookieTokenRefreshView,
    LogoutView,
)

urlpatterns = [
    path('register/', RegisterView.as_view(), name='register'),
    path('login/', CookieTokenObtainPairView.as_view(), name='login'),
    path('refresh/', CookieTokenRefreshView.as_view(), name='refresh'),
    path('logout/', LogoutView.as_view(), name='logout'),
    path('me/', MeView.as_view(), name='me'),
    path('profile/', ProfileView.as_view(), name='profile-detail'),
    path('profile/logo/', ProfileLogoDeleteView.as_view(), name='profile-logo-delete'),
]