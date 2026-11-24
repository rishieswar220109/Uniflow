"""Disabled accounts must not retain usable sessions (M-1)."""

import threading
import time
from datetime import timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select, text
from sqlalchemy.orm import Session

from app.core.exceptions import UnauthorizedError
from app.core.security import generate_refresh_token, utcnow
from app.models.user import AuthSession, User
from app.repositories.auth_session_repository import AuthSessionRepository
from app.repositories.user_repository import UserRepository
from app.services.account_status import (
    AccountStatusService,
    lock_user_for_refresh,
)
from app.services.auth_service import AuthService, RequestMetadata
from app.services.user_service import UserService

MOBILE_HEADERS = {"X-Client-Platform": "mobile"}
PASSWORD = "SecurePass123"


def _register(client: TestClient, email: str) -> dict:
    response = client.post(
        "/api/v1/auth/register",
        json={
            "full_name": "Disabled Session User",
            "email": email,
            "password": PASSWORD,
        },
        headers=MOBILE_HEADERS,
    )
    assert response.status_code == 201, response.text
    return response.json()


def _user(db: Session, email: str) -> User:
    return db.execute(select(User).where(User.email == email)).scalar_one()


def _set_active_out_of_band(db: Session, email: str, *, active: bool) -> None:
    """Simulate a status change made directly in the database."""

    user = _user(db, email)
    user.is_active = active
    db.commit()


def _set_active(db: Session, email: str, *, active: bool) -> User:
    """Change status through the application service."""

    user = _user(db, email)
    result = UserService(db).set_active(user.id, is_active=active)
    db.expire_all()
    return result


def _sessions(db: Session) -> list[AuthSession]:
    db.expire_all()
    return list(db.execute(select(AuthSession)).scalars().all())


# --------------------------------------------------------- out-of-band defence
def test_raw_sql_disable_is_blocked_and_revokes_on_first_request(
    client: TestClient, db: Session
) -> None:
    """Raw SQL bypasses the ORM guard; the request path must still revoke."""

    email = "raw-sql-disabled@example.com"
    registration = _register(client, email)

    # Bypass the before_flush guard deliberately, leaving sessions intact.
    db.execute(
        text("UPDATE users SET is_active = :active WHERE email = :email"),
        {"active": False, "email": email},
    )
    db.commit()
    db.expire_all()

    before = _sessions(db)
    assert before
    assert all(session.revoked_at is None for session in before)

    denied = client.get(
        "/api/v1/users/me",
        headers={"Authorization": f"Bearer {registration['access_token']}"},
    )
    assert denied.status_code == 403
    assert denied.json()["detail"] == "This account has been disabled"

    after = _sessions(db)
    assert all(session.revoked_at is not None for session in after)

    # Re-enabling must not resurrect the revoked credentials.
    db.execute(
        text("UPDATE users SET is_active = :active WHERE email = :email"),
        {"active": True, "email": email},
    )
    db.commit()
    db.expire_all()

    old_access = client.get(
        "/api/v1/users/me",
        headers={"Authorization": f"Bearer {registration['access_token']}"},
    )
    assert old_access.status_code == 401

    old_refresh = client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": registration["refresh_token"]},
        headers=MOBILE_HEADERS,
    )
    assert old_refresh.status_code == 401


def test_disabled_access_revokes_every_session(
    client: TestClient, db: Session
) -> None:
    email = "disabled-access@example.com"
    first = _register(client, email)
    second = client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": PASSWORD},
        headers=MOBILE_HEADERS,
    )
    assert second.status_code == 200, second.text
    second_body = second.json()

    _set_active_out_of_band(db, email, active=False)

    denied = client.get(
        "/api/v1/users/me",
        headers={"Authorization": f"Bearer {first['access_token']}"},
    )
    assert denied.status_code == 403
    assert denied.json()["detail"] == "This account has been disabled"

    sessions = _sessions(db)
    assert len(sessions) == 2
    assert all(session.revoked_at is not None for session in sessions)

    # Re-enabling the account must not resurrect the revoked sessions.
    _set_active_out_of_band(db, email, active=True)

    old_access = client.get(
        "/api/v1/users/me",
        headers={"Authorization": f"Bearer {first['access_token']}"},
    )
    assert old_access.status_code == 401

    old_refresh = client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": second_body["refresh_token"]},
        headers=MOBILE_HEADERS,
    )
    assert old_refresh.status_code == 401


def test_disabled_refresh_revokes_sessions(
    client: TestClient, db: Session
) -> None:
    email = "disabled-refresh@example.com"
    registration = _register(client, email)
    _set_active_out_of_band(db, email, active=False)

    denied = client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": registration["refresh_token"]},
        headers=MOBILE_HEADERS,
    )
    assert denied.status_code == 403
    assert denied.json()["detail"] == "This account has been disabled"

    sessions = _sessions(db)
    assert sessions
    assert all(session.revoked_at is not None for session in sessions)

    _set_active_out_of_band(db, email, active=True)

    # The pre-disable refresh token stays revoked after re-enabling.
    retry = client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": registration["refresh_token"]},
        headers=MOBILE_HEADERS,
    )
    assert retry.status_code == 401


def test_disabled_cookie_refresh_revokes_sessions(
    client: TestClient, db: Session
) -> None:
    email = "disabled-cookie@example.com"
    _register(client, email)
    _set_active_out_of_band(db, email, active=False)

    # Browsers authenticate the refresh with the HttpOnly cookie, not a body.
    denied = client.post("/api/v1/auth/refresh")
    assert denied.status_code == 403
    assert denied.json()["detail"] == "This account has been disabled"

    sessions = _sessions(db)
    assert sessions
    assert all(session.revoked_at is not None for session in sessions)


# ------------------------------------------------ atomic status-change contract
def test_disable_without_use_invalidates_old_access_after_reenable(
    client: TestClient, db: Session
) -> None:
    email = "m1-access-no-use@example.com"
    registration = _register(client, email)

    _set_active(db, email, active=False)
    # No request is made while the account is disabled.
    _set_active(db, email, active=True)

    old_access = client.get(
        "/api/v1/users/me",
        headers={"Authorization": f"Bearer {registration['access_token']}"},
    )
    assert old_access.status_code == 401


def test_disable_without_use_invalidates_old_refresh_after_reenable(
    client: TestClient, db: Session
) -> None:
    email = "m1-refresh-no-use@example.com"
    registration = _register(client, email)

    _set_active(db, email, active=False)
    # No request is made while the account is disabled.
    _set_active(db, email, active=True)

    old_refresh = client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": registration["refresh_token"]},
        headers=MOBILE_HEADERS,
    )
    assert old_refresh.status_code == 401


def test_disable_revokes_all_sessions_atomically(
    client: TestClient, db: Session
) -> None:
    email = "m1-disable-all@example.com"
    _register(client, email)
    second = client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": PASSWORD},
        headers=MOBILE_HEADERS,
    )
    assert second.status_code == 200, second.text

    _set_active(db, email, active=False)

    user = _user(db, email)
    assert user.is_active is False
    sessions = _sessions(db)
    assert len(sessions) == 2
    assert all(session.revoked_at is not None for session in sessions)


def test_reenable_revokes_sessions_that_survived(
    client: TestClient, db: Session
) -> None:
    email = "m1-reenable-revoke@example.com"
    _register(client, email)
    _set_active(db, email, active=False)

    # Simulate a session that still exists when the account is re-enabled, such
    # as one created by an out-of-band write. Re-enabling must revoke it.
    user = _user(db, email)
    _, token_hash = generate_refresh_token()
    survivor = AuthSessionRepository(db).create(
        user_id=user.id,
        refresh_token_hash=token_hash,
        expires_at=utcnow() + timedelta(minutes=5),
        user_agent=None,
        ip_address=None,
    )
    db.commit()
    assert survivor.revoked_at is None

    _set_active(db, email, active=True)

    db.expire_all()
    refreshed = db.get(AuthSession, survivor.id)
    assert refreshed is not None
    assert refreshed.revoked_at is not None


def test_active_account_flows_still_work(client: TestClient, db: Session) -> None:
    email = "m1-active-flow@example.com"
    registration = _register(client, email)
    access = registration["access_token"]

    current = client.get(
        "/api/v1/users/me", headers={"Authorization": f"Bearer {access}"}
    )
    assert current.status_code == 200

    rotated = client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": registration["refresh_token"]},
        headers=MOBILE_HEADERS,
    )
    assert rotated.status_code == 200, rotated.text
    rotated_body = rotated.json()
    # H-1: a body-supplied refresh token is returned in the response.
    assert rotated_body["refresh_token"] is not None

    assert (
        client.get(
            "/api/v1/users/me",
            headers={"Authorization": f"Bearer {rotated_body['access_token']}"},
        ).status_code
        == 200
    )

    logout = client.post(
        "/api/v1/auth/logout",
        json={"refresh_token": rotated_body["refresh_token"]},
    )
    assert logout.status_code == 204

    replay = client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": rotated_body["refresh_token"]},
        headers=MOBILE_HEADERS,
    )
    assert replay.status_code == 401


def test_refresh_cannot_rotate_after_concurrent_disable_commits(
    client: TestClient,
) -> None:
    from tests.conftest import TestingSessionLocal, engine

    if engine.dialect.name != "postgresql":
        pytest.skip(
            "User-row locking relies on PostgreSQL SELECT ... FOR UPDATE"
        )

    email = "m1-refresh-disable-race@example.com"
    registration = client.post(
        "/api/v1/auth/register",
        json={
            "full_name": "Disabled Session User",
            "email": email,
            "password": PASSWORD,
        },
        headers=MOBILE_HEADERS,
    )
    assert registration.status_code == 201, registration.text
    refresh_token = registration.json()["refresh_token"]

    with TestingSessionLocal() as lookup:
        user_id = lookup.execute(
            select(User.id).where(User.email == email)
        ).scalar_one()

    outcomes: list[str] = []
    holder = TestingSessionLocal()
    try:
        locked_user = UserRepository(holder).get_by_id_for_update(user_id)
        assert locked_user is not None
        assert locked_user.is_active

        def attempt() -> None:
            session = TestingSessionLocal()
            try:
                if not lock_user_for_refresh(session, refresh_token):
                    outcomes.append("rejected")
                    return
                try:
                    AuthService(session).refresh(
                        refresh_token, RequestMetadata()
                    )
                except UnauthorizedError:
                    outcomes.append("rejected")
                else:
                    outcomes.append("rotated")
            finally:
                session.close()

        thread = threading.Thread(target=attempt)
        thread.start()

        # Wait until the refresh is actually blocked on the user-row lock.
        deadline = time.monotonic() + 5
        blocked = False
        while time.monotonic() < deadline:
            with TestingSessionLocal() as observer:
                waiting = observer.execute(
                    text(
                        "SELECT count(*) FROM pg_stat_activity "
                        "WHERE datname = current_database() "
                        "AND wait_event_type = 'Lock'"
                    )
                ).scalar_one()
            if waiting:
                blocked = True
                break
            time.sleep(0.05)
        assert blocked, "refresh never blocked on the user row lock"

        # Commit the disable while the refresh is waiting. The refresh must
        # then observe the disabled account and refuse to rotate.
        AccountStatusService(holder).set_active(user_id, is_active=False)

        thread.join(timeout=30)
        assert not thread.is_alive()
    finally:
        holder.close()

    assert outcomes == ["rejected"]

    with TestingSessionLocal() as verification:
        sessions = verification.execute(select(AuthSession)).scalars().all()
        user = verification.get(User, user_id)
    assert user is not None and user.is_active is False
    assert sessions
    assert all(session.revoked_at is not None for session in sessions)


# ------------------------------------------------- ORM account-status guard
def test_direct_orm_disable_revokes_sessions_at_commit(
    client: TestClient, db: Session
) -> None:
    """Any ORM status write must revoke sessions, not just the service."""

    email = "m1-direct-orm-disable@example.com"
    registration = _register(client, email)

    user = _user(db, email)
    user.is_active = False
    db.commit()

    # Revocation happens as part of the status write; no request is needed.
    sessions = _sessions(db)
    assert sessions
    assert all(session.revoked_at is not None for session in sessions)

    user = _user(db, email)
    user.is_active = True
    db.commit()

    old_access = client.get(
        "/api/v1/users/me",
        headers={"Authorization": f"Bearer {registration['access_token']}"},
    )
    assert old_access.status_code == 401

    old_refresh = client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": registration["refresh_token"]},
        headers=MOBILE_HEADERS,
    )
    assert old_refresh.status_code == 401


def test_direct_orm_reenable_revokes_surviving_sessions(
    client: TestClient, db: Session
) -> None:
    email = "m1-direct-orm-reenable@example.com"
    _register(client, email)

    user = _user(db, email)
    user.is_active = False
    db.commit()

    # Simulate a session that appeared while the account was disabled.
    user = _user(db, email)
    _, token_hash = generate_refresh_token()
    survivor = AuthSessionRepository(db).create(
        user_id=user.id,
        refresh_token_hash=token_hash,
        expires_at=utcnow() + timedelta(minutes=5),
        user_agent=None,
        ip_address=None,
    )
    db.commit()
    assert survivor.revoked_at is None

    user = _user(db, email)
    user.is_active = True
    db.commit()

    db.expire_all()
    refreshed = db.get(AuthSession, survivor.id)
    assert refreshed is not None
    assert refreshed.revoked_at is not None


def test_unrelated_orm_update_does_not_revoke_sessions(
    client: TestClient, db: Session
) -> None:
    email = "m1-unrelated-update@example.com"
    registration = _register(client, email)

    user = _user(db, email)
    user.full_name = "Renamed User"
    db.commit()

    sessions = _sessions(db)
    assert sessions
    assert all(session.revoked_at is None for session in sessions)

    still_valid = client.get(
        "/api/v1/users/me",
        headers={"Authorization": f"Bearer {registration['access_token']}"},
    )
    assert still_valid.status_code == 200


def test_orm_guard_lock_blocks_refresh_until_disable_commits(
    client: TestClient,
) -> None:
    """The guard's user-row lock must serialise with refresh rotation."""

    from tests.conftest import TestingSessionLocal, engine

    if engine.dialect.name != "postgresql":
        pytest.skip(
            "User-row locking relies on PostgreSQL SELECT ... FOR UPDATE"
        )

    email = "m1-orm-guard-race@example.com"
    registration = client.post(
        "/api/v1/auth/register",
        json={
            "full_name": "Disabled Session User",
            "email": email,
            "password": PASSWORD,
        },
        headers=MOBILE_HEADERS,
    )
    assert registration.status_code == 201, registration.text
    refresh_token = registration.json()["refresh_token"]

    with TestingSessionLocal() as lookup:
        user_id = lookup.execute(
            select(User.id).where(User.email == email)
        ).scalar_one()

    outcomes: list[str] = []
    blocker = TestingSessionLocal()
    try:
        user = blocker.get(User, user_id)
        assert user is not None
        user.is_active = False
        # Flushing runs the ORM guard, which takes the user-row lock and
        # revokes sessions before the status update commits.
        blocker.flush()

        def attempt() -> None:
            session = TestingSessionLocal()
            try:
                if not lock_user_for_refresh(session, refresh_token):
                    outcomes.append("rejected")
                    return
                try:
                    AuthService(session).refresh(
                        refresh_token, RequestMetadata()
                    )
                except UnauthorizedError:
                    outcomes.append("rejected")
                else:
                    outcomes.append("rotated")
            finally:
                session.close()

        thread = threading.Thread(target=attempt)
        thread.start()

        deadline = time.monotonic() + 5
        blocked = False
        while time.monotonic() < deadline:
            with TestingSessionLocal() as observer:
                waiting = observer.execute(
                    text(
                        "SELECT count(*) FROM pg_stat_activity "
                        "WHERE datname = current_database() "
                        "AND wait_event_type = 'Lock'"
                    )
                ).scalar_one()
            if waiting:
                blocked = True
                break
            time.sleep(0.05)
        assert blocked, "refresh never blocked on the guard's user row lock"

        blocker.commit()
        thread.join(timeout=30)
        assert not thread.is_alive()
    finally:
        blocker.close()

    assert outcomes == ["rejected"]

    with TestingSessionLocal() as verification:
        sessions = verification.execute(select(AuthSession)).scalars().all()
        user = verification.get(User, user_id)
    assert user is not None and user.is_active is False
    assert sessions
    assert all(session.revoked_at is not None for session in sessions)
