"""Schemas for savings goals."""

import uuid
from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field, computed_field, field_validator

from app.schemas.common import Money, PositiveAmount, normalize_currency


class SavingsGoalRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    target_amount: Money
    current_amount: Money
    currency: str
    target_date: date | None
    is_active: bool
    created_at: datetime
    updated_at: datetime

    @computed_field  # type: ignore[prop-decorator]
    @property
    def remaining(self) -> Money:
        from decimal import Decimal

        return max(Decimal("0"), self.target_amount - self.current_amount)

    @computed_field  # type: ignore[prop-decorator]
    @property
    def percent_funded(self) -> float:
        if self.target_amount <= 0:
            return 0.0
        return round(float(self.current_amount / self.target_amount * 100), 2)


class SavingsGoalCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    target_amount: PositiveAmount
    currency: str | None = Field(default=None, min_length=3, max_length=3)
    target_date: date | None = None
    is_active: bool = True

    @field_validator("currency")
    @classmethod
    def validate_currency(cls, value: str | None) -> str | None:
        return normalize_currency(value)

    @field_validator("name")
    @classmethod
    def clean_name(cls, value: str) -> str:
        cleaned = " ".join(value.split())
        if not cleaned:
            raise ValueError("Goal name cannot be blank")
        return cleaned


class SavingsGoalUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    target_amount: PositiveAmount | None = None
    currency: str | None = Field(default=None, min_length=3, max_length=3)
    target_date: date | None = None
    current_amount: Money | None = None
    is_active: bool | None = None

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
            raise ValueError("Goal name cannot be blank")
        return cleaned


class SavingsGoalPage(BaseModel):
    items: list[SavingsGoalRead]
    total: int
    limit: int
    offset: int
