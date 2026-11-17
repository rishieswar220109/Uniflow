"""End-to-end API flow through the shared backend contract."""

from fastapi.testclient import TestClient


def test_full_authentication_lifecycle(client: TestClient) -> None:
    # 1. Register
    register = client.post(
        "/api/v1/auth/register",
        json={
            "full_name": "Integration User",
            "email": "integration@example.com",
            "password": "Guardian123",
        },
        headers={"X-Client-Platform": "mobile"},
    )
    assert register.status_code == 201, register.text
    registration = register.json()
    refresh_token = registration["refresh_token"]

    # 2. Authenticated user retrieval
    headers = {"Authorization": f"Bearer {registration['access_token']}"}
    me = client.get("/api/v1/auth/me", headers=headers)
    assert me.status_code == 200
    assert me.json()["email"] == "integration@example.com"

    # 3. Protected dashboard data source (profile) is accessible
    assert client.get("/api/v1/users/me", headers=headers).status_code == 200

    # 4. Log out
    logout = client.post(
        "/api/v1/auth/logout",
        json={"refresh_token": refresh_token},
        headers=headers,
    )
    assert logout.status_code == 204

    # 5. Old access is rejected immediately
    assert client.get("/api/v1/auth/me", headers=headers).status_code == 401
    assert client.get("/api/v1/users/me", headers=headers).status_code == 401

    # 6. Logging in again establishes a fresh session
    login = client.post(
        "/api/v1/auth/login",
        json={"email": "integration@example.com", "password": "Guardian123"},
        headers={"X-Client-Platform": "mobile"},
    )
    assert login.status_code == 200
    new_headers = {"Authorization": f"Bearer {login.json()['access_token']}"}
    profile = client.get("/api/v1/users/me", headers=new_headers)
    assert profile.status_code == 200
    assert profile.json()["full_name"] == "Integration User"


def test_web_cookie_session_can_be_refreshed_without_local_storage(
    client: TestClient,
) -> None:
    register = client.post(
        "/api/v1/auth/register",
        json={
            "full_name": "Cookie User",
            "email": "cookie@example.com",
            "password": "Guardian123",
        },
    )
    assert register.status_code == 201
    assert register.json()["refresh_token"] is None
    assert "guardian_refresh" in client.cookies

    refreshed = client.post("/api/v1/auth/refresh")
    assert refreshed.status_code == 200
    assert refreshed.json()["access_token"]
    assert refreshed.json()["refresh_token"] is None

    me = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {refreshed.json()['access_token']}"},
    )
    assert me.status_code == 200
    assert me.json()["email"] == "cookie@example.com"


def test_updating_preferences_persists_across_requests(client: TestClient) -> None:
    register = client.post(
        "/api/v1/auth/register",
        json={
            "full_name": "Persistent User",
            "email": "persist@example.com",
            "password": "Guardian123",
        },
    )
    headers = {"Authorization": f"Bearer {register.json()['access_token']}"}
    update = client.patch(
        "/api/v1/users/me/preferences",
        headers=headers,
        json={"currency": "GBP", "push_notifications": False},
    )
    assert update.status_code == 200

    me = client.get("/api/v1/auth/me", headers=headers)
    assert me.json()["preferences"]["currency"] == "GBP"
    assert me.json()["preferences"]["push_notifications"] is False
