"""Schemas for transactions and categories."""

import uuid
from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.schemas.common import Money, NonZeroAmount, normalize_currency
from app.schemas.financial_insights import FinancialInsightRead


class CategoryRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    slug: str
    name: str
    kind: str
    is_system: bool


class TransactionAccountRef(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    account_type: str


class TransactionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    account_id: uuid.UUID
    account: TransactionAccountRef
    category: CategoryRead | None
    amount: Money
    currency: str
    description: str
    merchant: str | None
    occurred_on: date
    transaction_type: str
    source: str
    is_pending: bool
    notes: str | None
    created_at: datetime
    # Spending-awareness insights produced when this transaction was created.
    # Empty for transactions returned by list and detail endpoints.
    alerts: list[FinancialInsightRead] = Field(default_factory=list)


class TransactionPage(BaseModel):
    items: list[TransactionRead]
    total: int
    limit: int
    offset: int


class TransactionCreate(BaseModel):
    account_id: uuid.UUID
    amount: NonZeroAmount
    currency: str | None = Field(default=None, min_length=3, max_length=3)
    description: str = Field(min_length=1, max_length=255)
    merchant: str | None = Field(default=None, max_length=120)
    occurred_on: date
    category_id: uuid.UUID | None = None
    notes: str | None = Field(default=None, max_length=500)
    allow_duplicate: bool = False

    @field_validator("currency")
    @classmethod
    def validate_currency(cls, value: str | None) -> str | None:
        return normalize_currency(value)

    @field_validator("amount")
    @classmethod
    def validate_amount(cls, value: Decimal) -> Decimal:
        if value == 0:
            raise ValueError("Transaction amount cannot be zero")
        if abs(value) >= Decimal("1000000000000"):
            raise ValueError("Transaction amount is out of range")
        return value

    @field_validator("description", "merchant")
    @classmethod
    def clean_text(cls, value: str | None) -> str | None:
        if value is None:
            return value
        cleaned = " ".join(value.split())
        if not cleaned:
            raise ValueError("Value cannot be blank")
        return cleaned


class TransactionUpdate(BaseModel):
    category_id: uuid.UUID | None = None
    merchant: str | None = Field(default=None, max_length=120)
    notes: str | None = Field(default=None, max_length=500)
