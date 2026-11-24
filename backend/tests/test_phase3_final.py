"""Phase 3 completion tests: forecasting, currency scoping, reports and awareness."""

import uuid
from datetime import date, timedelta
from decimal import Decimal

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.financial import FinancialAccount
from tests.phase2_helpers import (
    auth,
    connect_bank,
    create_bill,
    list_accounts,
    register,
)


def _money(value: Decimal) -> str:
    return f"{value.quantize(Decimal('0.01')):.2f}"


def _category_id(client: TestClient, token: str, slug: str) -> str:
    response = client.get("/api/v1/transactions/categories", headers=auth(token))
    assert response.status_code == 200, response.text
    return {item["slug"]: item["id"] for item in response.json()}[slug]


def _create_expense(
    client: TestClient,
    token: str,
    account_id: str,
    *,
    amount: str,
    description: str,
    occurred_on: date,
    merchant: str | None = None,
    category_id: str | None = None,
    allow_duplicate: bool = False,
) -> dict:
    payload = {
        "account_id": account_id,
        "amount": amount,
        "description": description,
        "merchant": merchant,
        "occurred_on": occurred_on.isoformat(),
        "category_id": category_id,
        "allow_duplicate": allow_duplicate,
    }
    response = client.post("/api/v1/transactions", json=payload, headers=auth(token))
    assert response.status_code == 201, response.text
    return response.json()


def _create_income(
    client: TestClient,
    token: str,
    account_id: str,
    *,
    amount: str,
    merchant: str,
    occurred_on: date,
) -> None:
    response = client.post(
        "/api/v1/transactions",
        json={
            "account_id": account_id,
            "amount": amount,
            "description": "Recurring salary",
            "merchant": merchant,
            "occurred_on": occurred_on.isoformat(),
        },
        headers=auth(token),
    )
    assert response.status_code == 201, response.text


# ------------------------------------------------------------------ forecasting


def test_forecast_applies_todays_obligations_to_opening_balance(
    client: TestClient, registered_user: dict
) -> None:
    token = registered_user["access_token"]
    connect_bank(client, token)
    today = date.today()

    create_bill(
        client,
        token,
        name="Due today broadband",
        amount="1000.00",
        due_date=today.isoformat(),
    )

    response = client.get(
        "/api/v1/intelligence/forecast?days=30", headers=auth(token)
    )
    assert response.status_code == 200, response.text
    forecast = response.json()

    assert forecast["starting_obligations"] == "1000.00"
    obligation = next(
        item for item in forecast["upcoming_obligations"] if item["name"] == "Due today broadband"
    )
    assert obligation["status"] == "due"

    opening = (
        Decimal(forecast["available_balance"]) - Decimal("1000.00")
    )
    assert forecast["daily_projection"][0]["projected_balance"] == _money(opening)
    # The last projected day must agree with the exposed projected balance.
    assert (
        forecast["daily_projection"][-1]["projected_balance"]
        == forecast["projected_balance"]
    )


def test_forecast_detects_recurring_income_source(
    client: TestClient, registered_user: dict
) -> None:
    token = registered_user["access_token"]
    connect_bank(client, token)
    account_id = list_accounts(client, token)[0]["id"]
    today = date.today()

    _create_income(
        client,
        token,
        account_id,
        amount="30000.00",
        merchant="Guaranteed Payroll",
        occurred_on=today - timedelta(days=60),
    )
    _create_income(
        client,
        token,
        account_id,
        amount="30000.00",
        merchant="Guaranteed Payroll",
        occurred_on=today - timedelta(days=30),
    )

    response = client.get(
        "/api/v1/intelligence/forecast?days=30", headers=auth(token)
    )
    assert response.status_code == 200, response.text
    forecast = response.json()

    source = next(
        item
        for item in forecast["income_sources"]
        if item["name"] == "Guaranteed Payroll"
    )
    assert source["cadence_days"] == 30
    assert source["monthly_estimate"] == "30000.00"
    assert Decimal(forecast["expected_income"]) >= Decimal("30000.00")
    assert "recurring income" in forecast["income_basis"].lower()
    assert "projections, not guarantees" in forecast["assumptions"]


# ---------------------------------------------------------------- currency scoping


def _add_usd_account(db: Session, user_id: str) -> None:
    db.add(
        FinancialAccount(
            user_id=uuid.UUID(user_id),
            connection_id=None,
            external_id="usd-wallet-1",
            name="US wallet",
            account_type="wallet",
            currency="USD",
            balance=Decimal("5000.00"),
            available_balance=Decimal("5000.00"),
            is_active=True,
            is_mock=False,
        )
    )
    db.commit()


def test_summary_does_not_mix_currencies(
    client: TestClient, registered_user: dict, db: Session
) -> None:
    token = registered_user["access_token"]
    connect_bank(client, token)
    accounts = list_accounts(client, token)
    expected_inr = sum(
        (Decimal(account["balance"]) for account in accounts), Decimal("0.00")
    )
    _add_usd_account(db, registered_user["user"]["id"])

    response = client.get("/api/v1/summary", headers=auth(token))
    assert response.status_code == 200, response.text
    summary = response.json()

    assert summary["currency"] == "INR"
    assert summary["total_balance"] == _money(expected_inr)
    # All accounts remain visible, but only INR is summed.
    assert summary["accounts_count"] == 3
    breakdown = {row["currency"]: row for row in summary["currency_breakdown"]}
    assert breakdown["INR"]["total_balance"] == _money(expected_inr)
    assert breakdown["USD"]["total_balance"] == "5000.00"
    assert breakdown["USD"]["accounts_count"] == 1


def test_forecast_excludes_other_currency_accounts(
    client: TestClient, registered_user: dict, db: Session
) -> None:
    token = registered_user["access_token"]
    connect_bank(client, token)
    accounts = list_accounts(client, token)
    expected_inr = sum(
        (Decimal(account["available_balance"]) for account in accounts),
        Decimal("0.00"),
    )
    _add_usd_account(db, registered_user["user"]["id"])

    response = client.get(
        "/api/v1/intelligence/forecast?days=30", headers=auth(token)
    )
    assert response.status_code == 200, response.text
    forecast = response.json()

    assert forecast["available_balance"] == _money(expected_inr)
    assert forecast["excluded_currencies"] == ["USD"]
    assert "USD" in forecast["assumptions"]


def test_savings_summary_reports_each_currency(
    client: TestClient, registered_user: dict
) -> None:
    token = registered_user["access_token"]

    inr = client.post(
        "/api/v1/savings-goals",
        json={"name": "Emergency fund", "target_amount": "10000.00", "currency": "INR"},
        headers=auth(token),
    )
    assert inr.status_code == 201, inr.text

    usd = client.post(
        "/api/v1/savings-goals",
        json={"name": "Travel fund", "target_amount": "2000.00", "currency": "USD"},
        headers=auth(token),
    )
    assert usd.status_code == 201, usd.text
    response = client.patch(
        f"/api/v1/savings-goals/{usd.json()['id']}",
        json={"current_amount": "500.00"},
        headers=auth(token),
    )
    assert response.status_code == 200, response.text

    response = client.get("/api/v1/savings-goals/summary", headers=auth(token))
    assert response.status_code == 200, response.text
    summary = response.json()

    assert summary["currency"] == "INR"
    assert summary["total_target"] == "10000.00"
    assert summary["total_saved"] == "0.00"
    assert summary["goal_count"] == 1
    assert summary["currency_breakdown"]["INR"]["goal_count"] == 1
    assert summary["currency_breakdown"]["USD"]["total_saved"] == "500.00"
    assert summary["currency_breakdown"]["USD"]["remaining"] == "1500.00"


# --------------------------------------------------------------------- reports


def test_reports_endpoint_returns_real_financial_data(
    client: TestClient, registered_user: dict
) -> None:
    token = registered_user["access_token"]
    connect_bank(client, token)
    account_id = list_accounts(client, token)[0]["id"]

    response = client.post(
        "/api/v1/transactions",
        json={
            "account_id": account_id,
            "amount": "50000.00",
            "description": "May salary",
            "occurred_on": "2034-05-02",
        },
        headers=auth(token),
    )
    assert response.status_code == 201, response.text
    _create_expense(
        client,
        token,
        account_id,
        amount="-3000.00",
        description="May rent",
        occurred_on=date(2034, 5, 5),
        merchant="Landlord",
    )
    response = client.post(
        "/api/v1/budgets",
        json={
            "name": "May 2034 budget",
            "period_start": "2034-05-01",
            "period_end": "2034-05-31",
            "amount": "5000.00",
            "currency": "INR",
        },
        headers=auth(token),
    )
    assert response.status_code == 201, response.text

    response = client.get(
        "/api/v1/intelligence/reports?year=2034&month=5", headers=auth(token)
    )
    assert response.status_code == 200, response.text
    report = response.json()

    assert report["year"] == 2034
    assert report["month"] == 5
    assert report["currency"] == "INR"
    assert report["income"] == "50000.00"
    assert report["expenses"] == "3000.00"
    assert report["net"] == "47000.00"
    assert report["savings_rate"] == 94.0
    assert report["transaction_count"] == 2
    assert report["category_breakdown"]
    assert report["top_merchants"][0]["name"] == "Landlord"
    assert report["budgets"][0]["spent"] == "3000.00"
    assert report["budgets"][0]["remaining"] == "2000.00"
    assert set(report["change"]) == {
        "income_percent",
        "expenses_percent",
        "net_percent",
    }
    assert "savings" in report
    assert report["notes"]


def test_reports_require_authentication(client: TestClient) -> None:
    assert client.get("/api/v1/intelligence/reports").status_code == 401


# --------------------------------------------------------- proactive awareness


def test_manual_transaction_returns_significant_spending_alert(
    client: TestClient, registered_user: dict
) -> None:
    token = registered_user["access_token"]
    connect_bank(client, token)
    account_id = list_accounts(client, token)[0]["id"]

    transaction = _create_expense(
        client,
        token,
        account_id,
        amount="-12000.00",
        description="Designer furniture",
        merchant="Luxury Store",
        occurred_on=date.today(),
    )

    assert transaction["alerts"]
    assert any(
        alert["insight_type"] == "significant_spending"
        for alert in transaction["alerts"]
    )
    listed = client.get(
        "/api/v1/intelligence/insights",
        params={"insight_type": "significant_spending"},
        headers=auth(token),
    )
    assert listed.status_code == 200, listed.text
    assert listed.json()["total"] >= 1


def test_entertainment_alert_respects_user_preference(
    client: TestClient, registered_user: dict
) -> None:
    token = registered_user["access_token"]
    connect_bank(client, token)
    account_id = list_accounts(client, token)[0]["id"]
    entertainment = _category_id(client, token, "entertainment")

    # Disabled by default: no entertainment insight is produced.
    quiet = _create_expense(
        client,
        token,
        account_id,
        amount="-600.00",
        description="Cinema ticket",
        merchant="Cinema",
        occurred_on=date.today(),
        category_id=entertainment,
    )
    assert not any(
        alert["insight_type"] == "entertainment_spending"
        for alert in quiet["alerts"]
    )

    response = client.patch(
        "/api/v1/spending-preferences",
        json={"enable_entertainment_alerts": True},
        headers=auth(token),
    )
    assert response.status_code == 200, response.text

    loud = _create_expense(
        client,
        token,
        account_id,
        amount="-700.00",
        description="Concert ticket",
        merchant="Live Nation",
        occurred_on=date.today(),
        category_id=entertainment,
    )
    assert any(
        alert["insight_type"] == "entertainment_spending"
        for alert in loud["alerts"]
    )


def test_blocked_duplicate_transaction_is_recorded_as_risk(
    client: TestClient, registered_user: dict
) -> None:
    token = registered_user["access_token"]
    connect_bank(client, token)
    account_id = list_accounts(client, token)[0]["id"]
    occurred_on = date.today()

    payload = {
        "account_id": account_id,
        "amount": "-2000.00",
        "description": "Coffee subscription",
        "merchant": "Corner Cafe",
        "occurred_on": occurred_on.isoformat(),
    }
    first = client.post("/api/v1/transactions", json=payload, headers=auth(token))
    assert first.status_code == 201, first.text

    duplicate = client.post("/api/v1/transactions", json=payload, headers=auth(token))
    assert duplicate.status_code == 409, duplicate.text
    assert duplicate.json()["code"] == "duplicate_transaction"

    listed = client.get(
        "/api/v1/intelligence/insights",
        params={"insight_type": "duplicate_transaction"},
        headers=auth(token),
    )
    assert listed.status_code == 200, listed.text
    assert listed.json()["total"] == 1
    assert "duplicate" in listed.json()["items"][0]["title"].lower()


def test_forced_duplicate_transaction_returns_duplicate_alert(
    client: TestClient, registered_user: dict
) -> None:
    token = registered_user["access_token"]
    connect_bank(client, token)
    account_id = list_accounts(client, token)[0]["id"]
    occurred_on = date.today()

    _create_expense(
        client,
        token,
        account_id,
        amount="-2000.00",
        description="Coffee subscription",
        merchant="Corner Cafe",
        occurred_on=occurred_on,
    )
    forced = _create_expense(
        client,
        token,
        account_id,
        amount="-2000.00",
        description="Coffee subscription",
        merchant="Corner Cafe",
        occurred_on=occurred_on,
        allow_duplicate=True,
    )

    assert any(
        alert["insight_type"] == "duplicate_transaction"
        for alert in forced["alerts"]
    )


# --------------------------------------------------------------- isolation


def test_reports_and_forecast_are_user_scoped(client: TestClient) -> None:
    owner = register(client, "report-owner@example.com")
    connect_bank(client, owner["access_token"])
    account_id = list_accounts(client, owner["access_token"])[0]["id"]
    _create_income(
        client,
        owner["access_token"],
        account_id,
        amount="10000.00",
        merchant="Owner Payroll",
        occurred_on=date.today() - timedelta(days=30),
    )

    other = register(client, "report-other@example.com")
    report = client.get(
        "/api/v1/intelligence/reports", headers=auth(other["access_token"])
    )
    assert report.status_code == 200, report.text
    assert report.json()["income"] == "0.00"
    assert report.json()["transaction_count"] == 0

    forecast = client.get(
        "/api/v1/intelligence/forecast", headers=auth(other["access_token"])
    )
    assert forecast.status_code == 200, forecast.text
    assert forecast.json()["available_balance"] == "0.00"
    assert forecast.json()["expected_income"] == "0.00"
