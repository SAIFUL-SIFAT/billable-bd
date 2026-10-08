"""
Billing App URL Routing Configuration.

API Endpoint Architecture:
Uses DRF's DefaultRouter to register TimeEntryViewSet under the /time-entries/ namespace.
Automatically generates RESTful routes for:
- GET /api/billing/time-entries/ (List time entries)
- POST /api/billing/time-entries/ (Create time entry)
- GET /api/billing/time-entries/{id}/ (Retrieve time entry)
- DELETE /api/billing/time-entries/{id}/ (Delete time entry)
- GET /api/billing/time-entries/totals/ (Filtered summary totals)
"""

from django.urls import path, include # type: ignore[assignment]
from rest_framework.routers import DefaultRouter
from apps.billing.views import TimeEntryViewSet # type: ignore[assignment]

router = DefaultRouter()
router.register(r'time-entries', TimeEntryViewSet, basename='time-entry')

urlpatterns = [
    path('', include(router.urls)),
]
