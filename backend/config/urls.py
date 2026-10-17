"""URL configuration for config project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/6.1/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""

from django.contrib import admin  # type: ignore[assignment]
from django.urls import path  # type: ignore[assignment]
from django.urls import include  # type: ignore[assignment]
from django.conf import settings# type: ignore[assignment]
from django.conf.urls.static import static# type: ignore[assignment]
from django.http import JsonResponse# type: ignore[assignment]

def health_check(request):
    """Lightweight healthcheck endpoint for uptime monitors and keep-alive crons."""
    return JsonResponse({"status": "ok"})

urlpatterns = [
    path("health/", health_check, name="health-check"),
    path("api/health/", health_check, name="api-health-check"),
    path("admin/", admin.site.urls),
    path("api/accounts/", include("apps.accounts.urls")),
    path("api/", include("apps.clients.urls")),
    path("api/billing/", include("apps.billing.urls")),
    path("api/", include("apps.reports.urls")),
    path("api/", include("apps.notifications.urls")),
]


if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)



