"""Unified financial summary, upcoming calendar and recurring detection."""

from datetime import date, timedelta
from decimal import Decimal

from fastapi.testclient import TestClient

from tests.phase2_helpers import (
    auth,
    connect_bank,
    create_bill,
    create_subscription,
    list_accounts,
    list_transactions,
    register,
)


def _money(value: Decimal) -> str:
    return f"{value.quantize(Decimal('0.01')):.2f}"


def test_empty_summary_for_new_user(
    client: TestClient, registered_user: dict
) -> None:
    response = client.get(
        "/api/v1/summary", headers=auth(registered_user["access_token"])
    )
    assert response.status_code == 200, response.text
    summary = response.json()

    assert summary["currency"] == "INR"
    assert summary["total_balance"] == "0.00"
    assert summary["total_available"] == "0.00"
    assert summary["month_income"] == "0.00"
    assert summary["month_expenses"] == "0.00"
    assert summary["net_this_month"] == "0.00"
    assert summary["upcoming_total"] == "0.00"
    assert summary["accounts_count"] == 0
    assert summary["connected_accounts_count"] == 0
    assert summary["is_mock_data"] is False
    assert summary["upcoming_payments"] == []
    assert summary["recent_transactions"] == []
    assert summary["last_synced_at"] is None


def test_summary_aggregates_balances_and_month_activity(
    client: TestClient, registered_user: dict
) -> None:
    token = registered_user["access_token"]
    connect_bank(client, token)

    accounts = list_accounts(client, token)
    assert len(accounts) == 2
    expected_balance = sum(
        (Decimal(account["balance"]) for account in accounts), Decimal("0.00")
    )
    expected_available = sum(
        (Decimal(account["available_balance"]) for account in accounts),
        Decimal("0.00"),
    )

    today = date.today()
    month_start = today.replace(day=1)
    month_end = (month_start + timedelta(days=32)).replace(day=1) - timedelta(days=1)
    # The summary covers the whole calendar month, including any stored
    # transaction dated later in the month (the mock allows one day ahead).
    transactions = list_transactions(
        client,
        token,
        from_date=month_start.isoformat(),
        to_date=month_end.isoformat(),
        limit=200,
    )["items"]
    assert transactions
    expected_income = sum(
        (Decimal(item["amount"]) for item in transactions if Decimal(item["amount"]) > 0),
        Decimal("0.00"),
    )
    expected_expenses = sum(
        (-Decimal(item["amount"]) for item in transactions if Decimal(item["amount"]) < 0),
        Decimal("0.00"),
    )
    # Salary arrives on the first of every month in the mock provider.
    assert _money(expected_income) == "85000.00"

    response = client.get("/api/v1/summary", headers=auth(token))
    assert response.status_code == 200, response.text
    summary = response.json()

    assert summary["total_balance"] == _money(expected_balance)
    assert summary["total_available"] == _money(expected_available)
    assert summary["accounts_count"] == 2
    assert summary["connected_accounts_count"] == 1
    assert summary["is_mock_data"] is True
    assert summary["month_income"] == _money(expected_income)
    assert summary["month_expenses"] == _money(expected_expenses)
    assert summary["net_this_month"] == _money(
        expected_income - expected_expenses
    )
    assert summary["last_synced_at"] is not None

    recent = summary["recent_transactions"]
    assert 0 < len(recent) <= 6
    dates = [item["occurred_on"] for item in recent]
    assert dates == sorted(dates, reverse=True)
    assert all(item["account"]["name"] for item in recent)


def test_summary_includes_upcoming_bills_and_subscriptions(
    client: TestClient, registered_user: dict
) -> None:
    token = registered_user["access_token"]
    today = date.today()

    create_bill(
        client,
        token,
        name="Broadband bill",
        amount="999.00",
        due_date=(today + timedelta(days=5)).isoformat(),
    )
    create_subscription(
        client,
        token,
        name="Music plan",
        amount="119.00",
        next_payment_date=(today + timedelta(days=7)).isoformat(),
    )

    paid = create_bill(
        client,
        token,
        name="Already paid bill",
        amount="500.00",
        due_date=(today + timedelta(days=3)).isoformat(),
    )
    client.post(
        f"/api/v1/bills/{paid['id']}/pay", json={}, headers=auth(token)
    )

    response = client.get(
        "/api/v1/summary", params={"days": 30}, headers=auth(token)
    )
    assert response.status_code == 200, response.text
    summary = response.json()

    assert summary["upcoming_total"] == "1118.00"
    assert summary["upcoming_bills_count"] == 1
    assert summary["upcoming_subscriptions_count"] == 1
    names = {item["name"] for item in summary["upcoming_payments"]}
    assert names == {"Broadband bill", "Music plan"}

    items = summary["upcoming_payments"]
    assert [item["due_date"] for item in items] == sorted(
        item["due_date"] for item in items
    )
    bill_item = next(item for item in items if item["kind"] == "bill")
    subscription_item = next(
        item for item in items if item["kind"] == "subscription"
    )
    assert bill_item["status"] == "upcoming"
    assert subscription_item["is_recurring"] is True


def test_upcoming_calendar_marks_overdue_bills(
    client: TestClient, registered_user: dict
) -> None:
    token = registered_user["access_token"]
    today = date.today()
    create_bill(
        client,
        token,
        name="Overdue rent",
        amount="25000.00",
        due_date=(today - timedelta(days=4)).isoformat(),
    )

    response = client.get(
        "/api/v1/upcoming", params={"days": 30}, headers=auth(token)
    )
    assert response.status_code == 200, response.text
    items = response.json()
    assert len(items) == 1
    assert items[0]["status"] == "overdue"
    assert items[0]["amount"] == "25000.00"


def test_upcoming_calendar_marks_overdue_subscriptions(
    client: TestClient, registered_user: dict
) -> None:
    token = registered_user["access_token"]
    today = date.today()
    create_subscription(
        client,
        token,
        name="Old plan",
        next_payment_date=(today - timedelta(days=2)).isoformat(),
    )

    response = client.get(
        "/api/v1/upcoming", params={"days": 30}, headers=auth(token)
    )
    assert response.status_code == 200, response.text
    items = response.json()
    assert len(items) == 1
    assert items[0]["kind"] == "subscription"
    assert items[0]["status"] == "overdue"


def test_summary_is_isolated_between_users(
    client: TestClient, registered_user: dict
) -> None:
    owner_token = registered_user["access_token"]
    connect_bank(client, owner_token)

    other = register(client, "other-summary@example.com")
    other_token = other["access_token"]

    owner_summary = client.get("/api/v1/summary", headers=auth(owner_token)).json()
    assert owner_summary["accounts_count"] == 2

    other_summary = client.get("/api/v1/summary", headers=auth(other_token)).json()
    assert other_summary["accounts_count"] == 0
    assert other_summary["total_balance"] == "0.00"
    assert other_summary["recent_transactions"] == []
    assert other_summary["upcoming_payments"] == []
    assert other_summary["is_mock_data"] is False

    other_upcoming = client.get("/api/v1/upcoming", headers=auth(other_token))
    assert other_upcoming.status_code == 200
    assert other_upcoming.json() == []


def test_recurring_detection_finds_stable_merchants(
    client: TestClient, registered_user: dict
) -> None:
    token = registered_user["access_token"]
    connect_bank(client, token)

    response = client.get(
        "/api/v1/recurring-payments", headers=auth(token)
    )
    assert response.status_code == 200, response.text
    suggestions = response.json()
    assert suggestions
    merchants = {item["merchant"].lower() for item in suggestions}
    assert {"landlord", "state power", "netflix"} <= merchants

    for item in suggestions:
        assert item["cadence"] in {
            "weekly",
            "biweekly",
            "monthly",
            "quarterly",
            "semiannual",
            "yearly",
        }
        assert 0.3 <= item["confidence"] <= 0.97
        assert item["occurrences"] >= 2
        assert item["sample_transaction_ids"]
        assert len(item["sample_transaction_ids"]) <= 3
        assert Decimal(item["average_amount"]) > 0

    rent = next(
        item for item in suggestions if item["merchant"].lower() == "landlord"
    )
    assert rent["cadence"] == "monthly"
    assert rent["average_amount"] == "25000.00"

    # Income must never be suggested as a recurring outgoing payment.
    assert "acme corp" not in merchants

    # Detection is suggestion-only: it must not create subscriptions.
    subscriptions = client.get("/api/v1/subscriptions", headers=auth(token))
    assert subscriptions.json()["total"] == 0


def test_recurring_detection_links_existing_subscription(
    client: TestClient, registered_user: dict
) -> None:
    token = registered_user["access_token"]
    connect_bank(client, token)
    subscription = create_subscription(client, token, name="Netflix")

    response = client.get("/api/v1/recurring-payments", headers=auth(token))
    assert response.status_code == 200, response.text
    netflix = next(
        item
        for item in response.json()
        if item["merchant"].lower() == "netflix"
    )
    assert netflix["matched_subscription_id"] == subscription["id"]
    assert netflix["matched_bill_id"] is None


def test_recurring_detection_respects_min_occurrences(
    client: TestClient, registered_user: dict
) -> None:
    token = registered_user["access_token"]
    connect_bank(client, token)

    response = client.get(
        "/api/v1/recurring-payments",
        params={"min_occurrences": 5},
        headers=auth(token),
    )
    assert response.status_code == 200, response.text
    # The mock history holds four monthly occurrences per merchant.
    assert response.json() == []


def test_overview_endpoints_require_authentication(client: TestClient) -> None:
    assert client.get("/api/v1/summary").status_code == 401
    assert client.get("/api/v1/upcoming").status_code == 401
    assert client.get("/api/v1/recurring-payments").status_code == 401
