"""Regression tests for refresh-token delivery and credential source.

A refresh request authenticated by the HttpOnly cookie must never return a
refresh token in its JSON body, regardless of the client-controlled
``X-Client-Platform`` header. The mobile flow returns the rotated token only
when the request supplied the refresh token in the request body.
"""

from datetime import timedelta

from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import hash_refresh_token, utcnow
from app.models.user import AuthSession

MOBILE_HEADERS = {"X-Client-Platform": "mobile"}


def _register(
    client: TestClient, *, email: str, mobile: bool = False
):
    response = client.post(
        "/api/v1/auth/register",
        json={
            "full_name": "Refresh Delivery User",
            "email": email,
            "password": "SecurePass123",
        },
        headers=MOBILE_HEADERS if mobile else None,
    )
    assert response.status_code == 201, response.text
    return response


def _assert_access_token_works(client: TestClient, access_token: str) -> None:
    response = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {access_token}"},
    )
    assert response.status_code == 200


def test_web_cookie_refresh_returns_no_refresh_token(client: TestClient) -> None:
    _register(client, email="web-refresh@example.com")
    old_cookie = client.cookies.get(settings.refresh_cookie_name)
    assert old_cookie

    refreshed = client.post("/api/v1/auth/refresh")
    assert refreshed.status_code == 200
    body = refreshed.json()
    assert body["refresh_token"] is None
    _assert_access_token_works(client, body["access_token"])

    # Rotation still happens through the cookie.
    new_cookie = refreshed.cookies.get(settings.refresh_cookie_name)
    assert new_cookie
    assert new_cookie != old_cookie


def test_spoofed_mobile_header_does_not_expose_cookie_refresh_token(
    client: TestClient,
) -> None:
    _register(client, email="spoofed-header@example.com")
    old_cookie = client.cookies.get(settings.refresh_cookie_name)
    assert old_cookie

    refreshed = client.post("/api/v1/auth/refresh", headers=MOBILE_HEADERS)
    assert refreshed.status_code == 200
    body = refreshed.json()
    assert body["refresh_token"] is None
    _assert_access_token_works(client, body["access_token"])

    # The cookie is still rotated, so the browser session continues to work.
    new_cookie = refreshed.cookies.get(settings.refresh_cookie_name)
    assert new_cookie
    assert new_cookie != old_cookie


def test_mobile_header_alone_cannot_refresh(client: TestClient) -> None:
    response = client.post("/api/v1/auth/refresh", headers=MOBILE_HEADERS)
    assert response.status_code == 401


def test_mobile_login_still_receives_refresh_token(client: TestClient) -> None:
    _register(client, email="mobile-login@example.com")

    response = client.post(
        "/api/v1/auth/login",
        json={
            "email": "mobile-login@example.com",
            "password": "SecurePass123",
        },
        headers=MOBILE_HEADERS,
    )
    assert response.status_code == 200
    assert response.json()["refresh_token"]


def test_mobile_body_refresh_returns_rotated_refresh_token(
    client: TestClient,
) -> None:
    registration = _register(
        client, email="mobile-refresh@example.com", mobile=True
    )
    first_token = registration.json()["refresh_token"]
    assert first_token

    refreshed = client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": first_token},
        headers=MOBILE_HEADERS,
    )
    assert refreshed.status_code == 200
    body = refreshed.json()
    assert body["refresh_token"]
    assert body["refresh_token"] != first_token
    assert refreshed.cookies.get(settings.refresh_cookie_name) == body["refresh_token"]
    _assert_access_token_works(client, body["access_token"])


def test_mobile_refresh_rotation_rejects_replay(client: TestClient) -> None:
    registration = _register(
        client, email="mobile-replay@example.com", mobile=True
    )
    first_token = registration.json()["refresh_token"]
    assert first_token

    refreshed = client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": first_token},
        headers=MOBILE_HEADERS,
    )
    assert refreshed.status_code == 200
    second_token = refreshed.json()["refresh_token"]
    assert second_token and second_token != first_token

    replay = client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": first_token},
        headers=MOBILE_HEADERS,
    )
    assert replay.status_code == 401

    # Replay detection revoked the family, including the rotated token.
    after_revocation = client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": second_token},
        headers=MOBILE_HEADERS,
    )
    assert after_revocation.status_code == 401


def test_invalid_refresh_token_is_rejected(client: TestClient) -> None:
    response = client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": "x" * 32},
        headers=MOBILE_HEADERS,
    )
    assert response.status_code == 401


def test_expired_cookie_refresh_is_rejected_and_revoked(
    client: TestClient, db: Session
) -> None:
    _register(client, email="expired-cookie@example.com")
    raw_token = client.cookies.get(settings.refresh_cookie_name)
    assert raw_token

    session = db.execute(
        select(AuthSession).where(
            AuthSession.refresh_token_hash == hash_refresh_token(raw_token)
        )
    ).scalar_one()
    session.expires_at = utcnow() - timedelta(seconds=1)
    db.commit()

    response = client.post("/api/v1/auth/refresh")
    assert response.status_code == 401
    assert response.json()["detail"] == "Session has expired"

    db.refresh(session)
    assert session.revoked_at is not None
