"""Pydantic schemas for registration, login and token responses."""

from typing import Literal

from pydantic import BaseModel, EmailStr, Field, field_validator

from app.schemas.user import UserRead


def _validate_password_strength(value: str) -> str:
    if len(value) < 8:
        raise ValueError("Password must be at least 8 characters")
    if len(value) > 128:
        raise ValueError("Password must be at most 128 characters")
    if not any(character.isalpha() for character in value):
        raise ValueError("Password must include a letter")
    if not any(character.isdigit() for character in value):
        raise ValueError("Password must include a number")
    return value


class RegisterRequest(BaseModel):
    full_name: str = Field(min_length=2, max_length=120)
    email: EmailStr
    password: str

    @field_validator("full_name")
    @classmethod
    def clean_full_name(cls, value: str) -> str:
        cleaned = " ".join(value.split())
        if len(cleaned) < 2:
            raise ValueError("Full name must be at least 2 characters")
        return cleaned

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: EmailStr) -> str:
        return str(value).strip().lower()

    @field_validator("password")
    @classmethod
    def password_strength(cls, value: str) -> str:
        return _validate_password_strength(value)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: EmailStr) -> str:
        return str(value).strip().lower()


class RefreshRequest(BaseModel):
    refresh_token: str | None = Field(default=None, min_length=16)


class LogoutRequest(BaseModel):
    refresh_token: str | None = Field(default=None, min_length=16)


class TokenResponse(BaseModel):
    access_token: str
    token_type: Literal["bearer"] = "bearer"
    expires_in: int
    # Cookie-authenticated browser refreshes never return a refresh token here.
    # Mobile registration/login and body-token refreshes receive it for
    # storage in SecureStore.
    refresh_token: str | None = None
    user: UserRead


class MessageResponse(BaseModel):
    detail: str
