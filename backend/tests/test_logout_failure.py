"""Logout failure and idempotency behaviour (H-2).

The clients must be able to distinguish a confirmed server-side revocation from
a failed logout request. These tests lock in the backend half of that contract.
"""

import pytest
from fastapi.testclient import TestClient

from app.repositories.auth_session_repository import AuthSessionRepository

MOBILE_HEADERS = {"X-Client-Platform": "mobile"}


def _register(client: TestClient, email: str) -> dict:
    response = client.post(
        "/api/v1/auth/register",
        json={
            "full_name": "Logout User",
            "email": email,
            "password": "SecurePass123",
        },
        headers=MOBILE_HEADERS,
    )
    assert response.status_code == 201, response.text
    return response.json()


def test_logout_with_unknown_refresh_token_is_idempotent(
    client: TestClient,
) -> None:
    response = client.post(
        "/api/v1/auth/logout",
        json={"refresh_token": "x" * 32},
        headers=MOBILE_HEADERS,
    )

    assert response.status_code == 204
    assert "guardian_refresh" not in client.cookies


def test_logout_revocation_failure_is_not_reported_as_success(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    session = _register(client, "logout-failure@example.com")
    access_headers = {"Authorization": f"Bearer {session['access_token']}"}

    def fail_revoke(*args, **kwargs) -> None:
        raise RuntimeError("simulated revocation failure")

    monkeypatch.setattr(AuthSessionRepository, "revoke", fail_revoke)

    # TestClient re-raises unhandled server errors by default, so a failed
    # revocation must not be converted into a successful 204 response.
    with pytest.raises(RuntimeError, match="simulated revocation failure"):
        client.post(
            "/api/v1/auth/logout",
            json={"refresh_token": session["refresh_token"]},
            headers=MOBILE_HEADERS,
        )

    # The session was never revoked, so the access token still works. This is
    # why the frontend must not clear its state or claim success on failure.
    assert (
        client.get("/api/v1/auth/me", headers=access_headers).status_code == 200
    )
