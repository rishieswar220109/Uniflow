"""Shared schema helpers for Phase 2 financial data."""

from decimal import Decimal
from typing import Annotated

from pydantic import Field, PlainSerializer


def format_money(value: Decimal) -> str:
    """Serialise money as a fixed two-decimal string, never a float."""

    return f"{value.quantize(Decimal('0.01')):.2f}"


# Money is stored as NUMERIC in the database and serialised as a string so no
# binary floating-point rounding is introduced at the API boundary.
Money = Annotated[
    Decimal, PlainSerializer(format_money, return_type=str, when_used="json")
]
PositiveAmount = Annotated[
    Decimal, Field(gt=0, max_digits=14, decimal_places=2)
]
NonZeroAmount = Annotated[
    Decimal, Field(max_digits=14, decimal_places=2)
]


def normalize_currency(value: str | None) -> str | None:
    if value is None:
        return value
    normalized = value.strip().upper()
    if len(normalized) != 3 or not normalized.isalpha():
        raise ValueError("Currency must be a 3-letter ISO code")
    return normalized
