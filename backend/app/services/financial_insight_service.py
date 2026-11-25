"""Financial insight listing and dismissal service."""

from __future__ import annotations

import uuid

from sqlalchemy.orm import Session

from app.core.exceptions import NotFoundError
from app.models.financial import FinancialInsight
from app.repositories.financial_insight_repository import (
    FinancialInsightRepository,
)


class FinancialInsightService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.repo = FinancialInsightRepository(db)

    def list(
        self,
        user,
        *,
        insight_type: str | None = None,
        severity: str | None = None,
        is_dismissed: bool | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> tuple[list[FinancialInsight], int]:
        return self.repo.list(
            user.id,
            insight_type=insight_type,
            severity=severity,
            is_dismissed=is_dismissed,
            limit=limit,
            offset=offset,
        )

    def get(self, user, insight_id: uuid.UUID) -> FinancialInsight:
        insight = self.repo.get(user.id, insight_id)
        if insight is None:
            raise NotFoundError("Financial insight not found")
        return insight

    def find_existing(
        self,
        user,
        *,
        insight_type: str,
        title: str,
        related_date,
    ) -> bool:
        """Whether an insight with the same signature is already stored."""
        return (
            self.repo.find_existing(
                user.id,
                insight_type=insight_type,
                title=title,
                related_date=related_date,
            )
            is not None
        )

    def dismiss(self, user, insight_id: uuid.UUID) -> None:
        # Resolve through the user-scoped lookup so unknown or foreign ids
        # return the same 404 instead of a silent no-op.
        insight = self.get(user, insight_id)
        insight.is_dismissed = True
        self.repo.add(insight)
        self.db.commit()

    def create(
        self,
        user,
        *,
        insight_type: str,
        severity: str,
        title: str,
        description: str,
        amount=None,
        currency: str | None = None,
        related_date=None,
    ) -> FinancialInsight:
        insight = FinancialInsight(
            user_id=user.id,
            insight_type=insight_type,
            severity=severity,
            title=title,
            description=description,
            amount=amount,
            currency=currency,
            related_date=related_date,
        )
        self.repo.add(insight)
        self.db.commit()
        self.db.refresh(insight)
        return insight
