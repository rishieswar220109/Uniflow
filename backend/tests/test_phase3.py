"""Phase 3 financial intelligence tests."""

import uuid
from datetime import date, timedelta
from decimal import Decimal

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.financial import SpendingPreference, Transaction
from tests.phase2_helpers import (
    auth,
    connect_bank,
    create_bill,
    create_subscription,
    list_accounts,
    list_transactions,
    register,
)

PASSWORD = "Guardian123"


def _money(value: Decimal) -> str:
    return f"{value.quantize(Decimal('0.01')):.2f}"


def _first_of_month(days_back: int = 0) -> date:
    today = date.today()
    month = today.month - days_back
    year = today.year
    while month < 1:
        month += 12
        year -= 1
    return date(year, month, 1)


# ------------------------------------------------------------------ budgets


def test_budget_crud(client: TestClient, registered_user: dict) -> None:
    token = registered_user["access_token"]

    # Create a monthly budget
    start = _first_of_month()
    end = date(start.year, start.month + 1, 1) - timedelta(days=1)
    response = client.post(
        "/api/v1/budgets",
        json={
            "name": "Groceries monthly",
            "period_start": start.isoformat(),
            "period_end": end.isoformat(),
            "amount": "8000.00",
            "currency": "INR",
            "alert_threshold": 80,
        },
        headers=auth(token),
    )
    assert response.status_code == 201, response.text
    budget = response.json()
    assert budget["name"] == "Groceries monthly"
    assert budget["amount"] == "8000.00"
    assert budget["alert_threshold"] == 80
    assert budget["is_active"] is True

    budget_id = budget["id"]

    # List budgets
    response = client.get("/api/v1/budgets", headers=auth(token))
    assert response.status_code == 200, response.text
    data = response.json()
    assert data["total"] == 1
    assert len(data["items"]) == 1

    # Get one budget
    response = client.get(f"/api/v1/budgets/{budget_id}", headers=auth(token))
    assert response.status_code == 200, response.text
    assert response.json()["id"] == budget_id

    # Update budget
    response = client.patch(
        f"/api/v1/budgets/{budget_id}",
        json={"amount": "10000.00", "alert_threshold": 90},
        headers=auth(token),
    )
    assert response.status_code == 200, response.text
    assert response.json()["amount"] == "10000.00"
    assert response.json()["alert_threshold"] == 90

    # Delete budget
    response = client.delete(f"/api/v1/budgets/{budget_id}", headers=auth(token))
    assert response.status_code == 204, response.text

    response = client.get("/api/v1/budgets", headers=auth(token))
    assert response.json()["total"] == 0


def test_budget_spending_summary(client: TestClient, registered_user: dict) -> None:
    token = registered_user["access_token"]
    connect_bank(client, token)
    accounts = list_accounts(client, token)
    checking_id = accounts[0]["id"]

    # Use a future date so mock-provider synced transactions do not pollute it.
    tx_date = date(2030, 1, 15)
    start = date(2030, 1, 1)
    end = date(2030, 1, 31)

    client.post(
        "/api/v1/transactions",
        json={
            "account_id": checking_id,
            "amount": "-2500.00",
            "description": "Grocery shopping",
            "merchant": "BigBasket",
            "occurred_on": tx_date.isoformat(),
            "category_id": None,
        },
        headers=auth(token),
    )

    # Create a budget covering that future period with no category (all expenses)
    response = client.post(
        "/api/v1/budgets",
        json={
            "name": "January 2030 expenses",
            "period_start": start.isoformat(),
            "period_end": end.isoformat(),
            "amount": "10000.00",
            "currency": "INR",
        },
        headers=auth(token),
    )
    assert response.status_code == 201, response.text
    budget_id = response.json()["id"]

    # Get spending summary
    response = client.get(
        f"/api/v1/budgets/{budget_id}/spending", headers=auth(token)
    )
    assert response.status_code == 200, response.text
    summary = response.json()
    assert summary["spent"] == "2500.00"
    assert summary["remaining"] == "7500.00"
    assert summary["overspending"] is False
    assert summary["percent_used"] == 25.0


def test_budget_period_overlap_rejected(
    client: TestClient, registered_user: dict
) -> None:
    token = registered_user["access_token"]
    start = _first_of_month()
    end = date(start.year, start.month + 1, 1) - timedelta(days=1)

    client.post(
        "/api/v1/budgets",
        json={
            "name": "Budget one",
            "period_start": start.isoformat(),
            "period_end": end.isoformat(),
            "amount": "5000.00",
        },
        headers=auth(token),
    )
    response = client.post(
        "/api/v1/budgets",
        json={
            "name": "Budget two overlapping",
            "period_start": start.isoformat(),
            "period_end": end.isoformat(),
            "amount": "3000.00",
        },
        headers=auth(token),
    )
    assert response.status_code == 409, response.text
    assert response.json()["code"] == "budget_period_overlap"


def test_budget_isolation_between_users(client: TestClient) -> None:
    user_a = register(client, "budget-a@example.com")
    user_b = register(client, "budget-b@example.com")
    token_a = user_a["access_token"]
    token_b = user_b["access_token"]

    start = _first_of_month()
    end = date(start.year, start.month + 1, 1) - timedelta(days=1)

    client.post(
        "/api/v1/budgets",
        json={
            "name": "User A budget",
            "period_start": start.isoformat(),
            "period_end": end.isoformat(),
            "amount": "5000.00",
        },
        headers=auth(token_a),
    )

    # User B cannot see or access User A's budget
    response = client.get("/api/v1/budgets", headers=auth(token_b))
    assert response.json()["total"] == 0

    # Need the budget id to test isolation; create and fetch for user A
    response = client.get("/api/v1/budgets", headers=auth(token_a))
    budget_id = response.json()["items"][0]["id"]

    response = client.get(f"/api/v1/budgets/{budget_id}", headers=auth(token_b))
    assert response.status_code == 404, response.text


# ------------------------------------------------------------------ savings goals


def test_savings_goal_crud(client: TestClient, registered_user: dict) -> None:
    token = registered_user["access_token"]

    response = client.post(
        "/api/v1/savings-goals",
        json={
            "name": "Emergency fund",
            "target_amount": "50000.00",
            "currency": "INR",
            "target_date": "2027-12-31",
        },
        headers=auth(token),
    )
    assert response.status_code == 201, response.text
    goal = response.json()
    assert goal["name"] == "Emergency fund"
    assert goal["target_amount"] == "50000.00"
    assert goal["current_amount"] == "0.00"
    assert goal["percent_funded"] == 0.0

    goal_id = goal["id"]

    # List
    response = client.get("/api/v1/savings-goals", headers=auth(token))
    assert response.status_code == 200, response.text
    assert response.json()["total"] == 1

    # Summary
    response = client.get("/api/v1/savings-goals/summary", headers=auth(token))
    assert response.status_code == 200, response.text
    summary = response.json()
    assert summary["total_target"] == "50000.00"
    assert summary["total_saved"] == "0.00"
    assert summary["goal_count"] == 1

    # Update current_amount
    response = client.patch(
        f"/api/v1/savings-goals/{goal_id}",
        json={"current_amount": "12500.00"},
        headers=auth(token),
    )
    assert response.status_code == 200, response.text
    updated = response.json()
    assert updated["current_amount"] == "12500.00"
    assert updated["percent_funded"] == 25.0

    # Delete
    response = client.delete(f"/api/v1/savings-goals/{goal_id}", headers=auth(token))
    assert response.status_code == 204, response.text


# ------------------------------------------------------------------ spending preferences


def test_spending_preferences_defaults_and_update(
    client: TestClient, registered_user: dict
) -> None:
    token = registered_user["access_token"]

    # Get/create defaults
    response = client.get("/api/v1/spending-preferences", headers=auth(token))
    assert response.status_code == 200, response.text
    prefs = response.json()
    assert prefs["proactive_awareness_enabled"] is True
    assert prefs["significant_spending_threshold"] == "5000.00"
    assert prefs["reminder_advance_days"] == 3
    assert prefs["enable_due_reminders"] is True
    assert prefs["enable_entertainment_alerts"] is False

    # Update
    response = client.patch(
        "/api/v1/spending-preferences",
        json={
            "significant_spending_threshold": "10000.00",
            "reminder_advance_days": 4,
            "enable_entertainment_alerts": True,
            "entertainment_categories": "entertainment,dining,shopping",
            "reminder_frequency": "weekly",
        },
        headers=auth(token),
    )
    assert response.status_code == 200, response.text
    updated = response.json()
    assert updated["significant_spending_threshold"] == "10000.00"
    assert updated["reminder_advance_days"] == 4
    assert updated["enable_entertainment_alerts"] is True
    assert updated["reminder_frequency"] == "weekly"


def test_invalid_preferences_rejected(client: TestClient, registered_user: dict) -> None:
    token = registered_user["access_token"]

    response = client.patch(
        "/api/v1/spending-preferences",
        json={"reminder_frequency": "invalid"},
        headers=auth(token),
    )
    assert response.status_code == 422, response.text

    response = client.patch(
        "/api/v1/spending-preferences",
        json={"significant_spending_threshold": "-100.00"},
        headers=auth(token),
    )
    assert response.status_code == 422, response.text


# ------------------------------------------------------------------ intelligence


def test_intelligence_requires_authentication(client: TestClient) -> None:
    assert client.get("/api/v1/intelligence/summary").status_code == 401
    assert client.get("/api/v1/intelligence/forecast").status_code == 401
    assert client.get("/api/v1/intelligence/risks").status_code == 401
    assert client.get("/api/v1/intelligence/trends").status_code == 401


def test_monthly_summary(client: TestClient, registered_user: dict) -> None:
    token = registered_user["access_token"]
    connect_bank(client, token)
    accounts = list_accounts(client, token)
    checking_id = accounts[0]["id"]

    # Use a future month so mock-provider synced transactions do not pollute it.
    year, month = 2030, 1

    # Add income and expense transactions in that month
    client.post(
        "/api/v1/transactions",
        json={
            "account_id": checking_id,
            "amount": "85000.00",
            "description": "Salary credit",
            "merchant": "Acme Corp",
            "occurred_on": f"{year}-{month:02d}-01",
        },
        headers=auth(token),
    )
    client.post(
        "/api/v1/transactions",
        json={
            "account_id": checking_id,
            "amount": "-2500.00",
            "description": "Grocery shopping",
            "merchant": "BigBasket",
            "occurred_on": f"{year}-{month:02d}-15",
        },
        headers=auth(token),
    )

    response = client.get(
        f"/api/v1/intelligence/summary?year={year}&month={month}",
        headers=auth(token),
    )
    assert response.status_code == 200, response.text
    data = response.json()
    assert data["income"] == "85000.00"
    assert data["expenses"] == "2500.00"
    assert data["net"] == "82500.00"
    assert data["transaction_count"] == 2


def test_spending_trends(client: TestClient, registered_user: dict) -> None:
    token = registered_user["access_token"]
    connect_bank(client, token)
    accounts = list_accounts(client, token)
    checking_id = accounts[0]["id"]

    today = date.today()
    # Add several expenses across recent days
    for i in range(5):
        client.post(
            "/api/v1/transactions",
            json={
                "account_id": checking_id,
                "amount": f"-{(i + 1) * 1000}.00",
                "description": f"Expense {i}",
                "merchant": f"Merchant {i}",
                "occurred_on": (today - timedelta(days=i)).isoformat(),
            },
            headers=auth(token),
        )

    response = client.get(
        "/api/v1/intelligence/trends?lookback_days=30", headers=auth(token)
    )
    assert response.status_code == 200, response.text
    data = response.json()
    assert data["lookback_days"] == 30
    assert "weekly_spending" in data
    assert "trend" in data
    assert data["trend"] in {"stable", "increasing", "decreasing"}


def test_cash_flow_forecast(client: TestClient, registered_user: dict) -> None:
    token = registered_user["access_token"]
    connect_bank(client, token)

    response = client.get(
        "/api/v1/intelligence/forecast?days=30", headers=auth(token)
    )
    assert response.status_code == 200, response.text
    data = response.json()
    assert "available_balance" in data
    assert "expected_income" in data
    assert "expected_expenses" in data
    assert "projected_balance" in data
    assert "daily_projection" in data
    assert "upcoming_obligations" in data
    assert data["currency"] == "INR"
    assert len(data["daily_projection"]) == 31  # days + 1


def test_detect_risks(client: TestClient, registered_user: dict) -> None:
    token = registered_user["access_token"]
    connect_bank(client, token)

    # Create an overdue bill
    yesterday = (date.today() - timedelta(days=1)).isoformat()
    client.post(
        "/api/v1/bills",
        json={
            "name": "Overdue electricity",
            "payee": "State Power",
            "amount": "2500.00",
            "due_date": yesterday,
            "recurrence": "none",
        },
        headers=auth(token),
    )

    response = client.get("/api/v1/intelligence/risks", headers=auth(token))
    assert response.status_code == 200, response.text
    risks = response.json()
    assert isinstance(risks, list)
    # Should find the overdue bill
    overdue = [r for r in risks if r["insight_type"] == "upcoming_obligation"]
    assert len(overdue) >= 1


def test_generate_and_list_insights(client: TestClient, registered_user: dict) -> None:
    token = registered_user["access_token"]
    connect_bank(client, token)

    # Generate insights
    response = client.post(
        "/api/v1/intelligence/insights", headers=auth(token)
    )
    assert response.status_code == 201, response.text
    insights = response.json()
    assert isinstance(insights, list)

    # List insights
    response = client.get("/api/v1/intelligence/insights", headers=auth(token))
    assert response.status_code == 200, response.text
    data = response.json()
    assert data["total"] >= 0
    assert len(data["items"]) <= data["total"]


def test_proactive_awareness(client: TestClient, registered_user: dict) -> None:
    token = registered_user["access_token"]
    connect_bank(client, token)

    # Below threshold -> None
    response = client.post(
        "/api/v1/intelligence/proactive-awareness",
        json={"transaction_amount": "1000.00"},
        headers=auth(token),
    )
    assert response.status_code == 200, response.text
    assert response.json() is None

    # Above threshold -> awareness data
    response = client.post(
        "/api/v1/intelligence/proactive-awareness",
        json={"transaction_amount": "12000.00", "transaction_category": "shopping"},
        headers=auth(token),
    )
    assert response.status_code == 200, response.text
    data = response.json()
    assert data is not None
    assert data["significant_spending"] is True
    assert data["transaction_amount"] == "12000.00"
    assert "available_balance" in data
    assert "remaining_after_spending" in data
    assert "upcoming_dues" in data
    assert "insufficient_after_spending" in data


def test_proactive_awareness_missing_amount(client: TestClient, registered_user: dict) -> None:
    token = registered_user["access_token"]
    response = client.post(
        "/api/v1/intelligence/proactive-awareness",
        json={},
        headers=auth(token),
    )
    assert response.status_code == 400, response.text
    assert response.json()["code"] == "bad_request"


# ------------------------------------------------------- regression: batch 1


def _category_id(client: TestClient, token: str, slug: str) -> str:
    response = client.get("/api/v1/transactions/categories", headers=auth(token))
    assert response.status_code == 200, response.text
    categories = {item["slug"]: item["id"] for item in response.json()}
    return categories[slug]


def _create_budget(
    client: TestClient,
    token: str,
    *,
    name: str,
    start: date,
    end: date,
    amount: str = "5000.00",
    category_id: str | None = None,
) -> dict:
    payload = {
        "name": name,
        "period_start": start.isoformat(),
        "period_end": end.isoformat(),
        "amount": amount,
    }
    if category_id is not None:
        payload["category_id"] = category_id
    response = client.post("/api/v1/budgets", json=payload, headers=auth(token))
    assert response.status_code == 201, response.text
    return response.json()


def test_budget_overlap_is_category_scoped(
    client: TestClient, registered_user: dict
) -> None:
    """Budgets for different categories may share a period; duplicates may not."""
    token = registered_user["access_token"]
    connect_bank(client, token)
    start = date(2031, 1, 1)
    end = date(2031, 1, 31)

    _create_budget(client, token, name="Overall", start=start, end=end)

    groceries = _category_id(client, token, "groceries")
    dining = _category_id(client, token, "dining")
    _create_budget(
        client, token, name="Groceries", start=start, end=end, category_id=groceries
    )
    _create_budget(
        client, token, name="Dining", start=start, end=end, category_id=dining
    )

    # A second budget for the same category and period still conflicts.
    response = client.post(
        "/api/v1/budgets",
        json={
            "name": "Groceries again",
            "period_start": start.isoformat(),
            "period_end": end.isoformat(),
            "amount": "1000.00",
            "category_id": groceries,
        },
        headers=auth(token),
    )
    assert response.status_code == 409, response.text
    assert response.json()["code"] == "budget_period_overlap"

    # A second overall budget for the same period conflicts as well.
    response = client.post(
        "/api/v1/budgets",
        json={
            "name": "Second overall",
            "period_start": start.isoformat(),
            "period_end": end.isoformat(),
            "amount": "1000.00",
        },
        headers=auth(token),
    )
    assert response.status_code == 409, response.text


def test_budget_overlap_validated_on_update(
    client: TestClient, registered_user: dict
) -> None:
    token = registered_user["access_token"]
    january_start, january_end = date(2031, 1, 1), date(2031, 1, 31)
    february_start, february_end = date(2031, 2, 1), date(2031, 2, 28)

    _create_budget(
        client, token, name="January", start=january_start, end=january_end
    )
    february = _create_budget(
        client, token, name="February", start=february_start, end=february_end
    )

    # Moving February onto January's period is rejected.
    response = client.patch(
        f"/api/v1/budgets/{february['id']}",
        json={
            "period_start": january_start.isoformat(),
            "period_end": january_end.isoformat(),
        },
        headers=auth(token),
    )
    assert response.status_code == 409, response.text
    assert response.json()["code"] == "budget_period_overlap"

    # The rejected update must not have been partially applied.
    response = client.get(f"/api/v1/budgets/{february['id']}", headers=auth(token))
    assert response.status_code == 200, response.text
    stored = response.json()
    assert stored["period_start"] == february_start.isoformat()
    assert stored["period_end"] == february_end.isoformat()
    assert stored["amount"] == "5000.00"

    # Non-period edits still succeed.
    response = client.patch(
        f"/api/v1/budgets/{february['id']}",
        json={"amount": "9000.00"},
        headers=auth(token),
    )
    assert response.status_code == 200, response.text
    assert response.json()["amount"] == "9000.00"

    # Moving a budget onto a scope that is free is allowed.
    march_start, march_end = date(2031, 3, 1), date(2031, 3, 31)
    response = client.patch(
        f"/api/v1/budgets/{february['id']}",
        json={
            "period_start": march_start.isoformat(),
            "period_end": march_end.isoformat(),
        },
        headers=auth(token),
    )
    assert response.status_code == 200, response.text
    assert response.json()["period_start"] == march_start.isoformat()


def test_monthly_summary_is_bounded_to_requested_month(
    client: TestClient, registered_user: dict
) -> None:
    token = registered_user["access_token"]
    connect_bank(client, token)
    account_id = list_accounts(client, token)[0]["id"]

    for amount, occurred_on, description in (
        ("60000.00", "2032-01-05", "January salary"),
        ("-1200.00", "2032-01-20", "January groceries"),
        ("-900.00", "2032-02-03", "February groceries"),
        ("45000.00", "2032-02-05", "February salary"),
    ):
        response = client.post(
            "/api/v1/transactions",
            json={
                "account_id": account_id,
                "amount": amount,
                "description": description,
                "occurred_on": occurred_on,
            },
            headers=auth(token),
        )
        assert response.status_code == 201, response.text

    response = client.get(
        "/api/v1/intelligence/summary?year=2032&month=1", headers=auth(token)
    )
    assert response.status_code == 200, response.text
    january = response.json()
    assert january["period_start"] == "2032-01-01"
    assert january["period_end"] == "2032-01-31"
    assert january["income"] == "60000.00"
    assert january["expenses"] == "1200.00"
    assert january["transaction_count"] == 2
    # February records must not leak into January's category breakdown.
    category_total = sum(
        (Decimal(value) for value in january["category_expenses"].values()),
        Decimal("0"),
    )
    assert category_total == Decimal("1200.00")


def test_monthly_summary_does_not_mix_currencies(
    client: TestClient, registered_user: dict, db: Session
) -> None:
    token = registered_user["access_token"]
    connect_bank(client, token)
    account_id = list_accounts(client, token)[0]["id"]

    response = client.post(
        "/api/v1/transactions",
        json={
            "account_id": account_id,
            "amount": "8000.00",
            "description": "March salary",
            "occurred_on": "2032-03-02",
        },
        headers=auth(token),
    )
    assert response.status_code == 201, response.text

    db.add(
        Transaction(
            user_id=uuid.UUID(registered_user["user"]["id"]),
            account_id=uuid.UUID(account_id),
            category_id=None,
            amount=Decimal("-500.00"),
            currency="USD",
            description="US subscription",
            merchant=None,
            occurred_on=date(2032, 3, 10),
            transaction_type="expense",
            source="manual",
            dedupe_key=uuid.uuid4().hex,
        )
    )
    db.commit()

    response = client.get(
        "/api/v1/intelligence/summary?year=2032&month=3", headers=auth(token)
    )
    assert response.status_code == 200, response.text
    data = response.json()
    assert data["currency"] == "INR"
    assert data["income"] == "8000.00"
    assert data["expenses"] == "0.00"
    assert data["transaction_count"] == 1
    assert data["currency_breakdown"]["USD"]["expenses"] == "500.00"
    assert data["currency_breakdown"]["USD"]["count"] == 1


def test_budget_spending_ignores_other_currencies(
    client: TestClient, registered_user: dict, db: Session
) -> None:
    token = registered_user["access_token"]
    connect_bank(client, token)
    account_id = list_accounts(client, token)[0]["id"]

    budget = _create_budget(
        client,
        token,
        name="April 2033 expenses",
        start=date(2033, 4, 1),
        end=date(2033, 4, 30),
        amount="10000.00",
    )

    db.add(
        Transaction(
            user_id=uuid.UUID(registered_user["user"]["id"]),
            account_id=uuid.UUID(account_id),
            category_id=None,
            amount=Decimal("-700.00"),
            currency="USD",
            description="Foreign charge",
            merchant=None,
            occurred_on=date(2033, 4, 12),
            transaction_type="expense",
            source="manual",
            dedupe_key=uuid.uuid4().hex,
        )
    )
    db.commit()

    response = client.get(
        f"/api/v1/budgets/{budget['id']}/spending", headers=auth(token)
    )
    assert response.status_code == 200, response.text
    summary = response.json()
    assert summary["currency"] == "INR"
    assert summary["spent"] == "0.00"


def test_proactive_awareness_rejects_invalid_amount(
    client: TestClient, registered_user: dict
) -> None:
    token = registered_user["access_token"]

    response = client.post(
        "/api/v1/intelligence/proactive-awareness",
        json={"transaction_amount": "not-a-number"},
        headers=auth(token),
    )
    assert response.status_code == 422, response.text

    response = client.post(
        "/api/v1/intelligence/proactive-awareness",
        json={"transaction_amount": [1000]},
        headers=auth(token),
    )
    assert response.status_code == 422, response.text

    response = client.post(
        "/api/v1/intelligence/proactive-awareness",
        json={"transaction_amount": "0.00"},
        headers=auth(token),
    )
    assert response.status_code == 422, response.text


def test_generate_insights_does_not_duplicate(
    client: TestClient, registered_user: dict
) -> None:
    token = registered_user["access_token"]
    connect_bank(client, token)
    yesterday = (date.today() - timedelta(days=1)).isoformat()
    create_bill(
        client,
        token,
        name="Overdue electricity",
        amount="2500.00",
        due_date=yesterday,
    )

    first = client.post("/api/v1/intelligence/insights", headers=auth(token))
    assert first.status_code == 201, first.text
    assert len(first.json()) >= 1

    listed = client.get("/api/v1/intelligence/insights", headers=auth(token))
    total_after_first = listed.json()["total"]

    second = client.post("/api/v1/intelligence/insights", headers=auth(token))
    assert second.status_code == 201, second.text
    assert second.json() == []

    listed = client.get("/api/v1/intelligence/insights", headers=auth(token))
    assert listed.json()["total"] == total_after_first


def test_dismiss_unknown_or_foreign_insight_returns_404(
    client: TestClient, registered_user: dict
) -> None:
    token = registered_user["access_token"]
    connect_bank(client, token)
    create_bill(
        client,
        token,
        name="Overdue rent",
        amount="2500.00",
        due_date=(date.today() - timedelta(days=2)).isoformat(),
    )
    response = client.post("/api/v1/intelligence/insights", headers=auth(token))
    assert response.status_code == 201, response.text
    insight_id = response.json()[0]["id"]

    response = client.patch(
        f"/api/v1/intelligence/insights/{uuid.uuid4()}/dismiss", headers=auth(token)
    )
    assert response.status_code == 404, response.text

    other = register(client, "insight-other@example.com")
    response = client.patch(
        f"/api/v1/intelligence/insights/{insight_id}/dismiss",
        headers=auth(other["access_token"]),
    )
    assert response.status_code == 404, response.text

    # The owner can still dismiss it exactly once with a 204.
    response = client.patch(
        f"/api/v1/intelligence/insights/{insight_id}/dismiss", headers=auth(token)
    )
    assert response.status_code == 204, response.text


def test_risk_detection_does_not_write_preferences(
    client: TestClient, registered_user: dict, db: Session
) -> None:
    token = registered_user["access_token"]
    connect_bank(client, token)

    assert db.query(SpendingPreference).count() == 0

    response = client.get("/api/v1/intelligence/risks", headers=auth(token))
    assert response.status_code == 200, response.text

    assert db.query(SpendingPreference).count() == 0
