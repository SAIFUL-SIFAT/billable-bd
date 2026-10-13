"""
API Views for the reports and dashboard app.

Security and Authorization:
1. All endpoints require authenticated callers via rest_framework.permissions.IsAuthenticated.
2. The user identity is extracted strictly from request.user (injected by SimpleJWT), preventing
   spoofed tenant IDs in request bodies or query parameters.
"""
from typing import Any
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.reports.services import get_dashboard_data, get_fiscal_year_report


class DashboardView(APIView):
    """
    Executive financial dashboard metrics endpoint.

    Returns:
    - income_bdt_this_month: Total BDT received from payments in the current calendar month.
    - monthly_income_bdt: 6-month continuous chronological series including zero-income months.
    - outstanding_by_currency: Unpaid balances on SENT/PARTIALLY_PAID invoices grouped by currency.
    - overdue_by_currency: Past-due unpaid balances grouped by currency.
    - fees_by_method: Gateway and remittance fees broken down by currency and method.
    - top_clients: Top 5 clients this fiscal year ranked by total BDT received.
    """

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request: Any) -> Response:
        """
        Retrieve cached dashboard KPIs for the authenticated user.

        Args:
            request: DRF Request containing authenticated user.

        Returns:
            Response: 200 OK with dashboard JSON payload.
        """
        data = get_dashboard_data(request.user)
        return Response(data, status=status.HTTP_200_OK)


class FiscalYearReportView(APIView):
    """
    Fiscal year summary audit report endpoint.

    Query Parameters:
    - fy (optional): Target fiscal year in YYYY-YY format (e.g. '2026-27').
      Defaults to current fiscal year if omitted.

    Returns:
    - fy: Validated fiscal year string.
    - received_bdt: Total BDT payments received across all client invoices during the fiscal cycle.
    - invoiced_by_currency: Official invoiced receivables broken down per billing currency.
    - fees_by_currency: Deducted processor fees broken down per billing currency.
    """

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request: Any) -> Response:
        """
        Retrieve cached fiscal year report for the specified fiscal cycle.

        Args:
            request: DRF Request containing authenticated user and query parameters.

        Returns:
            Response: 200 OK with report JSON payload, or 400 BAD REQUEST if fy parameter is malformed.
        """
        fy_param = request.query_params.get("fy")
        try:
            data = get_fiscal_year_report(request.user, fy=fy_param)
            return Response(data, status=status.HTTP_200_OK)
        except ValueError as err:
            return Response({"detail": str(err)}, status=status.HTTP_400_BAD_REQUEST)
