"""
Pure utility functions for core domain rules (fiscal year computation and money quantization).
"""

from decimal import Decimal, ROUND_HALF_UP
from datetime import date
from typing import Union


def quantize_money(amount: Union[Decimal, float, int, str]) -> Decimal:
    """
    Quantize a monetary amount to 2 decimal places using ROUND_HALF_UP.

    Why floats cause inaccuracies:
    In standard IEEE 754 floating-point arithmetic, numbers like 0.1 and 0.2 cannot be represented
    exactly in binary. For instance, 0.1 + 0.2 equals 0.30000000000000004 in Python float arithmetic.
    Using Python Decimal avoids binary floating point rounding errors by maintaining exact base-10
    representation.

    Why ROUND_HALF_UP is used:
    Standard commercial financial accounting rounds half values (e.g. $0.005) upwards to the nearest cent ($0.01).
    Python's default Decimal rounding mode is ROUND_HALF_EVEN (Banker's rounding), which rounds half values to
    the nearest even number (e.g. 2.5 -> 2, 3.5 -> 4). Financial invoicing explicitly requires ROUND_HALF_UP.

    Args:
        amount: Monetary input as Decimal, float, int, or string.

    Returns:
        Decimal: Quantized amount rounded to exactly 2 decimal places.
    """
    if not isinstance(amount, Decimal):
        amount = Decimal(str(amount))
    return amount.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)


def fiscal_year_for(d: date) -> str:
    """
    Determine the fiscal year string for a given date based on July 1 - June 30 fiscal cycle.

    Fiscal Year Rules (Bangladesh/UK standard cycle):
    - July 1 of Year N through June 30 of Year N+1 belongs to Fiscal Year "N-(N+1_short)".
    - Example: June 30, 2026 -> FY "2025-26" (month 6 < July, so starts in 2025).
    - Example: July 1, 2026 -> FY "2026-27" (month 7 >= July, so starts in 2026).

    Args:
        d: The target date instance.

    Returns:
        str: Formatted fiscal year string (e.g. "2025-26" or "2026-27").
    """
    if d.month >= 7:
        start_year = d.year
        end_year = d.year + 1
    else:
        start_year = d.year - 1
        end_year = d.year
    return f"{start_year}-{str(end_year)[-2:]}"

