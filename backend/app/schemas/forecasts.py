"""Schemas for cash-flow forecasts."""

import uuid
from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.common import Money, PositiveAmount, normalize_currency


class ForecastRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    forecast_date: date
    projected_balance: Money
    expected_income: Money
    expected_expenses: Money
    currency: str
    generated_at: datetime
    assumptions: str | None


class ForecastCreate(BaseModel):
    forecast_date: date
    projected_balance: Money
    expected_income: Money = Field(default=0)
    expected_expenses: Money = Field(default=0)
    currency: str | None = Field(default=None, min_length=3, max_length=3)
    assumptions: str | None = Field(default=None, max_length=1000)

    @field_validator("currency")
    @classmethod
    def validate_currency(cls, value: str | None) -> str | None:
        return normalize_currency(value)


class ForecastPage(BaseModel):
    items: list[ForecastRead]
    total: int
    limit: int
    offset: int
