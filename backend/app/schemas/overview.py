"""Schemas for the unified financial overview and recurring detection."""

import uuid
from datetime import date, datetime

from pydantic import BaseModel

from app.schemas.common import Money
from app.schemas.transactions import TransactionRead


class UpcomingPaymentRead(BaseModel):
    kind: str
    id: uuid.UUID
    name: str
    amount: Money
    currency: str
    due_date: date
    status: str
    autopay: bool
    is_recurring: bool


class CurrencyTotals(BaseModel):
    """Totals for one currency. Never converted into another currency."""

    currency: str
    total_balance: Money
    total_available: Money
    accounts_count: int
    month_income: Money
    month_expenses: Money
    upcoming_total: Money


class SummaryRead(BaseModel):
    currency: str
    total_balance: Money
    total_available: Money
    accounts_count: int
    connected_accounts_count: int
    is_mock_data: bool
    month_income: Money
    month_expenses: Money
    net_this_month: Money
    upcoming_total: Money
    upcoming_bills_count: int
    upcoming_subscriptions_count: int
    upcoming_payments: list[UpcomingPaymentRead]
    recent_transactions: list[TransactionRead]
    last_synced_at: datetime | None
    currency_breakdown: list[CurrencyTotals] = []


class RecurringSuggestionRead(BaseModel):
    merchant: str
    cadence: str
    average_amount: Money
    currency: str
    occurrences: int
    last_seen_on: date
    next_expected_on: date
    confidence: float
    matched_subscription_id: uuid.UUID | None = None
    matched_bill_id: uuid.UUID | None = None
    sample_transaction_ids: list[uuid.UUID] = []
