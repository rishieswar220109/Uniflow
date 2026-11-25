"""Deterministic recurring-payment detection.

Phase 2 only *suggests* recurring payments from stored transactions; it never
creates bills or subscriptions automatically. Detection is rule-based and
explainable: repeated similar amounts at a stable interval, with the supporting
transactions returned for review.
"""

from __future__ import annotations

import statistics
from collections import defaultdict
from datetime import date, timedelta
from decimal import Decimal

from sqlalchemy.orm import Session

from app.models.financial import Transaction
from app.repositories.bill_repository import BillRepository
from app.repositories.subscription_repository import SubscriptionRepository
from app.repositories.transaction_repository import TransactionRepository
from app.schemas.overview import RecurringSuggestionRead


def _cadence_for_gap(days: float) -> str | None:
    if 5 <= days <= 9:
        return "weekly"
    if 12 <= days <= 18:
        return "biweekly"
    if 25 <= days <= 35:
        return "monthly"
    if 80 <= days <= 100:
        return "quarterly"
    if 175 <= days <= 200:
        return "semiannual"
    if 350 <= days <= 380:
        return "yearly"
    return None


class RecurringPaymentService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.transactions = TransactionRepository(db)
        self.subscriptions = SubscriptionRepository(db)
        self.bills = BillRepository(db)

    def detect(
        self, user, *, lookback_days: int = 180, min_occurrences: int = 2
    ) -> list[RecurringSuggestionRead]:
        since = date.today() - timedelta(days=lookback_days)
        transactions = self.transactions.list_since(user.id, since)

        groups: dict[str, list[Transaction]] = defaultdict(list)
        for transaction in transactions:
            if transaction.amount >= 0:
                continue
            if transaction.transaction_type == "transfer":
                continue
            label = self._label(transaction)
            if label:
                groups[label].append(transaction)

        suggestions: list[RecurringSuggestionRead] = []
        for label, records in groups.items():
            if len(records) < min_occurrences:
                continue
            records.sort(key=lambda item: item.occurred_on)
            dates = sorted({record.occurred_on for record in records})
            if len(dates) < min_occurrences:
                continue

            gaps = [
                (dates[index] - dates[index - 1]).days
                for index in range(1, len(dates))
            ]
            median_gap = statistics.median(gaps)
            if median_gap <= 0:
                continue
            cadence = _cadence_for_gap(median_gap)
            if cadence is None:
                continue

            amounts = [abs(record.amount) for record in records]
            average = sum(amounts) / len(amounts)
            if average == 0:
                continue
            deviation = max(abs(amount - average) for amount in amounts) / average
            if deviation > 0.25:
                continue

            gap_variance = statistics.mean(
                abs(gap - median_gap) for gap in gaps
            ) / median_gap
            confidence = (
                0.45
                + 0.12 * min(len(records), 4)
                - min(gap_variance, 0.5) * 0.4
            )
            confidence = round(max(0.3, min(0.97, confidence)), 2)

            last_seen = records[-1].occurred_on
            next_expected = last_seen + timedelta(days=int(round(median_gap)))
            if next_expected < date.today() - timedelta(days=45):
                continue

            subscription = self.subscriptions.find_by_name(user.id, label)
            bill = self.bills.find_by_name(user.id, label)
            suggestions.append(
                RecurringSuggestionRead(
                    merchant=label.title(),
                    cadence=cadence,
                    average_amount=Decimal(str(average)).quantize(
                        Decimal("0.01")
                    ),
                    currency=records[-1].currency,
                    occurrences=len(records),
                    last_seen_on=last_seen,
                    next_expected_on=next_expected,
                    confidence=confidence,
                    matched_subscription_id=(
                        subscription.id if subscription is not None else None
                    ),
                    matched_bill_id=bill.id if bill is not None else None,
                    sample_transaction_ids=[
                        record.id for record in records[-3:]
                    ],
                )
            )

        suggestions.sort(
            key=lambda item: (item.confidence, item.next_expected_on),
            reverse=True,
        )
        return suggestions

    @staticmethod
    def _label(transaction: Transaction) -> str:
        source = (transaction.merchant or transaction.description or "").strip()
        if not source:
            return ""
        return source.lower()
