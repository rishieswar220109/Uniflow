"""Schemas for subscriptions and their payment history."""

import uuid
from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, computed_field, field_validator

from app.schemas.common import Money, PositiveAmount, normalize_currency

BillingCycle = Literal["weekly", "monthly", "quarterly", "yearly"]
SubscriptionStatus = Literal["active", "paused", "cancelled"]


class SubscriptionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    provider: str | None
    amount: Money
    currency: str
    billing_cycle: str
    next_payment_date: date
    started_on: date | None
    status: str
    reminder_days_before: int
    notes: str | None
    category_id: uuid.UUID | None
    created_at: datetime
    updated_at: datetime

    @computed_field  # type: ignore[prop-decorator]
    @property
    def monthly_equivalent(self) -> str:
        """Normalised monthly cost for comparable totals."""

        amount = self.amount
        if self.billing_cycle == "weekly":
            value = amount * 52 / 12
        elif self.billing_cycle == "quarterly":
            value = amount / 3
        elif self.billing_cycle == "yearly":
            value = amount / 12
        else:
            value = amount
        return f"{value:.2f}"


class SubscriptionCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    provider: str | None = Field(default=None, max_length=120)
    amount: PositiveAmount
    currency: str | None = Field(default=None, min_length=3, max_length=3)
    billing_cycle: BillingCycle = "monthly"
    next_payment_date: date
    started_on: date | None = None
    reminder_days_before: int = Field(default=3, ge=0, le=60)
    category_id: uuid.UUID | None = None
    notes: str | None = Field(default=None, max_length=500)

    @field_validator("currency")
    @classmethod
    def validate_currency(cls, value: str | None) -> str | None:
        return normalize_currency(value)

    @field_validator("name", "provider")
    @classmethod
    def clean_text(cls, value: str | None) -> str | None:
        if value is None:
            return value
        cleaned = " ".join(value.split())
        if not cleaned:
            raise ValueError("Value cannot be blank")
        return cleaned


class SubscriptionUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    provider: str | None = Field(default=None, max_length=120)
    amount: PositiveAmount | None = None
    currency: str | None = Field(default=None, min_length=3, max_length=3)
    billing_cycle: BillingCycle | None = None
    next_payment_date: date | None = None
    started_on: date | None = None
    status: SubscriptionStatus | None = None
    reminder_days_before: int | None = Field(default=None, ge=0, le=60)
    category_id: uuid.UUID | None = None
    notes: str | None = Field(default=None, max_length=500)

    @field_validator("currency")
    @classmethod
    def validate_currency(cls, value: str | None) -> str | None:
        return normalize_currency(value)


class SubscriptionPage(BaseModel):
    items: list[SubscriptionRead]
    total: int
    limit: int
    offset: int
