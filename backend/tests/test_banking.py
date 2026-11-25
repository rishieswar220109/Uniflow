"""Bank connections, consents and synchronisation (Phase 2)."""

from datetime import timedelta
from uuid import UUID

from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import utcnow
from app.models.financial import BankConsent, Transaction
from tests.phase2_helpers import (
    auth,
    connect_bank,
    list_accounts,
    list_transactions,
    register,
)


def test_providers_are_listed_and_labelled_mock(
    client: TestClient, auth_headers: dict
) -> None:
    response = client.get("/api/v1/banking/providers", headers=auth_headers)
    assert response.status_code == 200, response.text
    providers = response.json()
    assert providers
    mock = next(item for item in providers if item["slug"] == "mock")
    assert mock["is_mock"] is True
    assert mock["institutions"]
    assert all(item["is_mock"] for item in mock["institutions"])


def test_connect_creates_consent_accounts_and_initial_sync(
    client: TestClient, auth_headers: dict, registered_user: dict
) -> None:
    body = connect_bank(client, registered_user["access_token"])
    connection = body["connection"]
    job = body["sync_job"]

    assert connection["status"] == "active"
    assert connection["is_mock"] is True
    assert connection["institution_name"].endswith("(Demo)")
    assert len(connection["accounts"]) == 2
    assert connection["consents"]
    consent = connection["consents"][0]
    assert consent["status"] == "active"
    assert "accounts" in consent["scopes"]
    assert consent["expires_at"] > consent["granted_at"]

    assert job is not None
    assert job["status"] == "succeeded"
    assert job["accounts_synced"] == 2
    assert job["transactions_created"] > 0

    serialized = str(connection).lower()
    for forbidden in ("password", "pin", "otp", "cvv", "secret"):
        assert forbidden not in serialized

    accounts = list_accounts(client, registered_user["access_token"])
    assert len(accounts) == 2
    assert {item["account_type"] for item in accounts} == {
        "checking",
        "credit_card",
    }
    assert all(item["is_mock"] for item in accounts)


def test_second_sync_is_idempotent(
    client: TestClient, auth_headers: dict, registered_user: dict
) -> None:
    token = registered_user["access_token"]
    body = connect_bank(client, token)
    connection_id = body["connection"]["id"]

    before = list_transactions(client, token, limit=1)["total"]
    assert before > 0

    response = client.post(
        f"/api/v1/banking/connections/{connection_id}/sync",
        headers=auth_headers,
    )
    assert response.status_code == 200, response.text
    job = response.json()
    assert job["status"] == "succeeded"
    assert job["transactions_created"] == 0
    # A repeat sync re-reads only the recent lookback window; any record it
    # sees must be recognised as a duplicate. The window can legitimately be
    # empty on some calendar dates, so assert idempotency, not skip counts.
    assert job["accounts_synced"] == 2

    after = list_transactions(client, token, limit=1)["total"]
    assert after == before


def test_accounts_and_connections_are_isolated_between_users(
    client: TestClient, registered_user: dict
) -> None:
    owner_token = registered_user["access_token"]
    connection = connect_bank(client, owner_token)["connection"]
    owner_accounts = list_accounts(client, owner_token)
    owner_transactions = list_transactions(client, owner_token, limit=1)
    assert owner_transactions["total"] > 0

    other = register(client, "other-bank@example.com")
    other_token = other["access_token"]

    assert list_accounts(client, other_token) == []
    assert (
        client.get(
            f"/api/v1/accounts/{owner_accounts[0]['id']}",
            headers=auth(other_token),
        ).status_code
        == 404
    )
    assert (
        client.get(
            f"/api/v1/banking/connections/{connection['id']}",
            headers=auth(other_token),
        ).status_code
        == 404
    )
    assert (
        client.post(
            f"/api/v1/banking/connections/{connection['id']}/sync",
            headers=auth(other_token),
        ).status_code
        == 404
    )
    assert (
        client.delete(
            f"/api/v1/banking/connections/{connection['id']}",
            headers=auth(other_token),
        ).status_code
        == 404
    )


def test_expired_consent_blocks_sync(
    client: TestClient,
    auth_headers: dict,
    registered_user: dict,
    db: Session,
) -> None:
    token = registered_user["access_token"]
    connection = connect_bank(client, token)["connection"]

    consent = db.execute(
        select(BankConsent).where(
            BankConsent.connection_id == UUID(connection["id"])
        )
    ).scalar_one()
    consent.expires_at = utcnow() - timedelta(minutes=1)
    db.commit()

    response = client.post(
        f"/api/v1/banking/connections/{connection['id']}/sync",
        headers=auth_headers,
    )
    assert response.status_code == 409, response.text
    assert response.json()["code"] == "consent_expired"

    refreshed = client.get(
        f"/api/v1/banking/connections/{connection['id']}",
        headers=auth_headers,
    )
    assert refreshed.json()["status"] == "expired"


def test_revocation_blocks_sync_and_deactivates_accounts(
    client: TestClient, auth_headers: dict, registered_user: dict
) -> None:
    token = registered_user["access_token"]
    connection = connect_bank(client, token)["connection"]

    deleted = client.delete(
        f"/api/v1/banking/connections/{connection['id']}",
        headers=auth_headers,
    )
    assert deleted.status_code == 204, deleted.text

    refreshed = client.get(
        f"/api/v1/banking/connections/{connection['id']}",
        headers=auth_headers,
    )
    assert refreshed.json()["status"] == "revoked"
    assert refreshed.json()["consents"][0]["status"] == "revoked"

    assert list_accounts(client, token) == []
    assert len(list_accounts(client, token)) == 0

    response = client.post(
        f"/api/v1/banking/connections/{connection['id']}/sync",
        headers=auth_headers,
    )
    assert response.status_code == 409
    assert response.json()["code"] == "connection_revoked"


def test_unknown_provider_and_institution_are_rejected(
    client: TestClient, auth_headers: dict
) -> None:
    unknown = client.post(
        "/api/v1/banking/connections",
        json={"institution_id": "mock-hdfc", "provider": "not-a-provider"},
        headers=auth_headers,
    )
    assert unknown.status_code == 400
    assert unknown.json()["code"] == "unknown_provider"

    bad_institution = client.post(
        "/api/v1/banking/connections",
        json={"institution_id": "not-an-institution"},
        headers=auth_headers,
    )
    assert bad_institution.status_code == 400
    assert bad_institution.json()["code"] == "provider_error"


def test_sync_jobs_are_listed_for_the_owner(
    client: TestClient, auth_headers: dict, registered_user: dict
) -> None:
    connect_bank(client, registered_user["access_token"])
    response = client.get("/api/v1/banking/sync-jobs", headers=auth_headers)
    assert response.status_code == 200, response.text
    jobs = response.json()
    assert len(jobs) >= 1
    assert jobs[0]["status"] == "succeeded"


def test_banking_endpoints_require_authentication(client: TestClient) -> None:
    assert client.get("/api/v1/banking/connections").status_code == 401
    assert client.get("/api/v1/accounts").status_code == 401
    assert client.get("/api/v1/transactions").status_code == 401
    assert client.get("/api/v1/summary").status_code == 401


def test_no_duplicate_transaction_rows_after_repeated_sync(
    client: TestClient, registered_user: dict, db: Session
) -> None:
    token = registered_user["access_token"]
    connection = connect_bank(client, token)["connection"]
    for _ in range(2):
        client.post(
            f"/api/v1/banking/connections/{connection['id']}/sync",
            headers=auth(token),
        )

    rows = db.scalars(select(Transaction)).all()
    keys = {(row.account_id, row.dedupe_key) for row in rows}
    assert len(keys) == len(rows)
