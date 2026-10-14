from django.urls import include, path #type: ignore
from rest_framework.routers import DefaultRouter
from apps.notifications.views import NotificationViewSet #type: ignore

router = DefaultRouter()
router.register(r"notifications", NotificationViewSet, basename="notification")

urlpatterns = [
    path("", include(router.urls)),
]
