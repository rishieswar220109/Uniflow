"""Account-status enforcement for authentication sessions.

Disabling an account must invalidate sessions established before the change and
must not let a refresh rotation create a session that outlives it. Status
changes go through :class:`AccountStatusService`, which locks the user row and
revokes every session in the same transaction. An ORM ``before_flush`` guard
(:mod:`app.services.account_status_guard`) applies the same lock-and-revoke
contract to any other ORM write of ``User.is_active``. The helpers below also
cover credentials presented while an account is already disabled.
"""

import uuid

from sqlalchemy.orm import Session

from app.core.exceptions import NotFoundError
from app.core.security import hash_refresh_token, utcnow
from app.models.user import User
from app.repositories.auth_session_repository import AuthSessionRepository
from app.repositories.user_repository import UserRepository


class AccountStatusService:
    """Apply account-status changes atomically with session revocation."""

    def __init__(self, db: Session) -> None:
        self.db = db
        self.users = UserRepository(db)
        self.sessions = AuthSessionRepository(db)

    def set_active(self, user_id: uuid.UUID, *, is_active: bool) -> User:
        """Lock the user, revoke every session, and change the status.

        The user-row lock serialises this change with refresh-token rotation,
        which takes the same lock before rotating. Sessions are revoked on
        every status write, so a re-enable also invalidates anything that
        survived the disabled period.
        """

        user = self.users.get_by_id_for_update(user_id)
        if user is None:
            raise NotFoundError("User not found")

        self.sessions.revoke_all_for_user(user.id, when=utcnow())
        user.is_active = is_active
        self.db.add(user)
        self.db.commit()
        self.db.refresh(user)
        return user


def revoke_sessions_for_disabled_user(db: Session, user_id: uuid.UUID) -> None:
    """Revoke every active session belonging to a disabled account."""

    AuthSessionRepository(db).revoke_all_for_user(user_id, when=utcnow())
    db.commit()


def lock_user_for_refresh(db: Session, raw_refresh_token: str | None) -> bool:
    """Serialise refresh rotation with account-status changes.

    Takes the owning user's row lock before the auth service rotates the
    session. A concurrent :meth:`AccountStatusService.set_active` therefore
    either completes first (and this call reports the disabled account) or
    waits until the rotation commits and then revokes the new session.

    Returns ``False`` when the token belongs to a disabled account; the caller
    must reject the request with ``403``. Returns ``True`` otherwise, including
    for unknown tokens, so the auth service keeps ownership of invalid-token
    handling. The lock stays held until the caller's transaction commits.
    """

    if not raw_refresh_token:
        return True

    session = AuthSessionRepository(db).get_by_token_hash(
        hash_refresh_token(raw_refresh_token)
    )
    if session is None:
        return True

    user = UserRepository(db).get_by_id_for_update(session.user_id)
    if user is None or user.is_active:
        return True

    revoke_sessions_for_disabled_user(db, user.id)
    return False
