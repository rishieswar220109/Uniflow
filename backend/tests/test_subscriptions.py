"""Subscription lifecycle, billing history and reminder data (Phase 2)."""

from datetime import date, timedelta

from fastapi.testclient import TestClient
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.financial import Payment
from tests.phase2_helpers import (
    auth,
    create_subscription,
    register,
)


def test_create_subscription_defaults(
    client: TestClient, registered_user: dict
) -> None:
    token = registered_user["access_token"]
    subscription = create_subscription(client, token)

    assert subscription["status"] == "active"
    assert subscription["currency"] == "INR"
    assert subscription["amount"] == "649.00"
    assert subscription["billing_cycle"] == "monthly"
    assert subscription["monthly_equivalent"] == "649.00"
    assert subscription["reminder_days_before"] == 3


def test_monthly_equivalent_normalises_billing_cycles(
    client: TestClient, registered_user: dict
) -> None:
    token = registered_user["access_token"]

    weekly = create_subscription(
        client,
        token,
        name="Weekly saver",
        amount="100.00",
        billing_cycle="weekly",
    )
    assert weekly["monthly_equivalent"] == "433.33"

    quarterly = create_subscription(
        client,
        token,
        name="Quarterly plan",
        amount="900.00",
        billing_cycle="quarterly",
    )
    assert quarterly["monthly_equivalent"] == "300.00"

    yearly = create_subscription(
        client,
        token,
        name="Annual plan",
        amount="1200.00",
        billing_cycle="yearly",
    )
    assert yearly["monthly_equivalent"] == "100.00"


def test_list_and_filter_subscriptions(
    client: TestClient, registered_user: dict
) -> None:
    token = registered_user["access_token"]
    active = create_subscription(client, token, name="Active plan")
    paused = create_subscription(client, token, name="Paused plan")

    client.patch(
        f"/api/v1/subscriptions/{paused['id']}",
        json={"status": "paused"},
        headers=auth(token),
    )

    all_items = client.get("/api/v1/subscriptions", headers=auth(token))
    assert all_items.status_code == 200
    assert all_items.json()["total"] == 2

    active_only = client.get(
        "/api/v1/subscriptions",
        params={"status": "active"},
        headers=auth(token),
    )
    assert {item["name"] for item in active_only.json()["items"]} == {"Active plan"}
    assert active_only.json()["items"][0]["id"] == active["id"]

    paused_only = client.get(
        "/api/v1/subscriptions",
        params={"status": "paused"},
        headers=auth(token),
    )
    assert {item["name"] for item in paused_only.json()["items"]} == {"Paused plan"}

    search = client.get(
        "/api/v1/subscriptions",
        params={"search": "active"},
        headers=auth(token),
    )
    assert {item["name"] for item in search.json()["items"]} == {"Active plan"}


def test_pause_and_resume_subscription(
    client: TestClient, registered_user: dict
) -> None:
    token = registered_user["access_token"]
    subscription = create_subscription(client, token)

    paused = client.patch(
        f"/api/v1/subscriptions/{subscription['id']}",
        json={"status": "paused"},
        headers=auth(token),
    )
    assert paused.status_code == 200, paused.text
    assert paused.json()["status"] == "paused"

    blocked = client.post(
        f"/api/v1/subscriptions/{subscription['id']}/pay",
        json={},
        headers=auth(token),
    )
    assert blocked.status_code == 409
    assert blocked.json()["code"] == "subscription_not_active"

    resumed = client.patch(
        f"/api/v1/subscriptions/{subscription['id']}",
        json={"status": "active"},
        headers=auth(token),
    )
    assert resumed.status_code == 200, resumed.text
    assert resumed.json()["status"] == "active"

    paid = client.post(
        f"/api/v1/subscriptions/{subscription['id']}/pay",
        json={},
        headers=auth(token),
    )
    assert paid.status_code == 200, paid.text


def test_pay_subscription_advances_billing_date_and_records_history(
    client: TestClient, registered_user: dict
) -> None:
    token = registered_user["access_token"]
    today = date.today()
    subscription = create_subscription(
        client,
        token,
        name="Spotify",
        amount="119.00",
        next_payment_date=today.isoformat(),
    )

    paid = client.post(
        f"/api/v1/subscriptions/{subscription['id']}/pay",
        json={"paid_on": today.isoformat(), "note": "Paid by UPI"},
        headers=auth(token),
    )
    assert paid.status_code == 200, paid.text
    result = paid.json()
    assert result["status"] == "active"
    assert result["next_payment_date"] > today.isoformat()

    history = client.get(
        f"/api/v1/subscriptions/{subscription['id']}/payments",
        headers=auth(token),
    )
    assert history.status_code == 200
    payments = history.json()
    assert len(payments) == 1
    assert payments[0]["amount"] == "119.00"
    assert payments[0]["note"] == "Paid by UPI"
    assert payments[0]["subscription_id"] == subscription["id"]
    assert payments[0]["bill_id"] is None

    duplicate = client.post(
        f"/api/v1/subscriptions/{subscription['id']}/pay",
        json={"paid_on": today.isoformat()},
        headers=auth(token),
    )
    assert duplicate.status_code == 409
    assert duplicate.json()["code"] == "payment_already_recorded"


def test_subscription_payment_catches_up_multiple_missed_cycles(
    client: TestClient, registered_user: dict
) -> None:
    token = registered_user["access_token"]
    today = date.today()
    subscription = create_subscription(
        client,
        token,
        name="Long overdue plan",
        amount="99.00",
        next_payment_date=(today - timedelta(days=95)).isoformat(),
    )

    paid = client.post(
        f"/api/v1/subscriptions/{subscription['id']}/pay",
        json={},
        headers=auth(token),
    )
    assert paid.status_code == 200, paid.text
    assert paid.json()["next_payment_date"] > today.isoformat()


def test_update_subscription_fields(
    client: TestClient, registered_user: dict
) -> None:
    token = registered_user["access_token"]
    subscription = create_subscription(client, token)

    updated = client.patch(
        f"/api/v1/subscriptions/{subscription['id']}",
        json={
            "name": "Netflix Premium",
            "provider": "Netflix India",
            "amount": "799.00",
            "billing_cycle": "yearly",
            "reminder_days_before": 7,
        },
        headers=auth(token),
    )
    assert updated.status_code == 200, updated.text
    body = updated.json()
    assert body["name"] == "Netflix Premium"
    assert body["provider"] == "Netflix India"
    assert body["amount"] == "799.00"
    assert body["billing_cycle"] == "yearly"
    assert body["reminder_days_before"] == 7
    # 799 paid yearly is roughly 66.58 per month.
    assert body["monthly_equivalent"] == "66.58"


def test_delete_subscription_removes_payment_history(
    client: TestClient, registered_user: dict, db: Session
) -> None:
    token = registered_user["access_token"]
    subscription = create_subscription(client, token)
    client.post(
        f"/api/v1/subscriptions/{subscription['id']}/pay",
        json={},
        headers=auth(token),
    )
    assert db.scalar(select(func.count()).select_from(Payment)) == 1

    deleted = client.delete(
        f"/api/v1/subscriptions/{subscription['id']}", headers=auth(token)
    )
    assert deleted.status_code == 204
    assert db.scalar(select(func.count()).select_from(Payment)) == 0
    assert (
        client.get(
            f"/api/v1/subscriptions/{subscription['id']}", headers=auth(token)
        ).status_code
        == 404
    )


def test_subscriptions_are_isolated_between_users(
    client: TestClient, registered_user: dict
) -> None:
    owner_token = registered_user["access_token"]
    subscription = create_subscription(client, owner_token)

    other = register(client, "other-subscriptions@example.com")
    other_token = other["access_token"]

    assert (
        client.get(
            f"/api/v1/subscriptions/{subscription['id']}", headers=auth(other_token)
        ).status_code
        == 404
    )
    assert (
        client.patch(
            f"/api/v1/subscriptions/{subscription['id']}",
            json={"name": "hijacked"},
            headers=auth(other_token),
        ).status_code
        == 404
    )
    assert (
        client.post(
            f"/api/v1/subscriptions/{subscription['id']}/pay",
            json={},
            headers=auth(other_token),
        ).status_code
        == 404
    )
    assert (
        client.delete(
            f"/api/v1/subscriptions/{subscription['id']}", headers=auth(other_token)
        ).status_code
        == 404
    )
    assert (
        client.get(
            f"/api/v1/subscriptions/{subscription['id']}/payments",
            headers=auth(other_token),
        ).status_code
        == 404
    )

    # The owner's own list is unaffected by the failed attempts.
    owner_list = client.get("/api/v1/subscriptions", headers=auth(owner_token))
    assert owner_list.json()["total"] == 1


def test_subscription_validation(
    client: TestClient, registered_user: dict
) -> None:
    token = registered_user["access_token"]
    today = date.today()

    zero = client.post(
        "/api/v1/subscriptions",
        json={
            "name": "Zero plan",
            "amount": "0.00",
            "billing_cycle": "monthly",
            "next_payment_date": today.isoformat(),
        },
        headers=auth(token),
    )
    assert zero.status_code == 422

    bad_cycle = client.post(
        "/api/v1/subscriptions",
        json={
            "name": "Daily plan",
            "amount": "10.00",
            "billing_cycle": "daily",
            "next_payment_date": today.isoformat(),
        },
        headers=auth(token),
    )
    assert bad_cycle.status_code == 422

    bad_status = client.get(
        "/api/v1/subscriptions",
        params={"status": "expired"},
        headers=auth(token),
    )
    assert bad_status.status_code == 409
    assert bad_status.json()["code"] == "bad_status"


def test_subscription_endpoints_require_authentication(
    client: TestClient,
) -> None:
    assert client.get("/api/v1/subscriptions").status_code == 401
    assert client.post("/api/v1/subscriptions", json={}).status_code == 401
