"""Unified financial overview used by the web and mobile dashboards."""

from __future__ import annotations

from datetime import date, timedelta
from decimal import Decimal

from sqlalchemy.orm import Session

from app.repositories.banking_repository import BankingRepository
from app.repositories.bill_repository import BillRepository
from app.repositories.subscription_repository import SubscriptionRepository
from app.repositories.transaction_repository import TransactionRepository
from app.schemas.overview import CurrencyTotals, SummaryRead, UpcomingPaymentRead
from app.services.banking_service import account_currency


def _month_bounds(today: date) -> tuple[date, date]:
    start = today.replace(day=1)
    if start.month == 12:
        next_month = date(start.year + 1, 1, 1)
    else:
        next_month = date(start.year, start.month + 1, 1)
    return start, next_month - timedelta(days=1)


def _due_state(due_date: date) -> str:
    today = date.today()
    if due_date < today:
        return "overdue"
    if due_date == today:
        return "due"
    return "upcoming"


def _dedupe_currency(user) -> str:
    return account_currency(user)


class SummaryService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.banking = BankingRepository(db)
        self.transactions = TransactionRepository(db)
        self.bills = BillRepository(db)
        self.subscriptions = SubscriptionRepository(db)

    def upcoming(self, user, *, days: int = 30) -> list[UpcomingPaymentRead]:
        bills = self.bills.list_upcoming(user.id, days=days)
        subscriptions = self.subscriptions.list_upcoming(user.id, days=days)

        items: list[UpcomingPaymentRead] = [
            UpcomingPaymentRead(
                kind="bill",
                id=bill.id,
                name=bill.name,
                amount=bill.amount,
                currency=bill.currency,
                due_date=bill.due_date,
                status=_due_state(bill.due_date),
                autopay=bill.autopay,
                is_recurring=bill.recurrence != "none",
            )
            for bill in bills
        ]
        items.extend(
            UpcomingPaymentRead(
                kind="subscription",
                id=subscription.id,
                name=subscription.name,
                amount=subscription.amount,
                currency=subscription.currency,
                due_date=subscription.next_payment_date,
                status=_due_state(subscription.next_payment_date),
                autopay=False,
                is_recurring=True,
            )
            for subscription in subscriptions
        )
        items.sort(key=lambda item: item.due_date)
        return items

    def summary(self, user, *, days: int = 30) -> SummaryRead:
        today = date.today()
        accounts = self.banking.list_accounts(user.id, active_only=True)
        currency = _dedupe_currency(user)
        # Exposed totals cover only the user's preferred currency. Amounts in
        # other currencies are reported separately below; no exchange rate is
        # invented to combine them.
        reporting_accounts = [
            account for account in accounts if account.currency == currency
        ]
        total_balance = sum(
            (account.balance for account in reporting_accounts), Decimal("0.00")
        )
        total_available = sum(
            (account.available_balance for account in reporting_accounts),
            Decimal("0.00"),
        )
        month_start, month_end = _month_bounds(today)
        income, expenses = self.transactions.sum_between(
            user.id, month_start, month_end, currency=currency
        )
        upcoming = self.upcoming(user, days=days)
        upcoming_in_currency = [item for item in upcoming if item.currency == currency]
        upcoming_total = sum(
            (item.amount for item in upcoming_in_currency), Decimal("0.00")
        )
        recent = self.transactions.list_recent(user.id, limit=6)
        synced = [
            account.last_synced_at
            for account in accounts
            if account.last_synced_at is not None
        ]
        last_synced_at = max(synced) if synced else None

        # One entry per currency, so a mixed-currency account set is visible
        # instead of being flattened into a single misleading total.
        currency_codes = {account.currency for account in accounts}
        currency_codes.update(item.currency for item in upcoming)
        currency_breakdown: list[CurrencyTotals] = []
        for code in sorted(currency_codes):
            accounts_in_currency = [
                account for account in accounts if account.currency == code
            ]
            currency_income, currency_expenses = self.transactions.sum_between(
                user.id, month_start, month_end, currency=code
            )
            currency_breakdown.append(
                CurrencyTotals(
                    currency=code,
                    total_balance=sum(
                        (account.balance for account in accounts_in_currency),
                        Decimal("0.00"),
                    ).quantize(Decimal("0.01")),
                    total_available=sum(
                        (
                            account.available_balance
                            for account in accounts_in_currency
                        ),
                        Decimal("0.00"),
                    ).quantize(Decimal("0.01")),
                    accounts_count=len(accounts_in_currency),
                    month_income=currency_income,
                    month_expenses=currency_expenses,
                    upcoming_total=sum(
                        (
                            item.amount
                            for item in upcoming
                            if item.currency == code
                        ),
                        Decimal("0.00"),
                    ).quantize(Decimal("0.01")),
                )
            )

        return SummaryRead(
            currency=currency,
            total_balance=total_balance.quantize(Decimal("0.01")),
            total_available=total_available.quantize(Decimal("0.01")),
            accounts_count=len(accounts),
            connected_accounts_count=len(
                {account.connection_id for account in accounts if account.connection_id}
            ),
            is_mock_data=any(account.is_mock for account in accounts),
            month_income=income,
            month_expenses=expenses,
            net_this_month=(income - expenses).quantize(Decimal("0.01")),
            upcoming_total=upcoming_total.quantize(Decimal("0.01")),
            upcoming_bills_count=sum(1 for item in upcoming if item.kind == "bill"),
            upcoming_subscriptions_count=sum(
                1 for item in upcoming if item.kind == "subscription"
            ),
            upcoming_payments=upcoming,
            recent_transactions=recent,
            last_synced_at=last_synced_at,
            currency_breakdown=currency_breakdown,
        )
