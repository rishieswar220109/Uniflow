"""Password hashing, JWT access tokens and refresh-token helpers."""

import hashlib
import secrets
import uuid
from datetime import UTC, datetime, timedelta
from typing import Any

import jwt
from pwdlib import PasswordHash

from app.core.config import settings

# Argon2id is the pwdlib recommended configuration.
password_hasher = PasswordHash.recommended()

ACCESS_TOKEN_TYPE = "access"


def hash_password(password: str) -> str:
    return password_hasher.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        return password_hasher.verify(plain_password, hashed_password)
    except Exception:  # malformed hash or backend error must not 500
        return False


def utcnow() -> datetime:
    return datetime.now(UTC)


def ensure_utc(value: datetime) -> datetime:
    """SQLite returns naive datetimes; normalise before comparing."""

    if value.tzinfo is None:
        return value.replace(tzinfo=UTC)
    return value.astimezone(UTC)


def create_access_token(*, user_id: uuid.UUID, session_id: uuid.UUID) -> tuple[str, int]:
    """Create a signed access token bound to a server-side session."""

    expires_delta = timedelta(minutes=settings.access_token_expire_minutes)
    issued_at = utcnow()
    payload: dict[str, Any] = {
        "sub": str(user_id),
        "sid": str(session_id),
        "type": ACCESS_TOKEN_TYPE,
        "iat": issued_at,
        "exp": issued_at + expires_delta,
        "jti": secrets.token_urlsafe(16),
    }
    token = jwt.encode(
        payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm
    )
    return token, int(expires_delta.total_seconds())


def decode_access_token(token: str) -> dict[str, Any]:
    """Decode and validate an access token.

    Raises ``jwt.InvalidTokenError`` subclasses when the token is missing,
    expired, malformed or signed with the wrong key.
    """

    payload = jwt.decode(
        token,
        settings.jwt_secret_key,
        algorithms=[settings.jwt_algorithm],
        options={"require": ["sub", "sid", "type", "exp", "iat"]},
    )
    if payload.get("type") != ACCESS_TOKEN_TYPE:
        raise jwt.InvalidTokenError("Unexpected token type")
    return payload


def generate_refresh_token() -> tuple[str, str]:
    """Return (raw token, sha256 hash). Only the hash is persisted."""

    raw_token = secrets.token_urlsafe(48)
    return raw_token, hash_refresh_token(raw_token)


def hash_refresh_token(raw_token: str) -> str:
    return hashlib.sha256(raw_token.encode("utf-8")).hexdigest()
