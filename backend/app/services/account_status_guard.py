"""ORM guard enforcing session revocation on every account-status change.

Disabling an account must invalidate the sessions issued before the change, and
re-enabling must not resurrect them. :class:`~app.services.account_status.AccountStatusService`
applies both operations atomically and is the sanctioned entry point, but a
future code path could still assign ``User.is_active`` directly. This
``before_flush`` listener makes that safe: whenever the ORM is about to persist
a changed ``User.is_active``, it takes the user-row lock and revokes every
session in the same transaction.

The lock order matches refresh-token rotation (user row, then ``auth_sessions``),
so a status change and a refresh either observe each other's committed result
or serialise cleanly.

Limitation: raw SQL and Core bulk ``UPDATE`` statements bypass the ORM flush
cycle, so this guard does not see them. Operational status changes must use the
ORM or :class:`~app.services.account_status.AccountStatusService`.
"""

from sqlalchemy import event, inspect, select
from sqlalchemy.orm import Session

from app.core.security import utcnow
from app.models.user import User
from app.repositories.auth_session_repository import AuthSessionRepository


def _guard_account_status_change(
    session: Session, flush_context: object, instances: object
) -> None:
    """Revoke sessions atomically whenever ``User.is_active`` changes."""

    for obj in list(session.dirty):
        if not isinstance(obj, User):
            continue
        if not inspect(obj).attrs.is_active.history.has_changes():
            continue
        # Serialise with refresh-token rotation, which takes the same lock
        # before rotating. The lock is held until this transaction ends.
        session.execute(
            select(User.id).where(User.id == obj.id).with_for_update()
        )
        AuthSessionRepository(session).revoke_all_for_user(
            obj.id, when=utcnow()
        )


def register_account_status_guard() -> None:
    """Install the guard on the ORM ``Session`` class exactly once."""

    if event.contains(Session, "before_flush", _guard_account_status_change):
        return
    event.listen(Session, "before_flush", _guard_account_status_change)
