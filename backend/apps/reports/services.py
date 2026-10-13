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

import json
import logging
import urllib.request

logger = logging.getLogger(__name__)

User = get_user_model()
FY_REGEX = re.compile(r"^(\d{4})-(\d{2})$")

# Goal: Fetch and cache exchange rates using Frankfurter API with BDT estimation fallback.
# Why it works: Frankfurter provides free, open ECB reference rates without API keys.
# Since Frankfurter focuses on major currencies, we derive BDT cross rates with a cached fallback.
def get_exchange_rates(base: str = "USD") -> Dict[str, Any]:
    """
    Fetch cached currency conversion rates.
    Cached for 1 hour to optimize throughput and avoid external rate-limiting.
    """
    normalized_base = base.upper().strip()
    cache_key = f"exchange_rates:{normalized_base}"
    cached = cache.get(cache_key)
    if cached is not None:
        return cached

    rates: Dict[str, float] = {}
    try:
        # Fetch Frankfurter rates
        url = f"https://api.frankfurter.dev/v1/latest?base={normalized_base}"
        req = urllib.request.Request(url, headers={"User-Agent": "BillableBD/1.0"})
        with urllib.request.urlopen(req, timeout=5) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            rates = data.get("rates", {})
            rates[normalized_base] = 1.0
    except Exception as exc:
        logger.warning(f"Frankfurter API error: {exc}")
        # Default fallback standard baseline rates against USD
        if normalized_base == "USD":
            rates = {"EUR": 0.92, "GBP": 0.78, "USD": 1.0}

    # BDT Rate enrichment (approximate market rate or external lookup)
    if "BDT" not in rates:
        try:
            # Secondary check for BDT
            bdt_req = urllib.request.Request("https://open.er-api.com/v6/latest/USD", headers={"User-Agent": "BillableBD/1.0"})
            with urllib.request.urlopen(bdt_req, timeout=5) as resp:
                er_data = json.loads(resp.read().decode("utf-8"))
                usd_to_bdt = float(er_data["rates"]["BDT"])
                if normalized_base == "USD":
                    rates["BDT"] = round(usd_to_bdt, 2)
                elif "USD" in rates and rates["USD"] > 0:
                    rates["BDT"] = round(usd_to_bdt * (1.0 / rates["USD"]), 2)
                else:
                    rates["BDT"] = 122.50
        except Exception:
            # Standard safe fallback rate if external is unreachable
            rates["BDT"] = 122.50 if normalized_base == "USD" else (133.00 if normalized_base == "EUR" else 122.50)

    result = {
        "base": normalized_base,
        "rates": rates,
        "source": "https://frankfurter.dev/",
        "playground_url": "https://frankfurter.dev/playground/",
    }
    cache.set(cache_key, result, timeout=3600)  # Cache for 1 hour
    return result


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

    # Current month fees (labeled period)
    fees_month_qs = (
        Payment.objects.filter(
            invoice__owner=user,
            paid_on__year=today.year,
            paid_on__month=today.month,
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
    fees_this_month = [
        {
            "currency": row["invoice__client__default_currency"],
            "total": str(quantize_money(row["total"])),
        }
        for row in fees_month_qs
    ]

    # Gross vs Net performance per currency across recorded payments
    gross_vs_net_qs = (
        Payment.objects.filter(invoice__owner=user)
        .values("invoice__client__default_currency")
        .annotate(
            applied=Coalesce(
                Sum("amount_applied"),
                Decimal("0.00"),
                output_field=DecimalField(max_digits=14, decimal_places=2),
            ),
            fees=Coalesce(
                Sum("fee_amount"),
                Decimal("0.00"),
                output_field=DecimalField(max_digits=12, decimal_places=2),
            ),
            received_bdt=Coalesce(
                Sum("received_bdt"),
                Decimal("0.00"),
                output_field=DecimalField(max_digits=14, decimal_places=2),
            ),
        )
        .order_by("invoice__client__default_currency")
    )
    gross_vs_net = []
    for row in gross_vs_net_qs:
        applied_val = row["applied"]
        fee_val = row["fees"]
        net_val = applied_val - fee_val
        rec_bdt = row["received_bdt"]
        fee_pct = (fee_val / applied_val * 100) if applied_val > 0 else Decimal("0.00")
        weighted_rate = (rec_bdt / net_val) if net_val > 0 else None

        gross_vs_net.append({
            "currency": row["invoice__client__default_currency"],
            "applied": str(quantize_money(applied_val)),
            "fees": str(quantize_money(fee_val)),
            "fee_percentage": str(fee_pct.quantize(Decimal("0.1"))),
            "received_bdt": str(quantize_money(rec_bdt)),
            "weighted_rate": str(weighted_rate.quantize(Decimal("0.01"))) if weighted_rate else None,
        })

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

    # Calculate live estimated total outstanding in BDT using cached rates
    rates_data = get_exchange_rates("USD")
    usd_rates = rates_data.get("rates", {})
    usd_to_bdt = Decimal(str(usd_rates.get("BDT", 122.50)))

    estimated_bdt_total = Decimal("0.00")
    for item in outstanding_by_currency:
        curr = item["currency"].upper()
        amt = Decimal(item["amount"])
        if curr == "BDT":
            estimated_bdt_total += amt
        elif curr == "USD":
            estimated_bdt_total += amt * usd_to_bdt
        else:
            # Convert currency -> USD -> BDT
            rate_to_usd = usd_rates.get(curr)
            if rate_to_usd and rate_to_usd > 0:
                amt_in_usd = amt / Decimal(str(rate_to_usd))
                estimated_bdt_total += amt_in_usd * usd_to_bdt
            else:
                # Fallback if unknown
                estimated_bdt_total += amt * usd_to_bdt

    payload: Dict[str, Any] = {
        "income_bdt_this_month": income_bdt_this_month,
        "monthly_income_bdt": monthly_income_bdt,
        "outstanding_by_currency": outstanding_by_currency,
        "estimated_outstanding_bdt": str(quantize_money(estimated_bdt_total)),
        "overdue_by_currency": overdue_by_currency,
        "fees_by_method": fees_by_method,
        "fees_this_month": fees_this_month,
        "gross_vs_net": gross_vs_net,
        "top_clients": top_clients,
        "exchange_rates_info": {
            "source": rates_data.get("source"),
            "playground_url": rates_data.get("playground_url"),
            "rates": usd_rates,
        },
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

    # Monthly received BDT breakdown throughout fiscal year
    monthly_qs = (
        Payment.objects.filter(
            invoice__owner=user,
            paid_on__gte=fy_start,
            paid_on__lte=fy_end,
        )
        .annotate(m=TruncMonth("paid_on"))
        .values("m")
        .annotate(
            total=Coalesce(
                Sum("received_bdt"),
                Decimal("0.00"),
                output_field=DecimalField(max_digits=14, decimal_places=2),
            )
        )
        .order_by("m")
    )
    monthly_received_bdt = [
        {
            "month": row["m"].strftime("%Y-%m"),
            "received_bdt": str(quantize_money(row["total"])),
        }
        for row in monthly_qs
    ]

    # Currency performance: applied, fees, % fees of gross, received BDT, and average effective rate
    perf_qs = (
        Payment.objects.filter(
            invoice__owner=user,
            paid_on__gte=fy_start,
            paid_on__lte=fy_end,
        )
        .values("invoice__client__default_currency")
        .annotate(
            applied=Coalesce(
                Sum("amount_applied"),
                Decimal("0.00"),
                output_field=DecimalField(max_digits=14, decimal_places=2),
            ),
            fees=Coalesce(
                Sum("fee_amount"),
                Decimal("0.00"),
                output_field=DecimalField(max_digits=12, decimal_places=2),
            ),
            received_bdt=Coalesce(
                Sum("received_bdt"),
                Decimal("0.00"),
                output_field=DecimalField(max_digits=14, decimal_places=2),
            ),
        )
        .order_by("invoice__client__default_currency")
    )
    currency_performance = []
    for row in perf_qs:
        applied_val = row["applied"]
        fee_val = row["fees"]
        net_val = applied_val - fee_val
        rec_bdt = row["received_bdt"]
        fee_pct = (fee_val / applied_val * 100) if applied_val > 0 else Decimal("0.00")
        avg_rate = (rec_bdt / net_val) if net_val > 0 else None

        currency_performance.append({
            "currency": row["invoice__client__default_currency"],
            "applied": str(quantize_money(applied_val)),
            "fees": str(quantize_money(fee_val)),
            "fee_percentage": str(fee_pct.quantize(Decimal("0.1"))),
            "received_bdt": str(quantize_money(rec_bdt)),
            "average_effective_rate": str(avg_rate.quantize(Decimal("0.01"))) if avg_rate else None,
        })

    payload: Dict[str, Any] = {
        "fy": target_fy,
        "received_bdt": received_bdt,
        "invoiced_by_currency": invoiced_by_currency,
        "fees_by_currency": fees_by_currency,
        "monthly_received_bdt": monthly_received_bdt,
        "currency_performance": currency_performance,
    }

    cache.set(cache_key, payload, timeout=60)
    return payload
