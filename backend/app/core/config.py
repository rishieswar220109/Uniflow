"""Application settings loaded from environment variables.

Secrets must never be hardcoded for real deployments. The development
defaults exist only so a fresh clone can boot; production validation rejects
weak or default values at startup.
"""

from functools import lru_cache
from pathlib import Path
from typing import Annotated, Literal

from pydantic import field_validator, model_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parents[2]
PROJECT_ROOT = BACKEND_DIR.parent

_DEV_JWT_SECRET = "dev-only-insecure-secret-change-before-deploying"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(PROJECT_ROOT / ".env", BACKEND_DIR / ".env"),
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # Application
    app_name: str = "UniFlow API"
    app_version: str = "1.0.0"
    environment: Literal["development", "test", "production"] = "development"
    debug: bool = False
    api_v1_prefix: str = "/api/v1"

    # Database
    database_url: str = (
        "postgresql+psycopg://guardian:guardian@localhost:5432/guardian"
    )
    database_echo: bool = False

    # Authentication
    jwt_secret_key: str = _DEV_JWT_SECRET
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 15
    refresh_token_expire_days: int = 7
    refresh_cookie_name: str = "guardian_refresh"
    refresh_cookie_secure: bool = False
    refresh_cookie_samesite: Literal["lax", "strict", "none"] = "lax"
    refresh_cookie_path: str = "/api/v1/auth"
    # Per-client-IP rate limiting for authentication endpoints. The limiter is
    # in-process; multi-worker deployments also need an edge or shared limiter.
    auth_rate_limit_enabled: bool = True
    auth_rate_limit_attempts: int = 10
    auth_rate_limit_window_seconds: int = 300

    # Financial data providers (Phase 2). Only the mock provider is bundled.
    # A live provider is added by registering another BankProvider adapter.
    bank_provider: str = "mock"
    bank_sync_lookback_days: int = 120

    # CORS (comma-separated in .env, e.g. "http://localhost:5173,http://localhost:8081")
    cors_origins: Annotated[list[str], NoDecode] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:8081",
    ]

    @field_validator("cors_origins", mode="before")
    @classmethod
    def split_cors_origins(cls, value: object) -> object:
        if isinstance(value, str):
            return [origin.strip() for origin in value.split(",") if origin.strip()]
        return value

    @field_validator("database_url")
    @classmethod
    def normalize_database_url(cls, value: str) -> str:
        # Allow the common ``postgres://`` form used by managed providers.
        if value.startswith("postgres://"):
            return "postgresql+psycopg://" + value.removeprefix("postgres://")
        if value.startswith("postgresql://"):
            return "postgresql+psycopg://" + value.removeprefix("postgresql://")
        return value

    @field_validator("auth_rate_limit_attempts", "auth_rate_limit_window_seconds")
    @classmethod
    def validate_rate_limit_values(cls, value: int) -> int:
        if value < 1:
            raise ValueError("Rate limit values must be positive")
        return value

    @field_validator("bank_sync_lookback_days")
    @classmethod
    def validate_sync_lookback(cls, value: int) -> int:
        if value < 1 or value > 3650:
            raise ValueError("Bank sync lookback must be between 1 and 3650 days")
        return value

    @model_validator(mode="after")
    def validate_production_secrets(self) -> "Settings":
        if self.environment == "production":
            if self.jwt_secret_key == _DEV_JWT_SECRET or len(self.jwt_secret_key) < 32:
                raise ValueError(
                    "JWT_SECRET_KEY must be set to a strong random value in production"
                )
            if not self.refresh_cookie_secure:
                raise ValueError(
                    "REFRESH_COOKIE_SECURE must be true in production"
                )
        if self.refresh_cookie_samesite == "none" and not self.refresh_cookie_secure:
            raise ValueError(
                "REFRESH_COOKIE_SAMESITE=none requires REFRESH_COOKIE_SECURE=true"
            )
        return self

    @property
    def is_production(self) -> bool:
        return self.environment == "production"

    @property
    def refresh_token_expire_seconds(self) -> int:
        return self.refresh_token_expire_days * 24 * 60 * 60


@lru_cache
def get_settings() -> Settings:
    """Return the process-wide settings instance."""

    return Settings()


settings = get_settings()
