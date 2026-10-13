"""
URL configuration for the reports application.
"""
from django.urls import path #type: ignore
from apps.reports.views import DashboardView, FiscalYearReportView#type: ignore

app_name = "reports"

urlpatterns = [
    # Dashboard metrics endpoint (BDT income, 6-month trend, outstanding/overdue per currency, fees by method, top clients)
    path("dashboard/", DashboardView.as_view(), name="dashboard"),
    # Fiscal year summary report endpoint with ?fy=YYYY-YY query parameter
    path("reports/fiscal-year/", FiscalYearReportView.as_view(), name="fiscal-year-report"),
]
