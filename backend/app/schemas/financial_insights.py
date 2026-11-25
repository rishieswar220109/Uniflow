"""Schemas for financial insights and risk warnings."""

import uuid
from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.schemas.common import Money, normalize_currency

InsightType = Literal[
    "low_balance",
    "unusual_spending",
    "upcoming_obligation",
    "overspending_budget",
    "unreviewed_recurring",
    "spending_trend",
    "significant_spending",
    "entertainment_spending",
    "duplicate_transaction",
]
InsightSeverity = Literal["info", "warning", "critical"]


class FinancialInsightRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    insight_type: str
    severity: str
    title: str
    description: str
    amount: Money | None
    currency: str | None
    related_date: date | None
    is_dismissed: bool
    created_at: datetime
    updated_at: datetime


class FinancialInsightCreate(BaseModel):
    insight_type: InsightType
    severity: InsightSeverity
    title: str = Field(min_length=1, max_length=200)
    description: str = Field(min_length=1)
    amount: Money | None = None
    currency: str | None = Field(default=None, min_length=3, max_length=3)
    related_date: date | None = None

    @field_validator("currency")
    @classmethod
    def validate_currency(cls, value: str | None) -> str | None:
        return normalize_currency(value)


class FinancialInsightPage(BaseModel):
    items: list[FinancialInsightRead]
    total: int
    limit: int
    offset: int
