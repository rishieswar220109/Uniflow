"""Data access for savings goals."""

from __future__ import annotations

import uuid
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.financial import SavingsGoal


class SavingsGoalRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def get(self, user_id: uuid.UUID, goal_id: uuid.UUID) -> SavingsGoal | None:
        statement = select(SavingsGoal).where(
            SavingsGoal.id == goal_id, SavingsGoal.user_id == user_id
        )
        return self.db.execute(statement).scalar_one_or_none()

    def add(self, goal: SavingsGoal) -> SavingsGoal:
        self.db.add(goal)
        return goal

    def delete(self, goal: SavingsGoal) -> None:
        self.db.delete(goal)

    def list(
        self,
        user_id: uuid.UUID,
        *,
        is_active: bool | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> tuple[list[SavingsGoal], int]:
        filters = [SavingsGoal.user_id == user_id]
        if is_active is not None:
            filters.append(SavingsGoal.is_active.is_(is_active))

        total = int(
            self.db.scalar(
                select(func.count()).select_from(SavingsGoal).where(*filters)
            )
            or 0
        )
        statement = (
            select(SavingsGoal)
            .where(*filters)
            .order_by(SavingsGoal.created_at.desc())
            .limit(limit)
            .offset(offset)
        )
        return list(self.db.scalars(statement)), total

    def saved_amount(self, user_id: uuid.UUID) -> Decimal:
        """Sum of current_amount across active goals."""
        statement = select(
            func.coalesce(func.sum(SavingsGoal.current_amount), 0)
        ).where(SavingsGoal.user_id == user_id, SavingsGoal.is_active.is_(True))
        return Decimal(str(self.db.scalar(statement) or 0))
