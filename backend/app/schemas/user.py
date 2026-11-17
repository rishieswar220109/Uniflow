"""Pydantic schemas for user profile and preferences."""

import uuid
from datetime import datetime
from typing import Literal
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from pydantic import BaseModel, ConfigDict, Field, field_validator


class UserPreferencesRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    currency: str
    timezone: str
    theme: Literal["system", "light", "dark"]
    email_notifications: bool
    push_notifications: bool
    weekly_summary: bool
    onboarding_completed: bool


class UserPreferencesUpdate(BaseModel):
    currency: str | None = Field(default=None, min_length=3, max_length=3)
    timezone: str | None = Field(default=None, min_length=1, max_length=64)
    theme: Literal["system", "light", "dark"] | None = None
    email_notifications: bool | None = None
    push_notifications: bool | None = None
    weekly_summary: bool | None = None
    onboarding_completed: bool | None = None

    @field_validator("currency")
    @classmethod
    def validate_currency(cls, value: str | None) -> str | None:
        if value is None:
            return value
        normalized = value.strip().upper()
        if not normalized.isalpha():
            raise ValueError("Currency must be a 3-letter ISO code")
        return normalized

    @field_validator("timezone")
    @classmethod
    def validate_timezone(cls, value: str | None) -> str | None:
        if value is None:
            return value
        try:
            ZoneInfo(value)
        except (ZoneInfoNotFoundError, ValueError) as exc:
            raise ValueError("Unknown timezone") from exc
        return value


class UserRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    full_name: str
    email: str
    is_active: bool
    created_at: datetime
    updated_at: datetime
    preferences: UserPreferencesRead


class UserUpdate(BaseModel):
    full_name: str | None = Field(default=None, min_length=2, max_length=120)
    preferences: UserPreferencesUpdate | None = None

    @field_validator("full_name")
    @classmethod
    def clean_full_name(cls, value: str | None) -> str | None:
        if value is None:
            return value
        cleaned = " ".join(value.split())
        if len(cleaned) < 2:
            raise ValueError("Full name must be at least 2 characters")
        return cleaned
