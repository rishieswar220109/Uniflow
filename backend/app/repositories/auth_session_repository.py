"""Data access for authentication sessions (refresh tokens)."""

import uuid
from datetime import datetime

from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.models.user import AuthSession


class AuthSessionRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def create(
        self,
        *,
        user_id: uuid.UUID,
        refresh_token_hash: str,
        expires_at: datetime,
        user_agent: str | None,
        ip_address: str | None,
    ) -> AuthSession:
        session = AuthSession(
            user_id=user_id,
            refresh_token_hash=refresh_token_hash,
            expires_at=expires_at,
            user_agent=(user_agent or "")[:255] or None,
            ip_address=ip_address,
        )
        self.db.add(session)
        self.db.flush()
        return session

    def get_by_id(self, session_id: uuid.UUID) -> AuthSession | None:
        return self.db.get(AuthSession, session_id)

    def get_by_token_hash(
        self, token_hash: str, *, for_update: bool = False
    ) -> AuthSession | None:
        statement = select(AuthSession).where(
            AuthSession.refresh_token_hash == token_hash
        )
        if for_update:
            # Serialise concurrent rotations of the same refresh token. Without
            # this lock two requests can both observe an unrevoked session and
            # each mint a valid replacement, creating separate token branches.
            # ``of`` keeps the lock on auth_sessions only, since the joined
            # user row is loaded through an outer join.
            statement = statement.with_for_update(of=AuthSession)
        return self.db.execute(statement).scalar_one_or_none()

    def revoke(self, session: AuthSession, *, when: datetime) -> None:
        if session.revoked_at is None:
            session.revoked_at = when
            self.db.add(session)

    def revoke_all_for_user(self, user_id: uuid.UUID, *, when: datetime) -> None:
        statement = (
            update(AuthSession)
            .where(
                AuthSession.user_id == user_id,
                AuthSession.revoked_at.is_(None),
            )
            .values(revoked_at=when)
        )
        self.db.execute(statement)

    def touch(self, session: AuthSession, *, when: datetime) -> None:
        session.last_used_at = when
        self.db.add(session)

    def commit(self) -> None:
        self.db.commit()
