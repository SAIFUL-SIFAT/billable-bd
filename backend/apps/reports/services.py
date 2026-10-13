"""
Analytics and financial aggregation domain services for the reports app.

Performance and Isolation Guarantees:
1. Multi-Tenant Scoping: Every single query enforces owner=user (or invoice__owner=user)
   directly at the database level, ensuring cross-tenant leakage is mathematically impossible.
2. Currency Integrity (BR-13): Financial ledgers NEVER sum heterogeneous currencies into a
   single number. Only BDT payments (received_bdt) are summed across foreign currencies. All
   receivables, overdue amounts, and invoice totals are strictly grouped by currency.
3. Zero-Month Continuous Series: Time-series queries using SQL TruncMonth skip months with zero
   activity; our service layer generates a continuous calendar bucket list and merges SQL rows
   to guarantee a gap-free 6-month historical array for visualization.
4. Per-User Caching: Dashboard and report results are cached using Redis/LocMemCache with user-scoped
   keys (e.g. dashboard:{user_id}), protecting against cross-user cache contamination.
"""
import re
from datetime import date, timedelta
from decimal import Decimal
from typing import Any, Dict, List, Optional

from django.contrib.auth import get_user_model #type: ignore
from django.core.cache import cache#type: ignore
from django.db.models import DecimalField, F, Sum#type: ignore
from django.db.models.functions import Coalesce, TruncMonth#type: ignore
from django.utils import timezone#type: ignore

from apps.billing.models import Invoice, Payment
from apps.core.utils import fiscal_year_for, quantize_money

User = get_user_model()

FY_REGEX = re.compile(r"^(\d{4})-(\d{2})$")


def get_dashboard_data(user: Any) -> Dict[str, Any]:
    """
    Compute comprehensive dashboard financial indicators for an authenticated user.

    Calculates:
    1. BDT received this calendar month.
    2. 6-month continuous chronological trend of BDT income (zero months included).
    3. Outstanding receivables grouped strictly by currency (SENT and PARTIALLY_PAID).
    4. Overdue receivables grouped strictly by currency (past due date).
    5. Payment gateway fees grouped by currency and payment method.
    6. Top 5 clients this fiscal year ranked by total BDT received.

    Results are cached for 60 seconds per user to maintain high read throughput.

    Args:
        user: Authenticated User model instance.

    Returns:
        Dict[str, Any]: Structured dashboard payload matching PRD/TRD specification.
    """
    cache_key = f"dashboard:{user.id}"
    cached_result = cache.get(cache_key)
    if cached_result is not None:
        return cached_result

    today: date = timezone.localdate()

    month_income_agg = Payment.objects.filter(
        invoice__owner=user,
        paid_on__year=today.year,
        paid_on__month=today.month,
    ).aggregate(
        total=Coalesce(
            Sum("received_bdt"),
            Decimal("0.00"),
            output_field=DecimalField(max_digits=14, decimal_places=2),
        )
    )
    income_bdt_this_month = str(quantize_money(month_income_agg["total"]))


    buckets: List[str] = []
    for i in range(5, -1, -1):
        m_calc = today.month - i
        y_calc = today.year
        while m_calc <= 0:
            m_calc += 12
            y_calc -= 1
        buckets.append(f"{y_calc:04d}-{m_calc:02d}")

    start_y, start_m = int(buckets[0][:4]), int(buckets[0][5:7])
    range_start_date = date(start_y, start_m, 1)


    monthly_qs = (
        Payment.objects.filter(
            invoice__owner=user,
            paid_on__gte=range_start_date,
            paid_on__lte=today,
        )
        .annotate(month=TruncMonth("paid_on"))
        .values("month")
        .annotate(
            total=Coalesce(
                Sum("received_bdt"),
                Decimal("0.00"),
                output_field=DecimalField(max_digits=14, decimal_places=2),
            )
        )
        .order_by("month")
    )

    income_map: Dict[str, Decimal] = {b: Decimal("0.00") for b in buckets}
    for row in monthly_qs:
        m_date: date = row["month"]
        m_key = m_date.strftime("%Y-%m")
        if m_key in income_map:
            income_map[m_key] = row["total"]

    monthly_income_bdt = [
        {"month": b, "amount": str(quantize_money(income_map[b]))}
        for b in buckets
    ]

    outstanding_qs = (
        Invoice.objects.filter(
            owner=user,
            status__in=[Invoice.Status.SENT, Invoice.Status.PARTIALLY_PAID],
        )
        .values("client__default_currency")
        .annotate(
            amount=Coalesce(
                Sum(
                    F("total_amount") - F("paid_amount"),
                    output_field=DecimalField(max_digits=14, decimal_places=2),
                ),
                Decimal("0.00"),
                output_field=DecimalField(max_digits=14, decimal_places=2),
            )
        )
        .order_by("client__default_currency")
    )
    outstanding_by_currency = [
        {"currency": row["client__default_currency"], "amount": str(quantize_money(row["amount"]))}
        for row in outstanding_qs
    ]

    overdue_qs = (
        Invoice.objects.filter(
            owner=user,
            status__in=[Invoice.Status.SENT, Invoice.Status.PARTIALLY_PAID],
            due_date__lt=today,
        )
        .values("client__default_currency")
        .annotate(
            amount=Coalesce(
                Sum(
                    F("total_amount") - F("paid_amount"),
                    output_field=DecimalField(max_digits=14, decimal_places=2),
                ),
                Decimal("0.00"),
                output_field=DecimalField(max_digits=14, decimal_places=2),
            )
        )
        .order_by("client__default_currency")
    )
    overdue_by_currency = [
        {"currency": row["client__default_currency"], "amount": str(quantize_money(row["amount"]))}
        for row in overdue_qs
    ]

    fees_qs = (
        Payment.objects.filter(invoice__owner=user)
        .values("invoice__client__default_currency", "method")
        .annotate(
            total=Coalesce(
                Sum("fee_amount"),
                Decimal("0.00"),
                output_field=DecimalField(max_digits=12, decimal_places=2),
            )
        )
        .order_by("invoice__client__default_currency", "method")
    )
    fees_by_method = [
        {
            "currency": row["invoice__client__default_currency"],
            "method": row["method"],
            "total": str(quantize_money(row["total"])),
        }
        for row in fees_qs
    ]

    current_fy = fiscal_year_for(today)
    fy_start_y = int(current_fy[:4])
    fy_start_date = date(fy_start_y, 7, 1)
    fy_end_date = date(fy_start_y + 1, 6, 30)

    top_clients_qs = (
        Payment.objects.filter(
            invoice__owner=user,
            paid_on__gte=fy_start_date,
            paid_on__lte=fy_end_date,
        )
        .values("invoice__client_id", "invoice__client__name")
        .annotate(
            received_bdt=Coalesce(
                Sum("received_bdt"),
                Decimal("0.00"),
                output_field=DecimalField(max_digits=14, decimal_places=2),
            )
        )
        .order_by("-received_bdt")[:5]
    )
    top_clients = [
        {
            "client_id": row["invoice__client_id"],
            "client_name": row["invoice__client__name"],
            "received_bdt": str(quantize_money(row["received_bdt"])),
        }
        for row in top_clients_qs
    ]

    payload: Dict[str, Any] = {
        "income_bdt_this_month": income_bdt_this_month,
        "monthly_income_bdt": monthly_income_bdt,
        "outstanding_by_currency": outstanding_by_currency,
        "overdue_by_currency": overdue_by_currency,
        "fees_by_method": fees_by_method,
        "top_clients": top_clients,
    }

    # Cache metrics for 60 seconds per user
    cache.set(cache_key, payload, timeout=60)
    return payload


def get_fiscal_year_report(user: Any, fy: Optional[str] = None) -> Dict[str, Any]:
    """
    Generate fiscal year audit report covering July 1 through June 30.

    Aggregates:
    1. Total BDT received from all client payments in the fiscal cycle.
    2. Total billed receivables grouped by invoice currency.
    3. Total gateway fees deducted grouped by payment currency.

    Args:
        user: Authenticated User model instance.
        fy: Fiscal year parameter (e.g. "2026-27"). Defaults to current FY if omitted.

    Returns:
        Dict[str, Any]: Structured fiscal year summary report.

    Raises:
        ValueError: If the fy parameter is malformed or invalid format.
    """
    today: date = timezone.localdate()
    target_fy = fy if fy else fiscal_year_for(today)

    # Validate format YYYY-YY
    match = FY_REGEX.match(target_fy)
    if not match:
        raise ValueError("Invalid fiscal year format. Expected YYYY-YY (e.g. 2026-27).")

    start_year = int(match.group(1))
    end_year_short = int(match.group(2))
    expected_short = (start_year + 1) % 100
    if end_year_short != expected_short:
        raise ValueError(
            f"Invalid fiscal year sequence. End year '{end_year_short:02d}' does not follow start year '{start_year}'."
        )

    cache_key = f"report_fy:{user.id}:{target_fy}"
    cached_result = cache.get(cache_key)
    if cached_result is not None:
        return cached_result

    fy_start = date(start_year, 7, 1)
    fy_end = date(start_year + 1, 6, 30)

    received_bdt_agg = Payment.objects.filter(
        invoice__owner=user,
        paid_on__gte=fy_start,
        paid_on__lte=fy_end,
    ).aggregate(
        total=Coalesce(
            Sum("received_bdt"),
            Decimal("0.00"),
            output_field=DecimalField(max_digits=14, decimal_places=2),
        )
    )
    received_bdt = str(quantize_money(received_bdt_agg["total"]))

    invoiced_qs = (
        Invoice.objects.filter(
            owner=user,
            issue_date__gte=fy_start,
            issue_date__lte=fy_end,
            status__in=[
                Invoice.Status.SENT,
                Invoice.Status.PARTIALLY_PAID,
                Invoice.Status.PAID,
            ],
        )
        .values("client__default_currency")
        .annotate(
            total=Coalesce(
                Sum("total_amount"),
                Decimal("0.00"),
                output_field=DecimalField(max_digits=14, decimal_places=2),
            )
        )
        .order_by("client__default_currency")
    )
    invoiced_by_currency = [
        {"currency": row["client__default_currency"], "total": str(quantize_money(row["total"]))}
        for row in invoiced_qs
    ]

    fees_qs = (
        Payment.objects.filter(
            invoice__owner=user,
            paid_on__gte=fy_start,
            paid_on__lte=fy_end,
        )
        .values("invoice__client__default_currency")
        .annotate(
            total=Coalesce(
                Sum("fee_amount"),
                Decimal("0.00"),
                output_field=DecimalField(max_digits=12, decimal_places=2),
            )
        )
        .order_by("invoice__client__default_currency")
    )
    fees_by_currency = [
        {"currency": row["invoice__client__default_currency"], "total": str(quantize_money(row["total"]))}
        for row in fees_qs
    ]

    payload: Dict[str, Any] = {
        "fy": target_fy,
        "received_bdt": received_bdt,
        "invoiced_by_currency": invoiced_by_currency,
        "fees_by_currency": fees_by_currency,
    }

    cache.set(cache_key, payload, timeout=60)
    return payload
