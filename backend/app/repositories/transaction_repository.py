"""Data access for transactions and transaction categories."""

from __future__ import annotations

import uuid
from datetime import date
from decimal import Decimal

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.models.financial import Transaction, TransactionCategory

SYSTEM_CATEGORIES: tuple[tuple[str, str, str], ...] = (
    ("salary", "Salary", "income"),
    ("refund", "Refund", "income"),
    ("rent", "Rent", "expense"),
    ("utilities", "Utilities", "expense"),
    ("groceries", "Groceries", "expense"),
    ("dining", "Dining", "expense"),
    ("transport", "Transport", "expense"),
    ("travel", "Travel", "expense"),
    ("shopping", "Shopping", "expense"),
    ("entertainment", "Entertainment", "expense"),
    ("health", "Health", "expense"),
    ("education", "Education", "expense"),
    ("fees", "Fees & charges", "expense"),
    ("transfer", "Transfer", "transfer"),
    ("other", "Other", "expense"),
)


class CategoryRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def ensure_system_categories(self) -> list[TransactionCategory]:
        """Create any missing system categories. Safe to call repeatedly."""

        existing = {
            slug
            for slug in self.db.scalars(
                select(TransactionCategory.slug).where(
                    TransactionCategory.user_id.is_(None)
                )
            )
        }
        for slug, name, kind in SYSTEM_CATEGORIES:
            if slug not in existing:
                self.db.add(
                    TransactionCategory(
                        user_id=None,
                        slug=slug,
                        name=name,
                        kind=kind,
                        is_system=True,
                    )
                )
        self.db.flush()
        return self.list_available(user_id=None)

    def list_available(self, user_id: uuid.UUID | None) -> list[TransactionCategory]:
        statement = select(TransactionCategory)
        if user_id is None:
            statement = statement.where(TransactionCategory.user_id.is_(None))
        else:
            statement = statement.where(
                or_(
                    TransactionCategory.user_id.is_(None),
                    TransactionCategory.user_id == user_id,
                )
            )
        statement = statement.order_by(TransactionCategory.name.asc())
        return list(self.db.scalars(statement))

    def get_accessible(
        self, user_id: uuid.UUID, category_id: uuid.UUID
    ) -> TransactionCategory | None:
        statement = select(TransactionCategory).where(
            TransactionCategory.id == category_id,
            or_(
                TransactionCategory.user_id.is_(None),
                TransactionCategory.user_id == user_id,
            ),
        )
        return self.db.execute(statement).scalar_one_or_none()

    def get_system_by_slug(self, slug: str) -> TransactionCategory | None:
        statement = select(TransactionCategory).where(
            TransactionCategory.user_id.is_(None),
            TransactionCategory.slug == slug,
        )
        return self.db.execute(statement).scalar_one_or_none()


class TransactionRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def get(self, user_id: uuid.UUID, transaction_id: uuid.UUID) -> Transaction | None:
        statement = select(Transaction).where(
            Transaction.id == transaction_id,
            Transaction.user_id == user_id,
        )
        return self.db.execute(statement).scalar_one_or_none()

    def exists_dedupe(self, account_id: uuid.UUID, dedupe_key: str) -> bool:
        statement = select(Transaction.id).where(
            Transaction.account_id == account_id,
            Transaction.dedupe_key == dedupe_key,
        )
        return self.db.execute(statement).first() is not None

    def add(self, transaction: Transaction) -> Transaction:
        self.db.add(transaction)
        return transaction

    def list(
        self,
        user_id: uuid.UUID,
        *,
        account_id: uuid.UUID | None = None,
        category_id: uuid.UUID | None = None,
        transaction_type: str | None = None,
        from_date: date | None = None,
        to_date: date | None = None,
        search: str | None = None,
        source: str | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> tuple[list[Transaction], int]:
        filters = [Transaction.user_id == user_id]
        if account_id is not None:
            filters.append(Transaction.account_id == account_id)
        if category_id is not None:
            filters.append(Transaction.category_id == category_id)
        if transaction_type is not None:
            filters.append(Transaction.transaction_type == transaction_type)
        if from_date is not None:
            filters.append(Transaction.occurred_on >= from_date)
        if to_date is not None:
            filters.append(Transaction.occurred_on <= to_date)
        if source is not None:
            filters.append(Transaction.source == source)
        if search:
            pattern = f"%{search.strip().lower()}%"
            filters.append(
                or_(
                    func.lower(Transaction.description).like(pattern),
                    func.lower(func.coalesce(Transaction.merchant, "")).like(pattern),
                )
            )

        total = int(
            self.db.scalar(
                select(func.count()).select_from(Transaction).where(*filters)
            )
            or 0
        )
        statement = (
            select(Transaction)
            .where(*filters)
            .order_by(Transaction.occurred_on.desc(), Transaction.created_at.desc())
            .limit(limit)
            .offset(offset)
        )
        return list(self.db.scalars(statement)), total

    def sum_between(
        self,
        user_id: uuid.UUID,
        start: date,
        end: date,
        *,
        currency: str | None = None,
    ) -> tuple[Decimal, Decimal]:
        """Return (income, expenses) as positive magnitudes for a date range.

        When ``currency`` is supplied only records in that currency are summed,
        so totals never combine unrelated currencies.
        """

        base_filters = [
            Transaction.user_id == user_id,
            Transaction.occurred_on >= start,
            Transaction.occurred_on <= end,
        ]
        if currency is not None:
            base_filters.append(Transaction.currency == currency)

        income_statement = select(
            func.coalesce(func.sum(Transaction.amount), 0)
        ).where(
            *base_filters,
            Transaction.amount > 0,
        )
        expense_statement = select(
            func.coalesce(func.sum(Transaction.amount), 0)
        ).where(
            *base_filters,
            Transaction.amount < 0,
        )
        income = Decimal(str(self.db.scalar(income_statement) or 0))
        expenses = abs(Decimal(str(self.db.scalar(expense_statement) or 0)))
        return income.quantize(Decimal("0.01")), expenses.quantize(Decimal("0.01"))

    def list_recent(
        self, user_id: uuid.UUID, *, limit: int = 6
    ) -> list[Transaction]:
        statement = (
            select(Transaction)
            .where(Transaction.user_id == user_id)
            .order_by(Transaction.occurred_on.desc(), Transaction.created_at.desc())
            .limit(limit)
        )
        return list(self.db.scalars(statement))

    def list_since(self, user_id: uuid.UUID, since: date) -> list[Transaction]:
        statement = (
            select(Transaction)
            .where(
                Transaction.user_id == user_id,
                Transaction.occurred_on >= since,
            )
            .order_by(Transaction.occurred_on.asc())
        )
        return list(self.db.scalars(statement))

    def list_between(
        self, user_id: uuid.UUID, start: date, end: date
    ) -> list[Transaction]:
        """Return a user's transactions dated inside an inclusive range."""
        statement = (
            select(Transaction)
            .where(
                Transaction.user_id == user_id,
                Transaction.occurred_on >= start,
                Transaction.occurred_on <= end,
            )
            .order_by(Transaction.occurred_on.asc())
        )
        return list(self.db.scalars(statement))
