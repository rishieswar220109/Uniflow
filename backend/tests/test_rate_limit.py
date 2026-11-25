"""Authentication rate limiting (login, registration and refresh)."""

import threading
from concurrent.futures import ThreadPoolExecutor

from fastapi.testclient import TestClient

from app.core.config import settings
from app.core.rate_limit import SlidingWindowRateLimiter

REGISTER = "/api/v1/auth/register"
LOGIN = "/api/v1/auth/login"


def _login(client: TestClient, email: str = "nobody@example.com"):
    return client.post(
        LOGIN,
        json={"email": email, "password": "WrongPassword123"},
    )


def _register(client: TestClient, email: str):
    return client.post(
        REGISTER,
        json={
            "full_name": "Rate Limit User",
            "email": email,
            "password": "Guardian123",
        },
    )


def test_login_is_rate_limited(
    client: TestClient, monkeypatch
) -> None:
    monkeypatch.setattr(settings, "auth_rate_limit_attempts", 3)

    for _ in range(3):
        response = _login(client)
        assert response.status_code == 401, response.text

    limited = _login(client)
    assert limited.status_code == 429, limited.text
    body = limited.json()
    assert body["code"] == "rate_limited"
    assert body["detail"]
    retry_after = limited.headers.get("Retry-After")
    assert retry_after is not None
    assert int(retry_after) >= 1


def test_registration_is_rate_limited(
    client: TestClient, monkeypatch
) -> None:
    monkeypatch.setattr(settings, "auth_rate_limit_attempts", 2)

    for index in range(2):
        response = _register(client, f"limited{index}@example.com")
        assert response.status_code == 201, response.text

    limited = _register(client, "limited2@example.com")
    assert limited.status_code == 429, limited.text
    assert limited.json()["code"] == "rate_limited"


def test_rate_limit_buckets_are_separate_per_action(
    client: TestClient, monkeypatch
) -> None:
    monkeypatch.setattr(settings, "auth_rate_limit_attempts", 1)

    assert _login(client).status_code == 401
    assert _login(client).status_code == 429

    # Exhausting login attempts must not block registration.
    assert _register(client, "separate@example.com").status_code == 201


def test_refresh_is_rate_limited(
    client: TestClient, monkeypatch
) -> None:
    monkeypatch.setattr(settings, "auth_rate_limit_attempts", 2)

    for _ in range(2):
        response = client.post("/api/v1/auth/refresh")
        assert response.status_code == 401, response.text

    limited = client.post("/api/v1/auth/refresh")
    assert limited.status_code == 429, limited.text
    assert limited.json()["code"] == "rate_limited"


def test_rate_limiting_can_be_disabled(
    client: TestClient, monkeypatch
) -> None:
    monkeypatch.setattr(settings, "auth_rate_limit_enabled", False)
    monkeypatch.setattr(settings, "auth_rate_limit_attempts", 1)

    for _ in range(4):
        assert _login(client).status_code == 401


def test_sliding_window_expires_old_requests(monkeypatch) -> None:
    clock = [1000.0]
    monkeypatch.setattr(
        "app.core.rate_limit.time.monotonic", lambda: clock[0]
    )
    limiter = SlidingWindowRateLimiter()

    assert limiter.check("key", limit=2, window_seconds=60) is None
    assert limiter.check("key", limit=2, window_seconds=60) is None
    retry_after = limiter.check("key", limit=2, window_seconds=60)
    assert retry_after is not None
    assert 0 <= retry_after <= 60

    clock[0] += 61
    assert limiter.check("key", limit=2, window_seconds=60) is None


def test_concurrent_checks_never_exceed_the_limit() -> None:
    limiter = SlidingWindowRateLimiter()
    workers = 64
    limit = 20
    barrier = threading.Barrier(workers)

    def attempt() -> float | None:
        barrier.wait()
        return limiter.check("shared", limit=limit, window_seconds=60)

    with ThreadPoolExecutor(max_workers=workers) as pool:
        results = list(pool.map(lambda _: attempt(), range(workers)))

    allowed = [result for result in results if result is None]
    limited = [result for result in results if result is not None]
    assert len(allowed) == limit
    assert len(limited) == workers - limit
    assert all(result >= 0 for result in limited)


def test_separate_keys_do_not_share_a_bucket() -> None:
    limiter = SlidingWindowRateLimiter()

    assert limiter.check("login:198.51.100.1", limit=1, window_seconds=60) is None
    assert limiter.check("login:198.51.100.1", limit=1, window_seconds=60) is not None
    assert limiter.check("login:198.51.100.2", limit=1, window_seconds=60) is None


def test_legitimate_login_succeeds_within_the_limit(
    client: TestClient,
    registered_user: dict,
    monkeypatch,
) -> None:
    monkeypatch.setattr(settings, "auth_rate_limit_attempts", 3)

    assert _login(client, "asha@example.com").status_code == 401
    assert _login(client, "asha@example.com").status_code == 401

    success = client.post(
        LOGIN,
        json={"email": "asha@example.com", "password": "Guardian123"},
    )
    assert success.status_code == 200, success.text
    assert success.json()["access_token"]

    limited = _login(client, "asha@example.com")
    assert limited.status_code == 429, limited.text
