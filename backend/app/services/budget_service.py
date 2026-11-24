"""Budget management and spending-tracking service."""

from __future__ import annotations

import uuid
from datetime import date
from decimal import Decimal

from sqlalchemy.orm import Session

from app.core.exceptions import BadRequestError, ConflictError, NotFoundError
from app.models.financial import Budget, TransactionCategory
from app.repositories.budget_repository import BudgetRepository
from app.repositories.transaction_repository import CategoryRepository
from app.schemas.budgets import BudgetCreate, BudgetUpdate
from app.services.categorization import suggest_category_slug


class BudgetService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.repo = BudgetRepository(db)
        self.categories = CategoryRepository(db)

    def list(
        self,
        user,
        *,
        is_active: bool | None = None,
        category_id: uuid.UUID | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> tuple[list[Budget], int]:
        return self.repo.list(
            user.id,
            is_active=is_active,
            category_id=category_id,
            limit=limit,
            offset=offset,
        )

    def get(self, user, budget_id: uuid.UUID) -> Budget:
        budget = self.repo.get(user.id, budget_id)
        if budget is None:
            raise NotFoundError("Budget not found")
        return budget

    def create(self, user, payload: BudgetCreate) -> Budget:
        category_id = None
        if payload.category_id is not None:
            category = self.categories.get_accessible(user.id, payload.category_id)
            if category is None:
                raise NotFoundError("Transaction category not found")
            category_id = category.id

        overlapping = self.repo.list_overlapping(
            user.id,
            payload.period_start,
            payload.period_end,
            category_id=category_id,
        )
        if overlapping:
            raise ConflictError(
                "An active budget already exists for this period",
                code="budget_period_overlap",
            )

        budget = Budget(
            user_id=user.id,
            category_id=category_id,
            name=payload.name,
            period_start=payload.period_start,
            period_end=payload.period_end,
            amount=Decimal(payload.amount).quantize(Decimal("0.01")),
            currency=(payload.currency or "INR").upper(),
            alert_threshold=payload.alert_threshold,
            is_active=payload.is_active,
        )
        self.repo.add(budget)
        self.db.commit()
        self.db.refresh(budget)
        return budget

    def update(self, user, budget_id: uuid.UUID, payload: BudgetUpdate) -> Budget:
        budget = self.get(user, budget_id)
        data = payload.model_dump(exclude_unset=True)

        # Resolve and validate the prospective state before mutating the model.
        # Mutating first would let the overlap query autoflush a half-applied
        # update and persist it even when validation fails.
        category_id = budget.category_id
        if "category_id" in data:
            requested_category_id = data["category_id"]
            if requested_category_id is None:
                category_id = None
            else:
                category = self.categories.get_accessible(
                    user.id, requested_category_id
                )
                if category is None:
                    raise NotFoundError("Transaction category not found")
                category_id = category.id

        period_start = data.get("period_start") or budget.period_start
        period_end = data.get("period_end") or budget.period_end
        if period_end < period_start:
            raise BadRequestError("Period end must be on or after period start")

        is_active = (
            data["is_active"] if data.get("is_active") is not None else budget.is_active
        )

        if is_active and (
            period_start != budget.period_start
            or period_end != budget.period_end
            or category_id != budget.category_id
        ):
            overlapping = self.repo.list_overlapping(
                user.id,
                period_start,
                period_end,
                category_id=category_id,
                exclude_budget_id=budget.id,
            )
            if overlapping:
                raise ConflictError(
                    "An active budget already exists for this period",
                    code="budget_period_overlap",
                )

        budget.category_id = category_id
        budget.period_start = period_start
        budget.period_end = period_end
        budget.is_active = is_active

        if "amount" in data and data["amount"] is not None:
            budget.amount = Decimal(data["amount"]).quantize(Decimal("0.01"))
        if "currency" in data and data["currency"] is not None:
            budget.currency = data["currency"].upper()
        if "alert_threshold" in data and data["alert_threshold"] is not None:
            budget.alert_threshold = data["alert_threshold"]
        if "name" in data and data["name"] is not None:
            cleaned = " ".join(data["name"].split())
            if not cleaned:
                raise BadRequestError("Budget name cannot be blank")
            budget.name = cleaned

        self.db.commit()
        self.db.refresh(budget)
        return budget

    def delete(self, user, budget_id: uuid.UUID) -> None:
        budget = self.get(user, budget_id)
        self.repo.delete(budget)
        self.db.commit()

    def spending_summary(self, user, budget: Budget) -> dict:
        """Compute actual spending vs budget for a single budget."""
        spent = self.repo.spending_for_period(user.id, budget)
        remaining = budget.amount - spent
        overspending = spent > budget.amount
        percent_used = (
            round(float(spent / budget.amount * 100), 2) if budget.amount > 0 else 0.0
        )
        return {
            "budget_id": budget.id,
            "name": budget.name,
            "period": f"{budget.period_start.isoformat()} to {budget.period_end.isoformat()}",
            "amount": budget.amount,
            "currency": budget.currency,
            "spent": spent,
            "remaining": remaining,
            "alert_threshold": budget.alert_threshold,
            "overspending": overspending,
            "percent_used": percent_used,
            "category_id": budget.category_id,
        }
