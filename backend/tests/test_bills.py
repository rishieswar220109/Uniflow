"""Bill management, payment status and upcoming obligations."""

from datetime import date, timedelta

from fastapi.testclient import TestClient
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.financial import Payment
from tests.phase2_helpers import (
    auth,
    create_bill,
    create_subscription,
    register,
)


def test_create_bill_defaults(
    client: TestClient, registered_user: dict
) -> None:
    token = registered_user["access_token"]
    bill = create_bill(client, token)

    assert bill["status"] == "unpaid"
    assert bill["state"] == "upcoming"
    assert bill["currency"] == "INR"
    assert bill["amount"] == "1450.00"
    assert bill["recurrence"] == "none"
    assert bill["reminder_days_before"] == 3


def test_bill_states_and_filters(
    client: TestClient, registered_user: dict
) -> None:
    token = registered_user["access_token"]
    today = date.today()

    overdue = create_bill(
        client,
        token,
        name="Past due bill",
        due_date=(today - timedelta(days=5)).isoformat(),
    )
    due_today = create_bill(
        client,
        token,
        name="Due today",
        due_date=today.isoformat(),
    )
    upcoming = create_bill(
        client,
        token,
        name="Upcoming bill",
        due_date=(today + timedelta(days=5)).isoformat(),
    )

    assert overdue["state"] == "overdue"
    assert due_today["state"] == "due"
    assert upcoming["state"] == "upcoming"

    overdue_list = client.get(
        "/api/v1/bills", params={"state": "overdue"}, headers=auth(token)
    )
    assert overdue_list.status_code == 200
    names = [item["name"] for item in overdue_list.json()["items"]]
    assert names == ["Past due bill"]

    upcoming_list = client.get(
        "/api/v1/bills",
        params={"state": "upcoming", "days": 30},
        headers=auth(token),
    )
    upcoming_names = {item["name"] for item in upcoming_list.json()["items"]}
    assert "Upcoming bill" in upcoming_names
    assert "Past due bill" not in upcoming_names


def test_update_bill(
    client: TestClient, registered_user: dict
) -> None:
    token = registered_user["access_token"]
    bill = create_bill(client, token)

    response = client.patch(
        f"/api/v1/bills/{bill['id']}",
        json={
            "name": "Updated electricity bill",
            "amount": "1600.00",
            "recurrence": "monthly",
            "autopay": True,
        },
        headers=auth(token),
    )
    assert response.status_code == 200, response.text
    updated = response.json()
    assert updated["name"] == "Updated electricity bill"
    assert updated["amount"] == "1600.00"
    assert updated["recurrence"] == "monthly"
    assert updated["autopay"] is True


def test_pay_one_off_bill_and_history(
    client: TestClient, registered_user: dict
) -> None:
    token = registered_user["access_token"]
    bill = create_bill(client, token)

    paid = client.post(
        f"/api/v1/bills/{bill['id']}/pay",
        json={"note": "Paid by UPI"},
        headers=auth(token),
    )
    assert paid.status_code == 200, paid.text
    assert paid.json()["status"] == "paid"
    assert paid.json()["state"] == "paid"
    assert paid.json()["last_paid_at"] is not None

    history = client.get(
        f"/api/v1/bills/{bill['id']}/payments", headers=auth(token)
    )
    assert history.status_code == 200
    payments = history.json()
    assert len(payments) == 1
    assert payments[0]["amount"] == "1450.00"
    assert payments[0]["note"] == "Paid by UPI"

    again = client.post(
        f"/api/v1/bills/{bill['id']}/pay", json={}, headers=auth(token)
    )
    assert again.status_code == 409
    assert again.json()["code"] == "already_paid"


def test_recurring_bill_advances_after_payment(
    client: TestClient, registered_user: dict
) -> None:
    token = registered_user["access_token"]
    today = date.today()
    bill = create_bill(
        client,
        token,
        name="Rent",
        amount="25000.00",
        recurrence="monthly",
        due_date=today.isoformat(),
    )

    paid = client.post(
        f"/api/v1/bills/{bill['id']}/pay",
        json={"paid_on": today.isoformat()},
        headers=auth(token),
    )
    assert paid.status_code == 200, paid.text
    result = paid.json()
    assert result["status"] == "unpaid"
    assert result["due_date"] > today.isoformat()
    assert result["recurrence"] == "monthly"

    duplicate = client.post(
        f"/api/v1/bills/{bill['id']}/pay",
        json={"paid_on": today.isoformat()},
        headers=auth(token),
    )
    assert duplicate.status_code == 409
    assert duplicate.json()["code"] == "payment_already_recorded"


def test_recurring_bill_blocks_duplicate_backdated_payment(
    client: TestClient, registered_user: dict
) -> None:
    token = registered_user["access_token"]
    today = date.today()
    bill = create_bill(
        client,
        token,
        name="Water",
        amount="800.00",
        recurrence="monthly",
        due_date=today.isoformat(),
    )

    paid_on = (today - timedelta(days=3)).isoformat()
    first = client.post(
        f"/api/v1/bills/{bill['id']}/pay",
        json={"paid_on": paid_on},
        headers=auth(token),
    )
    assert first.status_code == 200, first.text

    # The guard must compare the submitted payment date, not the wall-clock
    # time at which the previous payment happened to be recorded.
    duplicate = client.post(
        f"/api/v1/bills/{bill['id']}/pay",
        json={"paid_on": paid_on},
        headers=auth(token),
    )
    assert duplicate.status_code == 409
    assert duplicate.json()["code"] == "payment_already_recorded"


def test_delete_bill_removes_payment_history(
    client: TestClient, registered_user: dict, db: Session
) -> None:
    token = registered_user["access_token"]
    bill = create_bill(client, token)
    client.post(
        f"/api/v1/bills/{bill['id']}/pay", json={}, headers=auth(token)
    )
    assert db.scalar(select(func.count()).select_from(Payment)) == 1

    deleted = client.delete(f"/api/v1/bills/{bill['id']}", headers=auth(token))
    assert deleted.status_code == 204
    assert db.scalar(select(func.count()).select_from(Payment)) == 0


def test_bills_are_isolated_between_users(
    client: TestClient, registered_user: dict
) -> None:
    owner_token = registered_user["access_token"]
    bill = create_bill(client, owner_token)

    other = register(client, "other-bills@example.com")
    other_token = other["access_token"]

    assert (
        client.get(f"/api/v1/bills/{bill['id']}", headers=auth(other_token)).status_code
        == 404
    )
    assert (
        client.patch(
            f"/api/v1/bills/{bill['id']}",
            json={"name": "hijacked"},
            headers=auth(other_token),
        ).status_code
        == 404
    )
    assert (
        client.post(
            f"/api/v1/bills/{bill['id']}/pay", json={}, headers=auth(other_token)
        ).status_code
        == 404
    )
    assert (
        client.delete(
            f"/api/v1/bills/{bill['id']}", headers=auth(other_token)
        ).status_code
        == 404
    )


def test_bill_validation(
    client: TestClient, registered_user: dict
) -> None:
    token = registered_user["access_token"]

    zero_amount = client.post(
        "/api/v1/bills",
        json={
            "name": "Zero bill",
            "amount": "0.00",
            "due_date": date.today().isoformat(),
        },
        headers=auth(token),
    )
    assert zero_amount.status_code == 422

    bad_recurrence = client.post(
        "/api/v1/bills",
        json={
            "name": "Daily bill",
            "amount": "10.00",
            "due_date": date.today().isoformat(),
            "recurrence": "daily",
        },
        headers=auth(token),
    )
    assert bad_recurrence.status_code == 422


def test_upcoming_window_includes_bills_and_subscriptions(
    client: TestClient, registered_user: dict
) -> None:
    token = registered_user["access_token"]
    today = date.today()

    create_bill(
        client,
        token,
        name="Soon bill",
        due_date=(today + timedelta(days=5)).isoformat(),
    )
    create_bill(
        client,
        token,
        name="Later bill",
        due_date=(today + timedelta(days=40)).isoformat(),
    )
    create_subscription(
        client,
        token,
        name="Soon subscription",
        next_payment_date=(today + timedelta(days=7)).isoformat(),
    )

    narrow = client.get(
        "/api/v1/upcoming", params={"days": 30}, headers=auth(token)
    )
    assert narrow.status_code == 200
    narrow_items = narrow.json()
    assert {"Soon bill", "Soon subscription"} <= {
        item["name"] for item in narrow_items
    }
    assert "Later bill" not in {item["name"] for item in narrow_items}

    wide = client.get(
        "/api/v1/upcoming", params={"days": 60}, headers=auth(token)
    )
    assert "Later bill" in {item["name"] for item in wide.json()}

    dates = [item["due_date"] for item in wide.json()]
    assert dates == sorted(dates)
