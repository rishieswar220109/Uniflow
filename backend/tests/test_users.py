"""Profile and preference endpoints."""

from fastapi.testclient import TestClient


def test_get_profile(client: TestClient, auth_headers: dict[str, str]) -> None:
    response = client.get("/api/v1/users/me", headers=auth_headers)
    assert response.status_code == 200
    body = response.json()
    assert body["full_name"] == "Asha Verma"
    assert body["email"] == "asha@example.com"
    assert body["is_active"] is True
    assert "hashed_password" not in body


def test_update_profile_name(
    client: TestClient, auth_headers: dict[str, str]
) -> None:
    response = client.patch(
        "/api/v1/users/me",
        headers=auth_headers,
        json={"full_name": "  Asha   V.  "},
    )
    assert response.status_code == 200
    assert response.json()["full_name"] == "Asha V."


def test_update_preferences(
    client: TestClient, auth_headers: dict[str, str]
) -> None:
    response = client.patch(
        "/api/v1/users/me/preferences",
        headers=auth_headers,
        json={
            "currency": "usd",
            "timezone": "Europe/London",
            "theme": "dark",
            "weekly_summary": True,
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert body["currency"] == "USD"
    assert body["timezone"] == "Europe/London"
    assert body["theme"] == "dark"
    assert body["weekly_summary"] is True
    assert body["email_notifications"] is True


def test_profile_update_can_include_preferences(
    client: TestClient, auth_headers: dict[str, str]
) -> None:
    response = client.patch(
        "/api/v1/users/me",
        headers=auth_headers,
        json={
            "full_name": "Asha V.",
            "preferences": {"currency": "EUR", "onboarding_completed": True},
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert body["full_name"] == "Asha V."
    assert body["preferences"]["currency"] == "EUR"
    assert body["preferences"]["onboarding_completed"] is True


def test_invalid_preferences_are_rejected(
    client: TestClient, auth_headers: dict[str, str]
) -> None:
    bad_currency = client.patch(
        "/api/v1/users/me/preferences",
        headers=auth_headers,
        json={"currency": "US"},
    )
    assert bad_currency.status_code == 422

    bad_timezone = client.patch(
        "/api/v1/users/me/preferences",
        headers=auth_headers,
        json={"timezone": "Mars/Olympus"},
    )
    assert bad_timezone.status_code == 422

    bad_theme = client.patch(
        "/api/v1/users/me/preferences",
        headers=auth_headers,
        json={"theme": "neon"},
    )
    assert bad_theme.status_code == 422


def test_user_cannot_access_another_users_profile(
    client: TestClient, auth_headers: dict[str, str]
) -> None:
    """There is no profile-by-id route, so IDs are never user-controlled."""

    response = client.get("/api/v1/users/00000000-0000-0000-0000-000000000000")
    assert response.status_code == 404
    # The real profile endpoint always scopes to the token owner.
    own = client.get("/api/v1/users/me", headers=auth_headers)
    assert own.json()["email"] == "asha@example.com"
