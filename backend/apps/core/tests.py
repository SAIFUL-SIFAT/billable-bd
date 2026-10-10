from django.test import TestCase# type: ignore[assignment]
from datetime import date
from decimal import Decimal
from apps.core.utils import fiscal_year_for, quantize_money


class CoreUtilsTestCase(TestCase):
    """Unit test suite for core pure utility functions."""

    def test_fiscal_year_for_june_30(self) -> None:
        """
        Verify that June 30 resolves to the preceding fiscal year (e.g. 2026-06-30 -> 2025-26).
        """
        d = date(2026, 6, 30)
        self.assertEqual(fiscal_year_for(d), "2025-26")

    def test_fiscal_year_for_july_1(self) -> None:
        """
        Verify that July 1 resolves to the new fiscal year (e.g. 2026-07-01 -> 2026-27).
        """
        d = date(2026, 7, 1)
        self.assertEqual(fiscal_year_for(d), "2026-27")

    def test_quantize_money_rounding(self) -> None:
        """
        Verify that quantize_money uses ROUND_HALF_UP to quantize monetary values to 2 decimal places.
        """
        # 0.005 rounds up to 0.01 under ROUND_HALF_UP
        self.assertEqual(quantize_money(Decimal("0.005")), Decimal("0.01"))
        # 0.004 rounds down to 0.00
        self.assertEqual(quantize_money(Decimal("0.004")), Decimal("0.00"))
        # Line item calculation: 0.1 * 3 = 0.30
        self.assertEqual(quantize_money(Decimal("0.1") * Decimal("3")), Decimal("0.30"))

