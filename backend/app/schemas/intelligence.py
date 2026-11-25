"""Schemas for financial intelligence requests."""

from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field, field_validator


class ProactiveAwarenessRequest(BaseModel):
    """Input for the pre-transaction proactive spending check.

    ``transaction_amount`` is optional in the schema so a missing value can be
    reported as a validation error (400) rather than a server error; any
    malformed or out-of-range amount is rejected with 422 by Pydantic.
    """

    model_config = ConfigDict(extra="forbid")

    transaction_amount: Decimal | None = Field(
        default=None,
        max_digits=14,
        decimal_places=2,
        allow_inf_nan=False,
    )
    transaction_category: str | None = Field(default=None, max_length=64)

    @field_validator("transaction_amount")
    @classmethod
    def validate_amount(cls, value: Decimal | None) -> Decimal | None:
        if value is None:
            return value
        if value == 0:
            raise ValueError("transaction_amount must not be zero")
        if abs(value) >= Decimal("1000000000000"):
            raise ValueError("transaction_amount is out of range")
        return value

    @field_validator("transaction_category")
    @classmethod
    def clean_category(cls, value: str | None) -> str | None:
        if value is None:
            return value
        cleaned = " ".join(value.split())
        return cleaned or None
