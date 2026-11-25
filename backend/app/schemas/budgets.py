"""Schemas for budgets."""

import uuid
from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, computed_field, field_validator

from app.schemas.common import Money, PositiveAmount, normalize_currency

BudgetPeriod = Literal["monthly"]


class BudgetRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    category_id: uuid.UUID | None
    name: str
    period_start: date
    period_end: date
    amount: Money
    currency: str
    alert_threshold: int
    is_active: bool
    created_at: datetime
    updated_at: datetime

    @computed_field  # type: ignore[prop-decorator]
    @property
    def period(self) -> str:
        """Human-readable period label."""

        return f"{self.period_start.isoformat()} to {self.period_end.isoformat()}"


class BudgetCreate(BaseModel):
    category_id: uuid.UUID | None = None
    name: str = Field(min_length=1, max_length=120)
    period_start: date
    period_end: date
    amount: PositiveAmount
    currency: str | None = Field(default=None, min_length=3, max_length=3)
    alert_threshold: int = Field(default=80, ge=0, le=100)
    is_active: bool = True

    @field_validator("currency")
    @classmethod
    def validate_currency(cls, value: str | None) -> str | None:
        return normalize_currency(value)

    @field_validator("period_end")
    @classmethod
    def validate_period(cls, period_end: date, info) -> date:
        period_start = info.data.get("period_start")
        if period_start is not None and period_end < period_start:
            raise ValueError("Period end must be on or after period start")
        return period_end

    @field_validator("name")
    @classmethod
    def clean_name(cls, value: str) -> str:
        cleaned = " ".join(value.split())
        if not cleaned:
            raise ValueError("Budget name cannot be blank")
        return cleaned


class BudgetUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    period_start: date | None = None
    period_end: date | None = None
    amount: PositiveAmount | None = None
    currency: str | None = Field(default=None, min_length=3, max_length=3)
    alert_threshold: int | None = Field(default=None, ge=0, le=100)
    is_active: bool | None = None
    category_id: uuid.UUID | None = None

    @field_validator("currency")
    @classmethod
    def validate_currency(cls, value: str | None) -> str | None:
        return normalize_currency(value)

    @field_validator("name")
    @classmethod
    def clean_name(cls, value: str | None) -> str | None:
        if value is None:
            return value
        cleaned = " ".join(value.split())
        if not cleaned:
            raise ValueError("Budget name cannot be blank")
        return cleaned


class BudgetPage(BaseModel):
    items: list[BudgetRead]
    total: int
    limit: int
    offset: int


class BudgetSpendingRead(BaseModel):
    budget_id: uuid.UUID
    name: str
    period: str
    amount: Money
    currency: str
    spent: Money
    remaining: Money
    alert_threshold: int
    overspending: bool
    percent_used: float
