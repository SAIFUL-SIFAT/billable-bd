from rest_framework.routers import DefaultRouter # type: ignore[assignment]
from apps.clients.views import ClientViewSet, ProjectViewSet # type: ignore[assignment]

router = DefaultRouter()
router.register(r'clients', ClientViewSet, basename='client')
router.register(r'projects', ProjectViewSet, basename='project')

urlpatterns = router.urls
