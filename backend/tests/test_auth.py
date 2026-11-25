"""Registration, login, refresh, logout and protected-route behaviour."""

import threading
import time
from datetime import timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.exceptions import UnauthorizedError
from app.core.security import hash_refresh_token, utcnow
from app.models.user import AuthSession, User


def test_registration_creates_user_and_default_preferences(
    client: TestClient, db: Session
) -> None:
    response = client.post(
        "/api/v1/auth/register",
        json={
            "full_name": "Ravi Kumar",
            "email": "Ravi@Example.com",
            "password": "SecurePass123",
        },
    )
    assert response.status_code == 201, response.text
    body = response.json()
    assert body["access_token"]
    assert body["token_type"] == "bearer"
    assert body["user"]["email"] == "ravi@example.com"
    assert body["user"]["preferences"]["currency"] == "INR"
    assert body["user"]["preferences"]["onboarding_completed"] is False
    assert "hashed_password" not in body["user"]
    assert "password" not in body["user"]

    stored = db.execute(select(User).where(User.email == "ravi@example.com"))
    user = stored.scalar_one()
    assert user.hashed_password != "SecurePass123"
    assert user.hashed_password.startswith("$argon2")


def test_duplicate_email_is_rejected_case_insensitively(client: TestClient) -> None:
    payload = {
        "full_name": "First User",
        "email": "duplicate@example.com",
        "password": "SecurePass123",
    }
    first = client.post("/api/v1/auth/register", json=payload)
    assert first.status_code == 201

    second = client.post(
        "/api/v1/auth/register",
        json={**payload, "email": "DUPLICATE@example.com"},
    )
    assert second.status_code == 409
    assert "already exists" in second.json()["detail"]


def test_registration_validation_errors_do_not_echo_password(
    client: TestClient,
) -> None:
    response = client.post(
        "/api/v1/auth/register",
        json={
            "full_name": "A",
            "email": "not-an-email",
            "password": "Zx9",
        },
    )
    assert response.status_code == 422
    assert "Zx9" not in response.text
    assert response.json()["code"] == "validation_error"


def test_login_and_current_user(client: TestClient) -> None:
    client.post(
        "/api/v1/auth/register",
        json={
            "full_name": "Meera Nair",
            "email": "meera@example.com",
            "password": "SecurePass123",
        },
    )
    login = client.post(
        "/api/v1/auth/login",
        json={"email": "meera@example.com", "password": "SecurePass123"},
    )
    assert login.status_code == 200
    access_token = login.json()["access_token"]

    me = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {access_token}"},
    )
    assert me.status_code == 200
    assert me.json()["full_name"] == "Meera Nair"


def test_invalid_login_is_rejected(client: TestClient) -> None:
    client.post(
        "/api/v1/auth/register",
        json={
            "full_name": "Test User",
            "email": "user@example.com",
            "password": "SecurePass123",
        },
    )
    wrong_password = client.post(
        "/api/v1/auth/login",
        json={"email": "user@example.com", "password": "WrongPass123"},
    )
    assert wrong_password.status_code == 401
    assert wrong_password.json()["detail"] == "Incorrect email or password"

    unknown_email = client.post(
        "/api/v1/auth/login",
        json={"email": "nobody@example.com", "password": "SecurePass123"},
    )
    assert unknown_email.status_code == 401
    assert unknown_email.json()["detail"] == "Incorrect email or password"


def test_protected_endpoints_require_authentication(client: TestClient) -> None:
    assert client.get("/api/v1/auth/me").status_code == 401
    assert client.get("/api/v1/users/me").status_code == 401
    assert client.patch("/api/v1/users/me", json={"full_name": "Hacker"}).status_code == 401
    assert client.get("/api/v1/users/me/preferences").status_code == 401


def test_invalid_and_tampered_tokens_are_rejected(client: TestClient) -> None:
    assert (
        client.get(
            "/api/v1/users/me", headers={"Authorization": "Bearer not-a-token"}
        ).status_code
        == 401
    )
    assert (
        client.get(
            "/api/v1/users/me", headers={"Authorization": "Basic abc123"}
        ).status_code
        == 401
    )


def test_refresh_rotates_tokens_and_rejects_replay(client: TestClient) -> None:
    registration = client.post(
        "/api/v1/auth/register",
        json={
            "full_name": "Rotation User",
            "email": "rotate@example.com",
            "password": "SecurePass123",
        },
        headers={"X-Client-Platform": "mobile"},
    )
    original_refresh = registration.json()["refresh_token"]
    assert original_refresh

    refreshed = client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": original_refresh},
        headers={"X-Client-Platform": "mobile"},
    )
    assert refreshed.status_code == 200
    new_refresh = refreshed.json()["refresh_token"]
    assert new_refresh and new_refresh != original_refresh

    # Replaying the rotated token is treated as a possible compromise.
    replay = client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": original_refresh},
        headers={"X-Client-Platform": "mobile"},
    )
    assert replay.status_code == 401

    # Reuse detection revoked the whole family, including the new token.
    after_family_revocation = client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": new_refresh},
        headers={"X-Client-Platform": "mobile"},
    )
    assert after_family_revocation.status_code == 401


def test_refresh_token_not_returned_to_web_clients(client: TestClient) -> None:
    response = client.post(
        "/api/v1/auth/register",
        json={
            "full_name": "Web User",
            "email": "web@example.com",
            "password": "SecurePass123",
        },
    )
    assert response.status_code == 201
    assert response.json()["refresh_token"] is None
    assert "guardian_refresh" in response.cookies
    set_cookie = response.headers["set-cookie"].lower()
    assert "httponly" in set_cookie
    assert "samesite=lax" in set_cookie


def test_logout_revokes_session_and_immediately_blocks_access(
    client: TestClient,
) -> None:
    registration = client.post(
        "/api/v1/auth/register",
        json={
            "full_name": "Logout User",
            "email": "logout@example.com",
            "password": "SecurePass123",
        },
        headers={"X-Client-Platform": "mobile"},
    )
    body = registration.json()
    headers = {"Authorization": f"Bearer {body['access_token']}"}
    assert client.get("/api/v1/users/me", headers=headers).status_code == 200

    logout = client.post(
        "/api/v1/auth/logout",
        json={"refresh_token": body["refresh_token"]},
        headers=headers,
    )
    assert logout.status_code == 204

    # Access tokens are bound to the revoked session, so they fail immediately.
    assert client.get("/api/v1/users/me", headers=headers).status_code == 401
    refresh = client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": body["refresh_token"]},
        headers={"X-Client-Platform": "mobile"},
    )
    assert refresh.status_code == 401


def test_logout_is_idempotent(client: TestClient) -> None:
    assert client.post("/api/v1/auth/logout").status_code == 204


def test_sessions_are_persisted_with_hashed_refresh_tokens(
    client: TestClient, db: Session
) -> None:
    response = client.post(
        "/api/v1/auth/register",
        json={
            "full_name": "Session Owner",
            "email": "session@example.com",
            "password": "SecurePass123",
        },
        headers={"X-Client-Platform": "mobile"},
    )
    raw_refresh = response.json()["refresh_token"]
    sessions = db.execute(select(AuthSession)).scalars().all()
    assert len(sessions) == 1
    assert sessions[0].refresh_token_hash != raw_refresh
    assert len(sessions[0].refresh_token_hash) == 64


def test_disabled_account_cannot_login_or_use_existing_tokens(
    client: TestClient, db: Session
) -> None:
    registration = client.post(
        "/api/v1/auth/register",
        json={
            "full_name": "Disabled User",
            "email": "disabled@example.com",
            "password": "SecurePass123",
        },
        headers={"X-Client-Platform": "mobile"},
    )
    body = registration.json()

    user = db.execute(
        select(User).where(User.email == "disabled@example.com")
    ).scalar_one()
    user.is_active = False
    db.commit()

    headers = {"Authorization": f"Bearer {body['access_token']}"}
    assert client.get("/api/v1/users/me", headers=headers).status_code == 403

    login = client.post(
        "/api/v1/auth/login",
        json={"email": "disabled@example.com", "password": "SecurePass123"},
    )
    assert login.status_code == 403
    assert login.json()["detail"] == "This account has been disabled"

    refresh = client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": body["refresh_token"]},
        headers={"X-Client-Platform": "mobile"},
    )
    assert refresh.status_code == 403


def test_expired_refresh_session_is_rejected_and_revoked(
    client: TestClient, db: Session
) -> None:
    registration = client.post(
        "/api/v1/auth/register",
        json={
            "full_name": "Expired Session",
            "email": "expired@example.com",
            "password": "SecurePass123",
        },
        headers={"X-Client-Platform": "mobile"},
    )
    raw_refresh = registration.json()["refresh_token"]

    session = db.execute(
        select(AuthSession).where(
            AuthSession.refresh_token_hash == hash_refresh_token(raw_refresh)
        )
    ).scalar_one()
    session.expires_at = utcnow() - timedelta(seconds=1)
    db.commit()

    response = client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": raw_refresh},
        headers={"X-Client-Platform": "mobile"},
    )
    assert response.status_code == 401
    assert response.json()["detail"] == "Session has expired"

    db.refresh(session)
    assert session.revoked_at is not None


def test_concurrent_refresh_creates_only_one_rotation(
    client: TestClient,
) -> None:
    from tests.conftest import TestingSessionLocal, engine

    if engine.dialect.name != "postgresql":
        pytest.skip(
            "Concurrent rotation relies on PostgreSQL SELECT ... FOR UPDATE"
        )

    from sqlalchemy import text

    from app.repositories.auth_session_repository import AuthSessionRepository
    from app.services.auth_service import AuthService, RequestMetadata

    registration = client.post(
        "/api/v1/auth/register",
        json={
            "full_name": "Concurrent User",
            "email": "concurrent@example.com",
            "password": "SecurePass123",
        },
        headers={"X-Client-Platform": "mobile"},
    )
    original_refresh = registration.json()["refresh_token"]
    token_hash = hash_refresh_token(original_refresh)

    # Hold the session row lock to guarantee the racing refresh overlaps the
    # winner instead of running before or after it.
    blocker = TestingSessionLocal()
    try:
        locked = AuthSessionRepository(blocker).get_by_token_hash(
            token_hash, for_update=True
        )
        assert locked is not None

        outcomes: list[str] = []

        def attempt() -> None:
            session = TestingSessionLocal()
            try:
                service = AuthService(session)
                try:
                    service.refresh(original_refresh, RequestMetadata())
                except UnauthorizedError:
                    outcomes.append("rejected")
                else:
                    outcomes.append("rotated")
            finally:
                session.close()

        thread = threading.Thread(target=attempt)
        thread.start()

        # Wait until the racing request is actually blocked on the row lock.
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
        assert blocked, "racing refresh never blocked on the session row lock"

        # The lock holder completes its rotation and commits, releasing the
        # lock. The waiting request must then see the rotated session.
        AuthService(blocker).refresh(original_refresh, RequestMetadata())
        thread.join(timeout=30)
        assert not thread.is_alive()
    finally:
        blocker.close()

    assert outcomes == ["rejected"]

    with TestingSessionLocal() as verification:
        sessions = verification.execute(select(AuthSession)).scalars().all()
    # The original session plus the single rotation. Replay detection revoked
    # the family, so no usable token branch survives.
    assert len(sessions) == 2
    assert all(session.revoked_at is not None for session in sessions)
