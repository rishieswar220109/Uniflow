"""Schemas for spending preferences (proactive awareness & reminders)."""

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.schemas.common import Money, PositiveAmount, normalize_currency


class SpendingPreferencesRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    proactive_awareness_enabled: bool
    significant_spending_threshold: Money
    reminder_advance_days: int
    enable_due_reminders: bool
    enable_post_payment_reminders: bool
    enable_entertainment_alerts: bool
    entertainment_categories: str
    reminder_frequency: str
    currency: str
    created_at: datetime
    updated_at: datetime


class SpendingPreferencesUpdate(BaseModel):
    proactive_awareness_enabled: bool | None = None
    significant_spending_threshold: PositiveAmount | None = None
    reminder_advance_days: int | None = Field(default=None, ge=0, le=30)
    enable_due_reminders: bool | None = None
    enable_post_payment_reminders: bool | None = None
    enable_entertainment_alerts: bool | None = None
    entertainment_categories: str | None = Field(default=None, max_length=200)
    reminder_frequency: str | None = Field(default=None, max_length=16)
    currency: str | None = Field(default=None, min_length=3, max_length=3)

    @field_validator("currency")
    @classmethod
    def validate_currency(cls, value: str | None) -> str | None:
        return normalize_currency(value)

    @field_validator("reminder_frequency")
    @classmethod
    def validate_frequency(cls, value: str | None) -> str | None:
        if value is None:
            return value
        allowed = {"daily", "weekly", "none"}
        if value not in allowed:
            raise ValueError("Frequency must be one of: daily, weekly, none")
        return value
