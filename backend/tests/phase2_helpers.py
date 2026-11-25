"""Shared helpers for Phase 2 API tests."""

from fastapi.testclient import TestClient

PASSWORD = "Guardian123"


def register(
    client: TestClient,
    email: str,
    full_name: str = "Phase Two User",
) -> dict:
    response = client.post(
        "/api/v1/auth/register",
        json={"full_name": full_name, "email": email, "password": PASSWORD},
    )
    assert response.status_code == 201, response.text
    return response.json()


def auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def connect_bank(
    client: TestClient,
    token: str,
    institution_id: str = "mock-hdfc",
) -> dict:
    response = client.post(
        "/api/v1/banking/connections",
        json={"institution_id": institution_id},
        headers=auth(token),
    )
    assert response.status_code == 201, response.text
    return response.json()


def list_accounts(client: TestClient, token: str) -> list[dict]:
    response = client.get("/api/v1/accounts", headers=auth(token))
    assert response.status_code == 200, response.text
    return response.json()


def list_transactions(client: TestClient, token: str, **params) -> dict:
    response = client.get(
        "/api/v1/transactions", params=params, headers=auth(token)
    )
    assert response.status_code == 200, response.text
    return response.json()


def create_bill(client: TestClient, token: str, **overrides) -> dict:
    payload = {
        "name": "Electricity bill",
        "payee": "State Power",
        "amount": "1450.00",
        "due_date": "2030-01-15",
        "recurrence": "none",
    }
    payload.update(overrides)
    response = client.post("/api/v1/bills", json=payload, headers=auth(token))
    assert response.status_code == 201, response.text
    return response.json()


def create_subscription(client: TestClient, token: str, **overrides) -> dict:
    payload = {
        "name": "Netflix",
        "provider": "Netflix",
        "amount": "649.00",
        "billing_cycle": "monthly",
        "next_payment_date": "2030-01-20",
    }
    payload.update(overrides)
    response = client.post(
        "/api/v1/subscriptions", json=payload, headers=auth(token)
    )
    assert response.status_code == 201, response.text
    return response.json()
