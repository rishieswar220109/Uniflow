"""Transaction storage, filtering, manual entry and categorisation."""

from datetime import date, timedelta

from fastapi.testclient import TestClient

from tests.phase2_helpers import (
    auth,
    connect_bank,
    list_accounts,
    list_transactions,
    register,
)


def _connected(client: TestClient, user: dict) -> tuple[str, list[dict]]:
    token = user["access_token"]
    connect_bank(client, token)
    return token, list_accounts(client, token)


def test_synced_transactions_are_categorised(
    client: TestClient, registered_user: dict
) -> None:
    token, _accounts = _connected(client, registered_user)
    page = list_transactions(client, token, limit=200)

    assert page["total"] > 0
    assert len(page["items"]) > 0
    assert all(item["category"] is not None for item in page["items"])
    assert all(item["source"] == "provider" for item in page["items"])

    salary = [
        item
        for item in page["items"]
        if item["transaction_type"] == "income"
    ]
    assert salary
    assert any(item["category"]["slug"] == "salary" for item in salary)

    netflix = [
        item for item in page["items"] if "netflix" in item["description"].lower()
    ]
    assert netflix
    assert netflix[0]["category"]["slug"] == "entertainment"


def test_transaction_filters(
    client: TestClient, registered_user: dict
) -> None:
    token, accounts = _connected(client, registered_user)
    checking = next(
        item for item in accounts if item["account_type"] == "checking"
    )

    by_account = list_transactions(client, token, account_id=checking["id"], limit=200)
    assert by_account["total"] > 0
    assert all(item["account_id"] == checking["id"] for item in by_account["items"])

    income = list_transactions(client, token, transaction_type="income", limit=200)
    assert income["items"]
    assert all(float(item["amount"]) > 0 for item in income["items"])

    search = list_transactions(client, token, search="netflix", limit=200)
    assert search["items"]
    assert all(
        "netflix" in f"{item['description']} {item['merchant'] or ''}".lower()
        for item in search["items"]
    )

    today = date.today()
    window = list_transactions(
        client,
        token,
        from_date=(today - timedelta(days=10)).isoformat(),
        to_date=today.isoformat(),
        limit=200,
    )
    assert window["items"]
    assert all(
        (today - timedelta(days=10)).isoformat()
        <= item["occurred_on"]
        <= today.isoformat()
        for item in window["items"]
    )

    manual_source = list_transactions(client, token, source="manual")
    assert manual_source["total"] == 0

    categories = client.get("/api/v1/transactions/categories", headers=auth(token))
    assert categories.status_code == 200
    slugs = {item["slug"] for item in categories.json()}
    assert {"salary", "entertainment", "groceries", "other"} <= slugs
    assert all(item["is_system"] for item in categories.json())


def test_manual_transaction_and_duplicate_protection(
    client: TestClient, registered_user: dict
) -> None:
    token, accounts = _connected(client, registered_user)
    account = accounts[0]
    payload = {
        "account_id": account["id"],
        "amount": "-250.50",
        "description": "Local grocery store",
        "merchant": "Corner Shop",
        "occurred_on": date.today().isoformat(),
    }

    first = client.post(
        "/api/v1/transactions", json=payload, headers=auth(token)
    )
    assert first.status_code == 201, first.text
    created = first.json()
    assert created["source"] == "manual"
    assert created["transaction_type"] == "expense"
    assert created["amount"] == "-250.50"
    assert created["category"] is not None

    duplicate = client.post(
        "/api/v1/transactions", json=payload, headers=auth(token)
    )
    assert duplicate.status_code == 409
    assert duplicate.json()["code"] == "duplicate_transaction"

    allowed = client.post(
        "/api/v1/transactions",
        json={**payload, "allow_duplicate": True},
        headers=auth(token),
    )
    assert allowed.status_code == 201, allowed.text

    total = list_transactions(client, token)["total"]
    assert total >= 2


def test_manual_transaction_currency_must_match_account(
    client: TestClient, registered_user: dict
) -> None:
    token, accounts = _connected(client, registered_user)
    response = client.post(
        "/api/v1/transactions",
        json={
            "account_id": accounts[0]["id"],
            "amount": "-10.00",
            "currency": "USD",
            "description": "Mismatched currency",
            "occurred_on": date.today().isoformat(),
        },
        headers=auth(token),
    )
    assert response.status_code == 400
    assert response.json()["code"] == "currency_mismatch"


def test_transaction_update_and_delete_rules(
    client: TestClient, registered_user: dict
) -> None:
    token, accounts = _connected(client, registered_user)
    account = accounts[0]

    manual = client.post(
        "/api/v1/transactions",
        json={
            "account_id": account["id"],
            "amount": "-99.00",
            "description": "Manual coffee",
            "occurred_on": date.today().isoformat(),
        },
        headers=auth(token),
    ).json()

    categories = client.get(
        "/api/v1/transactions/categories", headers=auth(token)
    ).json()
    groceries = next(item for item in categories if item["slug"] == "groceries")

    updated = client.patch(
        f"/api/v1/transactions/{manual['id']}",
        json={"category_id": groceries["id"], "notes": "Split with a friend"},
        headers=auth(token),
    )
    assert updated.status_code == 200, updated.text
    assert updated.json()["category"]["slug"] == "groceries"
    assert updated.json()["notes"] == "Split with a friend"

    deleted = client.delete(
        f"/api/v1/transactions/{manual['id']}", headers=auth(token)
    )
    assert deleted.status_code == 204

    provider_transaction = list_transactions(
        client, token, source="provider", limit=1
    )["items"][0]
    blocked = client.delete(
        f"/api/v1/transactions/{provider_transaction['id']}", headers=auth(token)
    )
    assert blocked.status_code == 409
    assert blocked.json()["code"] == "provider_transaction"


def test_transactions_are_isolated_between_users(
    client: TestClient, registered_user: dict
) -> None:
    owner_token, accounts = _connected(client, registered_user)
    owner_transaction = list_transactions(client, owner_token, limit=1)["items"][0]

    other = register(client, "other-transactions@example.com")
    other_token = other["access_token"]

    assert (
        client.get(
            f"/api/v1/transactions/{owner_transaction['id']}",
            headers=auth(other_token),
        ).status_code
        == 404
    )
    assert (
        client.patch(
            f"/api/v1/transactions/{owner_transaction['id']}",
            json={"notes": "not yours"},
            headers=auth(other_token),
        ).status_code
        == 404
    )
    assert (
        client.delete(
            f"/api/v1/transactions/{owner_transaction['id']}",
            headers=auth(other_token),
        ).status_code
        == 404
    )

    spoofed = client.post(
        "/api/v1/transactions",
        json={
            "account_id": accounts[0]["id"],
            "amount": "-5.00",
            "description": "borrowed account",
            "occurred_on": date.today().isoformat(),
        },
        headers=auth(other_token),
    )
    assert spoofed.status_code == 404


def test_invalid_transaction_filters_are_rejected(
    client: TestClient, registered_user: dict
) -> None:
    token, _accounts = _connected(client, registered_user)

    bad_range = client.get(
        "/api/v1/transactions",
        params={"from_date": "2030-02-01", "to_date": "2030-01-01"},
        headers=auth(token),
    )
    assert bad_range.status_code == 400

    bad_type = client.get(
        "/api/v1/transactions",
        params={"transaction_type": "gift"},
        headers=auth(token),
    )
    assert bad_type.status_code == 400
