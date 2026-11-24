"""Financial intelligence engine: analysis, forecasts, reports and risks.

All calculations are deterministic and derived from stored financial records.
No AI-generated arithmetic is used for authoritative figures.
"""

from __future__ import annotations

import statistics
from datetime import date, timedelta
from decimal import Decimal
from typing import Literal

from sqlalchemy.orm import Session

from app.core.exceptions import NotFoundError
from app.models.financial import (
    Bill,
    FinancialAccount,
    Subscription,
    Transaction,
)
from app.repositories.bill_repository import BillRepository
from app.repositories.subscription_repository import SubscriptionRepository
from app.repositories.transaction_repository import TransactionRepository
from app.services.banking_service import account_currency
from app.services.recurrence import advance, add_months
from app.services.summary_service import SummaryService

RiskSeverity = Literal["info", "warning", "critical"]

CENT = Decimal("0.01")
DEFAULT_SIGNIFICANT_THRESHOLD = Decimal("5000.00")
DEFAULT_ENTERTAINMENT_CATEGORIES = "entertainment,dining"


def _money(value: Decimal) -> Decimal:
    return Decimal(value).quantize(CENT)


def _expense_label(transaction: Transaction) -> str:
    return (transaction.merchant or transaction.description).strip()


def _significant_title(transaction: Transaction) -> str:
    return f"Significant spending: {_expense_label(transaction)}"


def _month_bounds(year: int, month: int) -> tuple[date, date]:
    start = date(year, month, 1)
    if month == 12:
        end = date(year + 1, 1, 1) - timedelta(days=1)
    else:
        end = date(year, month + 1, 1) - timedelta(days=1)
    return start, end


def _previous_month(year: int, month: int) -> tuple[int, int]:
    if month == 1:
        return year - 1, 12
    return year, month - 1


class IntelligenceService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.transactions = TransactionRepository(db)
        self.bills = BillRepository(db)
        self.subscriptions = SubscriptionRepository(db)
        self.summary = SummaryService(db)

    # ---------------------------------------------------------------- analysis
    def monthly_summary(self, user, year: int, month: int) -> dict:
        """Income, expenses, and category breakdown for a calendar month.

        Only records dated inside the requested month are counted, so a query
        for one month never picks up later periods. Totals are reported in the
        user's preferred currency; records in other currencies are reported
        separately instead of being silently added together.
        """
        start, end = _month_bounds(year, month)
        currency = account_currency(user)
        transactions = self.transactions.list_between(user.id, start, end)

        # Per-currency totals keep amounts in different currencies apart.
        totals: dict[str, dict] = {}
        for transaction in transactions:
            bucket = totals.setdefault(
                transaction.currency,
                {
                    "income": Decimal("0.00"),
                    "expenses": Decimal("0.00"),
                    "count": 0,
                },
            )
            if transaction.amount > 0:
                bucket["income"] += transaction.amount
            else:
                bucket["expenses"] += abs(transaction.amount)
            bucket["count"] += 1

        selected = totals.get(
            currency,
            {"income": Decimal("0.00"), "expenses": Decimal("0.00"), "count": 0},
        )
        income = selected["income"].quantize(CENT)
        expenses = selected["expenses"].quantize(CENT)

        # Category-wise breakdown is limited to the reported currency.
        category_expenses: dict[str, Decimal] = {}
        category_income: dict[str, Decimal] = {}
        for transaction in transactions:
            if transaction.currency != currency:
                continue
            if transaction.category is None:
                key = "uncategorised"
            else:
                key = transaction.category.slug or "uncategorised"
            if transaction.amount > 0:
                category_income[key] = category_income.get(key, Decimal("0")) + abs(
                    transaction.amount
                )
            else:
                category_expenses[key] = category_expenses.get(
                    key, Decimal("0")
                ) + abs(transaction.amount)

        return {
            "year": year,
            "month": month,
            "period_start": start.isoformat(),
            "period_end": end.isoformat(),
            "currency": currency,
            "income": income,
            "expenses": expenses,
            "net": (income - expenses).quantize(CENT),
            "category_income": {
                k: v.quantize(CENT) for k, v in category_income.items()
            },
            "category_expenses": {
                k: v.quantize(CENT) for k, v in category_expenses.items()
            },
            "transaction_count": selected["count"],
            "currency_breakdown": {
                code: {
                    "income": bucket["income"].quantize(CENT),
                    "expenses": bucket["expenses"].quantize(CENT),
                    "count": bucket["count"],
                }
                for code, bucket in sorted(totals.items())
            },
        }

    def spending_trends(self, user, lookback_days: int = 90) -> dict:
        """Weekly spending totals over the lookback window for trend analysis."""
        today = date.today()
        since = today - timedelta(days=lookback_days)
        currency = account_currency(user)
        transactions = self.transactions.list_since(user.id, since)

        # Group expenses by ISO week, one currency at a time.
        weekly: dict[str, Decimal] = {}
        for transaction in transactions:
            if transaction.amount >= 0:
                continue
            if transaction.currency != currency:
                continue
            iso_week = transaction.occurred_on.isocalendar()
            week_key = f"{iso_week.year}-W{iso_week.week:02d}"
            weekly[week_key] = weekly.get(week_key, Decimal("0")) + abs(
                transaction.amount
            )

        sorted_weeks = sorted(weekly.items())
        values = [amount for _, amount in sorted_weeks]

        trend = "stable"
        if len(values) >= 3:
            first_half = statistics.mean(values[: len(values) // 2]) if values else Decimal("0")
            second_half = statistics.mean(values[len(values) // 2 :]) if values else Decimal("0")
            if second_half > first_half * Decimal("1.1"):
                trend = "increasing"
            elif second_half < first_half * Decimal("0.9"):
                trend = "decreasing"

        return {
            "lookback_days": lookback_days,
            "since": since.isoformat(),
            "currency": currency,
            "weekly_spending": {
                week: amount.quantize(CENT)
                for week, amount in sorted_weeks
            },
            "trend": trend,
        }

    # ------------------------------------------------------------ cash flow forecast
    def _monthly_income_estimate(
        self, history: list[Transaction], currency: str
    ) -> tuple[Decimal, str, list[dict]]:
        """Estimate monthly recurring income from stored credits.

        A source is recurring when it appears at least twice with a regular
        cadence (5-45 days) and a stable amount (within 40% of its median). The
        monthly estimate scales the median amount to a 30-day month. When no
        recurring source is found, the average of the three calendar months
        covered by the 90-day history is used, and the returned basis text
        says the estimate is a coarse fallback.
        """
        groups: dict[str, list[Transaction]] = {}
        for transaction in history:
            if transaction.amount <= 0 or transaction.transaction_type != "income":
                continue
            if transaction.currency != currency:
                continue
            label = (transaction.merchant or transaction.description).strip()
            if not label:
                continue
            groups.setdefault(label.lower(), []).append(transaction)

        sources: list[dict] = []
        monthly_total = Decimal("0.00")
        for _, records in sorted(groups.items()):
            if len(records) < 2:
                continue
            records.sort(key=lambda item: item.occurred_on)
            dates = [item.occurred_on for item in records]
            intervals = [
                (later - earlier).days
                for earlier, later in zip(dates, dates[1:])
                if (later - earlier).days > 0
            ]
            if not intervals:
                continue
            median_interval = Decimal(str(statistics.median(intervals)))
            if median_interval < 5 or median_interval > 45:
                continue
            amounts = sorted(abs(item.amount) for item in records)
            median_amount = amounts[len(amounts) // 2]
            if median_amount <= 0:
                continue
            if any(
                abs(amount - median_amount) > median_amount * Decimal("0.4")
                for amount in amounts
            ):
                continue
            monthly_amount = _money(
                median_amount * Decimal(30) / median_interval
            )
            monthly_total += monthly_amount
            sources.append(
                {
                    "name": (records[-1].merchant or records[-1].description).strip(),
                    "cadence_days": int(median_interval),
                    "median_amount": _money(median_amount),
                    "monthly_estimate": monthly_amount,
                    "occurrences": len(records),
                }
            )

        if sources:
            return (
                monthly_total.quantize(CENT),
                f"Estimated from {len(sources)} recurring income source(s) "
                "detected in the last 90 days.",
                sources,
            )

        total_income = sum(
            (
                abs(transaction.amount)
                for transaction in history
                if transaction.amount > 0
                and transaction.transaction_type == "income"
                and transaction.currency == currency
            ),
            Decimal("0.00"),
        )
        if total_income > 0:
            return (
                _money(total_income / Decimal(3)),
                "No regular income pattern was detected; the estimate is the "
                "average monthly income over the last 90 days.",
                [],
            )
        return (
            Decimal("0.00"),
            "No income history is available, so expected income is zero.",
            [],
        )

    def forecast(self, user, days: int = 30) -> dict:
        """Projected balance over a forward window.

        Inputs: current available balance, unpaid bills and active
        subscriptions due on or before the window end, and recurring income
        detected from transaction history. Outputs the projected balance per
        day plus expected income and expenses.

        Obligations already due (including those due today) reduce the opening
        balance, so the daily projection starts from what is still available
        after paying them. Every exposed total is computed in one currency;
        accounts in other currencies are listed as excluded rather than being
        converted at an invented exchange rate.
        """
        today = date.today()
        end_date = today + timedelta(days=days)
        currency = account_currency(user)

        all_accounts = self.summary.banking.list_accounts(user.id, active_only=True)
        accounts = [account for account in all_accounts if account.currency == currency]
        excluded_currencies = sorted(
            {account.currency for account in all_accounts if account.currency != currency}
        )
        available_balance = sum(
            (account.available_balance for account in accounts), Decimal("0.00")
        )

        upcoming_bills = [
            bill
            for bill in self.bills.list_upcoming(user.id, days=days)
            if bill.currency == currency
        ]
        upcoming_subs = [
            subscription
            for subscription in self.subscriptions.list_upcoming(user.id, days=days)
            if subscription.currency == currency
        ]

        total_upcoming = Decimal("0.00")
        obligations = []
        obligation_by_date: dict[date, Decimal] = {}

        def _due_state(due_date: date) -> str:
            if due_date < today:
                return "overdue"
            if due_date == today:
                return "due"
            return "upcoming"

        for bill in upcoming_bills:
            total_upcoming += bill.amount
            obligations.append(
                {
                    "kind": "bill",
                    "id": str(bill.id),
                    "name": bill.name,
                    "amount": bill.amount,
                    "due_date": bill.due_date.isoformat(),
                    "currency": bill.currency,
                    "status": _due_state(bill.due_date),
                }
            )
            obligation_by_date[bill.due_date] = (
                obligation_by_date.get(bill.due_date, Decimal("0.00")) + bill.amount
            )
        for sub in upcoming_subs:
            total_upcoming += sub.amount
            obligations.append(
                {
                    "kind": "subscription",
                    "id": str(sub.id),
                    "name": sub.name,
                    "amount": sub.amount,
                    "due_date": sub.next_payment_date.isoformat(),
                    "currency": sub.currency,
                    "status": _due_state(sub.next_payment_date),
                }
            )
            obligation_by_date[sub.next_payment_date] = (
                obligation_by_date.get(sub.next_payment_date, Decimal("0.00"))
                + sub.amount
            )
        obligations.sort(key=lambda item: (item["due_date"], item["name"]))

        history = self.transactions.list_since(user.id, today - timedelta(days=90))
        monthly_income, income_basis, income_sources = self._monthly_income_estimate(
            history, currency
        )

        expected_income = _money(monthly_income * Decimal(days) / Decimal(30))
        expected_expenses = _money(total_upcoming)
        projected_balance = _money(
            available_balance + expected_income - expected_expenses
        )

        # Obligations that are already due reduce the opening balance.
        starting_obligations = sum(
            (
                amount
                for due_date, amount in obligation_by_date.items()
                if due_date <= today
            ),
            Decimal("0.00"),
        )

        running = available_balance - starting_obligations
        income_per_day = (
            expected_income / Decimal(days) if days > 0 else Decimal("0.00")
        )
        credited = Decimal("0.00")
        daily = []
        for day_offset in range(days + 1):
            current_date = today + timedelta(days=day_offset)
            if day_offset > 0:
                # Credit the remaining fraction on the final day so the last
                # projection equals the exposed projected balance exactly.
                step = (
                    income_per_day
                    if day_offset < days
                    else expected_income - credited
                )
                credited += step
                running += step
                running -= obligation_by_date.get(current_date, Decimal("0.00"))
            daily.append(
                {
                    "date": current_date.isoformat(),
                    "projected_balance": running.quantize(CENT),
                }
            )

        excluded_note = (
            f"; accounts in {', '.join(excluded_currencies)} are excluded because "
            "no exchange rate is applied"
            if excluded_currencies
            else ""
        )
        assumptions = (
            f"Income: {income_basis} Obligations: unpaid bills and active "
            f"subscriptions due on or before {end_date.isoformat()}; overdue and "
            "due-today amounts are applied to the opening balance. "
            f"Only {currency} records are included{excluded_note}. "
            "Figures are projections, not guarantees."
        )

        return {
            "days": days,
            "start_date": today.isoformat(),
            "end_date": end_date.isoformat(),
            "available_balance": _money(available_balance),
            "expected_income": expected_income,
            "expected_expenses": expected_expenses,
            "projected_balance": projected_balance,
            "upcoming_obligations": obligations,
            "starting_obligations": _money(starting_obligations),
            "daily_projection": daily,
            "currency": currency,
            "income_basis": income_basis,
            "income_sources": income_sources,
            "excluded_currencies": excluded_currencies,
            "assumptions": assumptions,
        }

    # ------------------------------------------------------------ financial reports
    def reports(self, user, year: int, month: int) -> dict:
        """Monthly financial report built from stored records.

        The report is computed on demand from the same deterministic services
        that power the dashboards (monthly summary, budgets, savings goals and
        transactions). It reports one currency, lists other currencies
        separately and never applies an exchange rate.
        """
        from app.repositories.budget_repository import BudgetRepository
        from app.services.budget_service import BudgetService
        from app.services.savings_goal_service import SavingsGoalService

        start, end = _month_bounds(year, month)
        currency = account_currency(user)
        summary = self.monthly_summary(user, year, month)
        transactions = self.transactions.list_between(user.id, start, end)
        same_currency = [
            transaction for transaction in transactions if transaction.currency == currency
        ]

        category_rows: dict[str, dict[str, Decimal]] = {}
        for transaction in same_currency:
            key = (
                transaction.category.slug
                if transaction.category is not None and transaction.category.slug
                else "uncategorised"
            )
            bucket = category_rows.setdefault(
                key, {"income": Decimal("0.00"), "expenses": Decimal("0.00")}
            )
            if transaction.amount > 0:
                bucket["income"] += transaction.amount
            else:
                bucket["expenses"] += abs(transaction.amount)

        total_expenses = summary["expenses"]
        category_breakdown = [
            {
                "category": key,
                "income": _money(bucket["income"]),
                "expenses": _money(bucket["expenses"]),
                "share_percent": (
                    round(float(bucket["expenses"] / total_expenses * 100), 2)
                    if total_expenses > 0
                    else 0.0
                ),
            }
            for key, bucket in category_rows.items()
        ]
        category_breakdown.sort(key=lambda row: row["expenses"], reverse=True)

        merchant_totals: dict[str, dict] = {}
        for transaction in same_currency:
            if transaction.amount >= 0:
                continue
            label = _expense_label(transaction)
            bucket = merchant_totals.setdefault(
                label, {"amount": Decimal("0.00"), "count": 0}
            )
            bucket["amount"] += abs(transaction.amount)
            bucket["count"] += 1
        top_merchants = [
            {"name": name, "amount": _money(bucket["amount"]), "count": bucket["count"]}
            for name, bucket in merchant_totals.items()
        ]
        top_merchants.sort(key=lambda row: row["amount"], reverse=True)

        budget_service = BudgetService(self.db)
        budgets, _ = BudgetRepository(self.db).list(user.id, limit=200)
        budget_rows = [
            budget_service.spending_summary(user, budget)
            for budget in budgets
            if budget.is_active
            and budget.period_start <= end
            and budget.period_end >= start
            and budget.currency == currency
        ]

        previous_year, previous_month = _previous_month(year, month)
        previous = self.monthly_summary(user, previous_year, previous_month)

        def _change(current: Decimal, earlier: Decimal) -> float | None:
            if earlier == 0:
                return None
            return round(float((current - earlier) / abs(earlier) * 100), 2)

        income = summary["income"]
        net = summary["net"]
        savings_rate = (
            round(float(net / income * 100), 2) if income > 0 else None
        )

        return {
            "year": year,
            "month": month,
            "period_start": start.isoformat(),
            "period_end": end.isoformat(),
            "generated_at": date.today().isoformat(),
            "currency": currency,
            "income": income,
            "expenses": summary["expenses"],
            "net": net,
            "savings_rate": savings_rate,
            "transaction_count": summary["transaction_count"],
            "category_breakdown": category_breakdown,
            "top_merchants": top_merchants[:10],
            "previous_period": {
                "year": previous_year,
                "month": previous_month,
                "income": previous["income"],
                "expenses": previous["expenses"],
                "net": previous["net"],
            },
            "change": {
                "income_percent": _change(income, previous["income"]),
                "expenses_percent": _change(
                    summary["expenses"], previous["expenses"]
                ),
                "net_percent": _change(net, previous["net"]),
            },
            "budgets": budget_rows,
            "savings": SavingsGoalService(self.db).summary(user),
            "currency_breakdown": summary["currency_breakdown"],
            "notes": [
                f"Totals are reported in {currency} only.",
                "Amounts in other currencies are listed separately; no exchange "
                "rate is applied.",
                "A report is a record of stored transactions, not a tax document.",
            ],
        }

    # ----------------------------------------------------------------- risk detection
    def detect_risks(self, user) -> list[dict]:
        """Detect financial risks from stored records.

        Returns a list of risk dicts with severity, type, title, description,
        amount, currency, and related date. Callers may persist these as
        FinancialInsight records.
        """
        risks: list[dict] = []
        today = date.today()
        horizon_end = today + timedelta(days=30)
        currency = account_currency(user)

        # Low-balance warning: projected balance vs upcoming obligations
        forecast = self.forecast(user, days=30)
        if forecast["projected_balance"] < 0:
            risks.append(
                {
                    "insight_type": "low_balance",
                    "severity": "critical",
                    "title": "Projected insufficient balance",
                    "description": (
                        f"Your projected balance after upcoming obligations is "
                        f"{forecast['currency']} {forecast['projected_balance']}. "
                        "You may not have enough to cover upcoming dues."
                    ),
                    "amount": forecast["projected_balance"],
                    "currency": forecast["currency"],
                    "related_date": horizon_end,
                }
            )
        elif forecast["projected_balance"] < forecast["expected_expenses"] * Decimal("0.2"):
            risks.append(
                {
                    "insight_type": "low_balance",
                    "severity": "warning",
                    "title": "Low projected balance",
                    "description": (
                        "Your projected balance is low relative to upcoming "
                        "obligations. Consider prioritising essential payments."
                    ),
                    "amount": forecast["projected_balance"],
                    "currency": forecast["currency"],
                    "related_date": horizon_end,
                }
            )

        # Overdue unpaid bills
        overdue_bills = self.bills.list(user.id, state="overdue", days=30)[0]
        for bill in overdue_bills:
            risks.append(
                {
                    "insight_type": "upcoming_obligation",
                    "severity": "critical",
                    "title": f"Overdue bill: {bill.name}",
                    "description": (
                        f"“{bill.name}” was due on {bill.due_date.isoformat()} "
                        f"and remains unpaid."
                    ),
                    "amount": bill.amount,
                    "currency": bill.currency,
                    "related_date": bill.due_date,
                }
            )

        # Due within reminder window (3 days default). Detection is read-only, so
        # preferences are read without creating default rows.
        preferences = self._read_preferences(user)
        advance = preferences.reminder_advance_days if preferences else 3
        upcoming = self.bills.list_upcoming(user.id, days=advance)
        for bill in upcoming:
            if bill.due_date >= today:
                risks.append(
                    {
                        "insight_type": "upcoming_obligation",
                        "severity": "warning",
                        "title": f"Bill due soon: {bill.name}",
                        "description": (
                            f"“{bill.name}” is due on {bill.due_date.isoformat()} "
                            f"({(bill.due_date - today).days} day(s) away)."
                        ),
                        "amount": bill.amount,
                        "currency": bill.currency,
                        "related_date": bill.due_date,
                    }
                )

        # Unusual spending: expenses exceeding 150% of recent average
        trends = self.spending_trends(user, lookback_days=90)
        weekly_values = list(trends["weekly_spending"].values())
        if len(weekly_values) >= 3:
            avg_weekly = statistics.mean(weekly_values)
            latest_week = weekly_values[-1]
            if latest_week > avg_weekly * Decimal("1.5"):
                risks.append(
                    {
                        "insight_type": "unusual_spending",
                        "severity": "warning",
                        "title": "Unusually high weekly spending",
                        "description": (
                            f"This week's spending ({latest_week}) is well above "
                            f"your 90-day average ({avg_weekly})."
                        ),
                        "amount": latest_week,
                        "currency": trends["currency"],
                        "related_date": today,
                    }
                )

        # Significant spending in the recent window, using the user's threshold.
        threshold = (
            preferences.significant_spending_threshold
            if preferences is not None
            else DEFAULT_SIGNIFICANT_THRESHOLD
        )
        recent_expenses = [
            transaction
            for transaction in self.transactions.list_since(
                user.id, today - timedelta(days=7)
            )
            if transaction.amount < 0
            and transaction.transaction_type == "expense"
            and transaction.currency == currency
            and abs(transaction.amount) >= threshold
        ]
        recent_expenses.sort(key=lambda item: item.amount)
        for transaction in recent_expenses[:3]:
            risks.append(
                {
                    "insight_type": "significant_spending",
                    "severity": "warning",
                    "title": _significant_title(transaction),
                    "description": (
                        f"“{_expense_label(transaction)}” on "
                        f"{transaction.occurred_on.isoformat()} was "
                        f"{transaction.currency} {abs(transaction.amount)}, at or "
                        f"above your {transaction.currency} {threshold} "
                        "significant-spending threshold."
                    ),
                    "amount": abs(transaction.amount),
                    "currency": transaction.currency,
                    "related_date": transaction.occurred_on,
                }
            )

        # Possible duplicate transactions: same account, amount, description and
        # date recorded more than once. Manual duplicates require explicit user
        # consent, so this is surfaced as a risk for review.
        duplicate_groups: dict[tuple, list[Transaction]] = {}
        for transaction in self.transactions.list_since(
            user.id, today - timedelta(days=30)
        ):
            if transaction.amount >= 0 or transaction.currency != currency:
                continue
            key = (
                transaction.account_id,
                transaction.amount,
                transaction.description.strip().lower(),
                transaction.occurred_on.isoformat(),
            )
            duplicate_groups.setdefault(key, []).append(transaction)
        for records in duplicate_groups.values():
            if len(records) < 2:
                continue
            sample = records[0]
            risks.append(
                {
                    "insight_type": "duplicate_transaction",
                    "severity": "warning",
                    "title": f"Possible duplicate transactions: {_expense_label(sample)}",
                    "description": (
                        f"“{_expense_label(sample)}” appears {len(records)} times "
                        f"on {sample.occurred_on.isoformat()} for "
                        f"{sample.currency} {abs(sample.amount)}. Review whether "
                        "these are separate payments."
                    ),
                    "amount": abs(sample.amount),
                    "currency": sample.currency,
                    "related_date": sample.occurred_on,
                }
            )

        # Unreviewed recurring payments: suggestions without matched bill/subscription
        from app.services.recurring_service import RecurringPaymentService

        recurring = RecurringPaymentService(self.db).detect(user, lookback_days=90, min_occurrences=2)
        unreviewed = [r for r in recurring if r.matched_subscription_id is None and r.matched_bill_id is None]
        for suggestion in unreviewed[:5]:
            risks.append(
                {
                    "insight_type": "unreviewed_recurring",
                    "severity": "info",
                    "title": f"Possible recurring charge: {suggestion.merchant}",
                    "description": (
                        f"“{suggestion.merchant}” appears {suggestion.occurrences} times "
                        f"at a {suggestion.cadence} cadence (avg "
                        f"{suggestion.currency} {suggestion.average_amount}). "
                        "Consider creating a subscription to track it."
                    ),
                    "amount": suggestion.average_amount,
                    "currency": suggestion.currency,
                    "related_date": suggestion.next_expected_on,
                }
            )

        return risks

    # ---------------------------------------------------------------- helpers
    def _get_preferences(self, user):
        from app.services.spending_preference_service import (
            SpendingPreferenceService,
        )

        return SpendingPreferenceService(self.db).get_or_create(user)

    def _read_preferences(self, user):
        """Read preferences without creating them (safe for read-only requests)."""
        from app.services.spending_preference_service import (
            SpendingPreferenceService,
        )

        return SpendingPreferenceService(self.db).find(user)

    def generate_insights(self, user) -> list:
        """Detect risks and persist the ones not already recorded.

        Re-running detection must not duplicate insights: an insight is only
        written when no identical insight (same type, title and related date)
        already exists, including previously dismissed ones.
        """
        from app.services.financial_insight_service import FinancialInsightService

        insight_service = FinancialInsightService(self.db)
        risks = self.detect_risks(user)
        created: list = []
        for risk in risks:
            if insight_service.find_existing(
                user,
                insight_type=risk["insight_type"],
                title=risk["title"],
                related_date=risk.get("related_date"),
            ):
                continue
            created.append(
                insight_service.create(
                    user,
                    insight_type=risk["insight_type"],
                    severity=risk["severity"],
                    title=risk["title"],
                    description=risk["description"],
                    amount=risk.get("amount"),
                    currency=risk.get("currency"),
                    related_date=risk.get("related_date"),
                )
            )
        return created

    # --------------------------------------------------- proactive spending awareness
    def proactive_awareness(
        self, user, transaction_amount: Decimal, transaction_category: str | None = None
    ) -> dict | None:
        """Before significant spending, surface relevant upcoming dues.

        Returns None if proactive awareness is disabled or the transaction is
        below the significance threshold. Never claims payment interception.
        """
        preferences = self._get_preferences(user)
        if not preferences.proactive_awareness_enabled:
            return None

        threshold = preferences.significant_spending_threshold
        if abs(transaction_amount) < threshold:
            return None

        forecast = self.forecast(user, days=30)
        upcoming = forecast["upcoming_obligations"]
        soon = sorted(
            [o for o in upcoming if o["due_date"] >= date.today().isoformat()],
            key=lambda o: o["due_date"],
        )[:3]

        available = forecast["available_balance"]
        remaining_after = available - abs(transaction_amount)

        return {
            "significant_spending": True,
            "transaction_amount": abs(transaction_amount).quantize(CENT),
            "currency": forecast["currency"],
            "available_balance": available.quantize(CENT),
            "remaining_after_spending": remaining_after.quantize(CENT),
            "upcoming_dues": soon,
            "upcoming_total": forecast["expected_expenses"].quantize(CENT),
            "insufficient_after_spending": remaining_after < forecast["expected_expenses"],
            "advice": (
                f"After this spending, you would have {forecast['currency']} "
                f"{remaining_after} available against {forecast['expected_expenses']} "
                "in upcoming obligations."
            ),
        }

    def evaluate_transaction(
        self, user, transaction: Transaction, *, duplicate: bool = False
    ) -> list:
        """Run spending-awareness rules for a newly recorded transaction.

        Rules are limited to the user's own records and configured
        preferences. Matching insights are persisted so they appear in the
        Intelligence screen; duplicates are suppressed by the usual
        (type, title, related date) signature. This never sends a push, email
        or SMS notification.
        """
        from app.services.financial_insight_service import FinancialInsightService

        preferences = self._read_preferences(user)
        enabled = (
            preferences.proactive_awareness_enabled
            if preferences is not None
            else True
        )
        threshold = (
            preferences.significant_spending_threshold
            if preferences is not None
            else DEFAULT_SIGNIFICANT_THRESHOLD
        )
        currency = account_currency(user)
        is_expense = (
            transaction.amount < 0 and transaction.transaction_type == "expense"
        )
        same_currency = transaction.currency == currency
        label = _expense_label(transaction)
        category_slug = (
            transaction.category.slug
            if transaction.category is not None and transaction.category.slug
            else "uncategorised"
        )

        insights: list[dict] = []

        if enabled and is_expense and same_currency and abs(transaction.amount) >= threshold:
            forecast = self.forecast(user, days=30)
            remaining = forecast["available_balance"] - abs(transaction.amount)
            insights.append(
                {
                    "insight_type": "significant_spending",
                    "severity": "warning",
                    "title": _significant_title(transaction),
                    "description": (
                        f"“{label}” ({category_slug}) on "
                        f"{transaction.occurred_on.isoformat()} was "
                        f"{transaction.currency} {abs(transaction.amount)}, at or "
                        f"above your {transaction.currency} {threshold} threshold. "
                        f"Available balance after this spending would be "
                        f"{forecast['currency']} {remaining} against "
                        f"{forecast['currency']} {forecast['expected_expenses']} "
                        "in upcoming obligations."
                    ),
                    "amount": abs(transaction.amount),
                    "currency": transaction.currency,
                    "related_date": transaction.occurred_on,
                }
            )

        if (
            enabled
            and is_expense
            and preferences is not None
            and preferences.enable_entertainment_alerts
        ):
            categories = {
                value.strip().lower()
                for value in preferences.entertainment_categories.split(",")
                if value.strip()
            }
            if category_slug.lower() in categories:
                insights.append(
                    {
                        "insight_type": "entertainment_spending",
                        "severity": "info",
                        "title": f"Entertainment spending: {label}",
                        "description": (
                            f"“{label}” was recorded as "
                            f"{transaction.currency} {abs(transaction.amount)} in the "
                            f"“{category_slug}” category. You asked to be alerted "
                            "about spending in this category."
                        ),
                        "amount": abs(transaction.amount),
                        "currency": transaction.currency,
                        "related_date": transaction.occurred_on,
                    }
                )

        if enabled and is_expense and same_currency:
            baseline_since = transaction.occurred_on - timedelta(days=90)
            baseline = [
                item
                for item in self.transactions.list_since(user.id, baseline_since)
                if item.id != transaction.id
                and item.amount < 0
                and item.occurred_on < transaction.occurred_on
                and item.currency == currency
                and (
                    (item.category.slug if item.category else "uncategorised")
                    == category_slug
                )
            ]
            if len(baseline) >= 5:
                average = sum(
                    (abs(item.amount) for item in baseline), Decimal("0.00")
                ) / Decimal(len(baseline))
                if average > 0 and abs(transaction.amount) >= average * Decimal("3"):
                    insights.append(
                        {
                            "insight_type": "unusual_spending",
                            "severity": "warning",
                            "title": f"Unusually large transaction: {label}",
                            "description": (
                                f"“{label}” was {transaction.currency} "
                                f"{abs(transaction.amount)}, more than three times "
                                f"your recent average of {transaction.currency} "
                                f"{average.quantize(CENT)} for the “{category_slug}” "
                                "category."
                            ),
                            "amount": abs(transaction.amount),
                            "currency": transaction.currency,
                            "related_date": transaction.occurred_on,
                        }
                    )

        if duplicate and is_expense:
            insights.append(
                {
                    "insight_type": "duplicate_transaction",
                    "severity": "warning",
                    "title": f"Possible duplicate transaction: {label}",
                    "description": (
                        f"A transaction matching “{label}” for "
                        f"{transaction.currency} {abs(transaction.amount)} on "
                        f"{transaction.occurred_on.isoformat()} already existed. "
                        "Review your history to confirm this was intentional."
                    ),
                    "amount": abs(transaction.amount),
                    "currency": transaction.currency,
                    "related_date": transaction.occurred_on,
                }
            )

        insight_service = FinancialInsightService(self.db)
        created: list = []
        for insight in insights:
            if insight_service.find_existing(
                user,
                insight_type=insight["insight_type"],
                title=insight["title"],
                related_date=insight.get("related_date"),
            ):
                continue
            created.append(insight_service.create(user, **insight))
        return created
