"""Authentication and session business logic."""

import uuid
from dataclasses import dataclass
from datetime import timedelta

import jwt
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.exceptions import ConflictError, ForbiddenError, UnauthorizedError
from app.core.security import (
    create_access_token,
    decode_access_token,
    ensure_utc,
    generate_refresh_token,
    hash_password,
    hash_refresh_token,
    utcnow,
    verify_password,
)
from app.models.user import AuthSession, User
from app.repositories.auth_session_repository import AuthSessionRepository
from app.repositories.user_repository import UserRepository
from app.schemas.auth import LoginRequest, RegisterRequest

# A fixed hash lets failed logins take the same time as successful ones.
_DUMMY_PASSWORD_HASH = hash_password("not-a-real-password-123")


@dataclass(frozen=True)
class RequestMetadata:
    user_agent: str | None = None
    ip_address: str | None = None


@dataclass(frozen=True)
class TokenBundle:
    access_token: str
    expires_in: int
    refresh_token: str
    user: User


class AuthService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.users = UserRepository(db)
        self.sessions = AuthSessionRepository(db)

    # ------------------------------------------------------------------ register
    def register(self, payload: RegisterRequest) -> TokenBundle:
        if self.users.get_by_email(payload.email):
            raise ConflictError("An account with this email already exists")

        try:
            user = self.users.create(
                full_name=payload.full_name,
                email=payload.email,
                hashed_password=hash_password(payload.password),
            )
            self.db.commit()
        except IntegrityError as exc:
            # Covers a concurrent registration racing the uniqueness check.
            self.db.rollback()
            raise ConflictError(
                "An account with this email already exists"
            ) from exc
        return self._start_session(user)

    # ---------------------------------------------------------------------- login
    def login(self, payload: LoginRequest, metadata: RequestMetadata) -> TokenBundle:
        user = self.users.get_by_email(payload.email)
        if user is None:
            verify_password(payload.password, _DUMMY_PASSWORD_HASH)
            raise UnauthorizedError("Incorrect email or password")
        if not verify_password(payload.password, user.hashed_password):
            raise UnauthorizedError("Incorrect email or password")
        if not user.is_active:
            raise ForbiddenError("This account has been disabled")

        user.last_login_at = utcnow()
        self.db.add(user)
        self.db.commit()
        return self._start_session(user, metadata)

    # -------------------------------------------------------------------- refresh
    def refresh(self, raw_refresh_token: str | None, metadata: RequestMetadata) -> TokenBundle:
        if not raw_refresh_token:
            raise UnauthorizedError("Missing refresh token")

        session = self.sessions.get_by_token_hash(
            hash_refresh_token(raw_refresh_token)
        )
        if session is None:
            raise UnauthorizedError("Invalid or expired session")

        now = utcnow()
        if session.revoked_at is not None:
            # A revoked token being replayed suggests theft: revoke the family.
            self.sessions.revoke_all_for_user(session.user_id, when=now)
            self.db.commit()
            raise UnauthorizedError("Session is no longer valid")

        if ensure_utc(session.expires_at) <= now:
            self.sessions.revoke(session, when=now)
            self.db.commit()
            raise UnauthorizedError("Session has expired")

        user = session.user
        if not user.is_active:
            raise ForbiddenError("This account has been disabled")

        # Rotate: the old refresh token and its access tokens stop working.
        self.sessions.revoke(session, when=now)
        self.db.flush()
        return self._start_session(user, metadata)

    # --------------------------------------------------------------------- logout
    def logout(
        self,
        *,
        raw_refresh_token: str | None,
        access_token: str | None,
    ) -> None:
        now = utcnow()
        revoked = False

        if raw_refresh_token:
            session = self.sessions.get_by_token_hash(
                hash_refresh_token(raw_refresh_token)
            )
            if session is not None:
                self.sessions.revoke(session, when=now)
                revoked = True

        if access_token:
            session_id = _session_id_from_access_token(access_token)
            if session_id is not None:
                session = self.sessions.get_by_id(session_id)
                if session is not None:
                    self.sessions.revoke(session, when=now)
                    revoked = True

        if revoked:
            self.db.commit()

    # -------------------------------------------------------------------- helpers
    def _start_session(
        self,
        user: User,
        metadata: RequestMetadata | None = None,
    ) -> TokenBundle:
        raw_refresh, refresh_hash = generate_refresh_token()
        metadata = metadata or RequestMetadata()
        session = self.sessions.create(
            user_id=user.id,
            refresh_token_hash=refresh_hash,
            expires_at=utcnow()
            + timedelta(seconds=settings.refresh_token_expire_seconds),
            user_agent=metadata.user_agent,
            ip_address=metadata.ip_address,
        )
        access_token, expires_in = create_access_token(
            user_id=user.id, session_id=session.id
        )
        self.db.commit()
        return TokenBundle(
            access_token=access_token,
            expires_in=expires_in,
            refresh_token=raw_refresh,
            user=user,
        )


def _session_id_from_access_token(token: str) -> uuid.UUID | None:
    try:
        payload = decode_access_token(token)
        return uuid.UUID(payload["sid"])
    except (jwt.InvalidTokenError, ValueError, KeyError):
        return None
