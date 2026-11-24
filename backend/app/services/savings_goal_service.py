"""Savings goal management service."""

from __future__ import annotations

import uuid
from datetime import date
from decimal import Decimal

from sqlalchemy.orm import Session

from app.core.exceptions import ConflictError, NotFoundError
from app.models.financial import SavingsGoal
from app.repositories.savings_goal_repository import SavingsGoalRepository
from app.schemas.savings_goals import SavingsGoalCreate, SavingsGoalUpdate
from app.services.banking_service import account_currency


class SavingsGoalService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.repo = SavingsGoalRepository(db)

    def list(
        self,
        user,
        *,
        is_active: bool | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> tuple[list[SavingsGoal], int]:
        return self.repo.list(user.id, is_active=is_active, limit=limit, offset=offset)

    def get(self, user, goal_id: uuid.UUID) -> SavingsGoal:
        goal = self.repo.get(user.id, goal_id)
        if goal is None:
            raise NotFoundError("Savings goal not found")
        return goal

    def create(self, user, payload: SavingsGoalCreate) -> SavingsGoal:
        goal = SavingsGoal(
            user_id=user.id,
            name=payload.name,
            target_amount=Decimal(payload.target_amount).quantize(Decimal("0.01")),
            currency=(payload.currency or "INR").upper(),
            target_date=payload.target_date,
            is_active=payload.is_active,
        )
        self.repo.add(goal)
        self.db.commit()
        self.db.refresh(goal)
        return goal

    def update(self, user, goal_id: uuid.UUID, payload: SavingsGoalUpdate) -> SavingsGoal:
        goal = self.get(user, goal_id)
        data = payload.model_dump(exclude_unset=True)

        if "name" in data and data["name"] is not None:
            cleaned = " ".join(data["name"].split())
            if not cleaned:
                raise ConflictError("Goal name cannot be blank")
            goal.name = cleaned
        if "target_amount" in data and data["target_amount"] is not None:
            goal.target_amount = Decimal(data["target_amount"]).quantize(
                Decimal("0.01")
            )
        if "currency" in data and data["currency"] is not None:
            goal.currency = data["currency"].upper()
        if "target_date" in data:
            goal.target_date = data["target_date"]
        if "current_amount" in data and data["current_amount"] is not None:
            goal.current_amount = Decimal(str(data["current_amount"])).quantize(
                Decimal("0.01")
            )
        if "is_active" in data and data["is_active"] is not None:
            goal.is_active = data["is_active"]

        self.db.commit()
        self.db.refresh(goal)
        return goal

    def delete(self, user, goal_id: uuid.UUID) -> None:
        goal = self.get(user, goal_id)
        self.repo.delete(goal)
        self.db.commit()

    def summary(self, user) -> dict:
        """Savings totals, reported per currency.

        Goals may be denominated in different currencies; adding them together
        would be incorrect. The top-level totals cover the user's preferred
        currency and ``currency_breakdown`` lists every currency separately.
        """
        currency = account_currency(user)
        breakdown: dict[str, dict] = {}
        goals, _ = self.repo.list(user.id, is_active=True)
        for goal in goals:
            bucket = breakdown.setdefault(
                goal.currency,
                {
                    "target": Decimal("0.00"),
                    "saved": Decimal("0.00"),
                    "count": 0,
                },
            )
            bucket["target"] += goal.target_amount
            bucket["saved"] += goal.current_amount
            bucket["count"] += 1

        selected = breakdown.get(
            currency, {"target": Decimal("0.00"), "saved": Decimal("0.00"), "count": 0}
        )
        total_target = selected["target"]
        total_saved = selected["saved"]
        return {
            "currency": currency,
            "total_target": total_target.quantize(Decimal("0.01")),
            "total_saved": total_saved.quantize(Decimal("0.01")),
            "remaining": max(Decimal("0"), total_target - total_saved).quantize(
                Decimal("0.01")
            ),
            "goal_count": selected["count"],
            "currency_breakdown": {
                code: {
                    "total_target": bucket["target"].quantize(Decimal("0.01")),
                    "total_saved": bucket["saved"].quantize(Decimal("0.01")),
                    "remaining": max(
                        Decimal("0"), bucket["target"] - bucket["saved"]
                    ).quantize(Decimal("0.01")),
                    "goal_count": bucket["count"],
                }
                for code, bucket in sorted(breakdown.items())
            },
        }
