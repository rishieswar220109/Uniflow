"""Data access for budgets."""

from __future__ import annotations

import uuid
from datetime import date
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.financial import Budget, Transaction


class BudgetRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def get(self, user_id: uuid.UUID, budget_id: uuid.UUID) -> Budget | None:
        statement = select(Budget).where(
            Budget.id == budget_id, Budget.user_id == user_id
        )
        return self.db.execute(statement).scalar_one_or_none()

    def add(self, budget: Budget) -> Budget:
        self.db.add(budget)
        return budget

    def delete(self, budget: Budget) -> None:
        self.db.delete(budget)

    def list(
        self,
        user_id: uuid.UUID,
        *,
        is_active: bool | None = None,
        category_id: uuid.UUID | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> tuple[list[Budget], int]:
        filters = [Budget.user_id == user_id]
        if is_active is not None:
            filters.append(Budget.is_active.is_(is_active))
        if category_id is not None:
            filters.append(Budget.category_id == category_id)

        total = int(
            self.db.scalar(select(func.count()).select_from(Budget).where(*filters))
            or 0
        )
        statement = (
            select(Budget)
            .where(*filters)
            .order_by(Budget.period_start.desc(), Budget.created_at.desc())
            .limit(limit)
            .offset(offset)
        )
        return list(self.db.scalars(statement)), total

    def list_overlapping(
        self,
        user_id: uuid.UUID,
        period_start: date,
        period_end: date,
        *,
        category_id: uuid.UUID | None = None,
        exclude_budget_id: uuid.UUID | None = None,
    ) -> list[Budget]:
        """Return active budgets in the same scope whose period overlaps the range.

        Budgets only conflict with budgets covering the same scope: an overall
        budget (no category) conflicts with other overall budgets, and a
        category budget conflicts only with budgets for that same category.
        """
        filters = [
            Budget.user_id == user_id,
            Budget.is_active.is_(True),
            Budget.period_start <= period_end,
            Budget.period_end >= period_start,
        ]
        if category_id is None:
            filters.append(Budget.category_id.is_(None))
        else:
            filters.append(Budget.category_id == category_id)
        if exclude_budget_id is not None:
            filters.append(Budget.id != exclude_budget_id)

        return list(self.db.scalars(select(Budget).where(*filters)))

    def spending_for_period(
        self, user_id: uuid.UUID, budget: Budget
    ) -> Decimal:
        """Actual expense spending for a budget's period and category (if set)."""
        filters = [
            Transaction.user_id == user_id,
            Transaction.occurred_on >= budget.period_start,
            Transaction.occurred_on <= budget.period_end,
            Transaction.transaction_type == "expense",
            # A budget is denominated in one currency; never add other
            # currencies' amounts into its spending total.
            Transaction.currency == budget.currency,
        ]
        if budget.category_id is not None:
            filters.append(Transaction.category_id == budget.category_id)

        statement = select(func.coalesce(func.sum(Transaction.amount), 0)).where(
            *filters
        )
        total = self.db.scalar(statement) or 0
        # Expenses are stored as negative amounts; return positive magnitude.
        return abs(Decimal(str(total)))
