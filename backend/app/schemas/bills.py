"""Schemas for bills and their payment history."""

import uuid
from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, computed_field, field_validator

from app.schemas.common import Money, PositiveAmount, normalize_currency

Recurrence = Literal["none", "weekly", "monthly", "quarterly", "yearly"]
BillStatus = Literal["unpaid", "paid", "skipped", "cancelled"]


class BillRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    payee: str | None
    amount: Money
    currency: str
    due_date: date
    recurrence: str
    status: str
    autopay: bool
    reminder_days_before: int
    notes: str | None
    category_id: uuid.UUID | None
    last_paid_at: datetime | None
    created_at: datetime
    updated_at: datetime

    @computed_field  # type: ignore[prop-decorator]
    @property
    def state(self) -> str:
        """A due-date-aware state without changing the stored status."""

        if self.status in {"paid", "skipped", "cancelled"}:
            return self.status
        today = date.today()
        if self.due_date < today:
            return "overdue"
        if self.due_date == today:
            return "due"
        return "upcoming"


class BillCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    payee: str | None = Field(default=None, max_length=120)
    amount: PositiveAmount
    currency: str | None = Field(default=None, min_length=3, max_length=3)
    due_date: date
    recurrence: Recurrence = "none"
    autopay: bool = False
    reminder_days_before: int = Field(default=3, ge=0, le=60)
    category_id: uuid.UUID | None = None
    notes: str | None = Field(default=None, max_length=500)

    @field_validator("currency")
    @classmethod
    def validate_currency(cls, value: str | None) -> str | None:
        return normalize_currency(value)

    @field_validator("name", "payee")
    @classmethod
    def clean_text(cls, value: str | None) -> str | None:
        if value is None:
            return value
        cleaned = " ".join(value.split())
        if not cleaned:
            raise ValueError("Value cannot be blank")
        return cleaned


class BillUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    payee: str | None = Field(default=None, max_length=120)
    amount: PositiveAmount | None = None
    currency: str | None = Field(default=None, min_length=3, max_length=3)
    due_date: date | None = None
    recurrence: Recurrence | None = None
    status: BillStatus | None = None
    autopay: bool | None = None
    reminder_days_before: int | None = Field(default=None, ge=0, le=60)
    category_id: uuid.UUID | None = None
    notes: str | None = Field(default=None, max_length=500)

    @field_validator("currency")
    @classmethod
    def validate_currency(cls, value: str | None) -> str | None:
        return normalize_currency(value)


class BillPage(BaseModel):
    items: list[BillRead]
    total: int
    limit: int
    offset: int
