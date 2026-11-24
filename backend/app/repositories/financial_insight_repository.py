"""Data access for financial insights."""

from __future__ import annotations

import uuid
from datetime import date

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.financial import FinancialInsight


class FinancialInsightRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def get(self, user_id: uuid.UUID, insight_id: uuid.UUID) -> FinancialInsight | None:
        statement = select(FinancialInsight).where(
            FinancialInsight.id == insight_id, FinancialInsight.user_id == user_id
        )
        return self.db.execute(statement).scalar_one_or_none()

    def add(self, insight: FinancialInsight) -> FinancialInsight:
        self.db.add(insight)
        return insight

    def delete(self, insight: FinancialInsight) -> None:
        self.db.delete(insight)

    def list(
        self,
        user_id: uuid.UUID,
        *,
        insight_type: str | None = None,
        severity: str | None = None,
        is_dismissed: bool | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> tuple[list[FinancialInsight], int]:
        filters = [FinancialInsight.user_id == user_id]
        if insight_type is not None:
            filters.append(FinancialInsight.insight_type == insight_type)
        if severity is not None:
            filters.append(FinancialInsight.severity == severity)
        if is_dismissed is not None:
            filters.append(FinancialInsight.is_dismissed.is_(is_dismissed))

        total = int(
            self.db.scalar(
                select(func.count())
                .select_from(FinancialInsight)
                .where(*filters)
            )
            or 0
        )
        statement = (
            select(FinancialInsight)
            .where(*filters)
            .order_by(FinancialInsight.created_at.desc())
            .limit(limit)
            .offset(offset)
        )
        return list(self.db.scalars(statement)), total

    def find_existing(
        self,
        user_id: uuid.UUID,
        *,
        insight_type: str,
        title: str,
        related_date: date | None,
    ) -> FinancialInsight | None:
        """Return an insight with the same signature, dismissed or not."""
        statement = select(FinancialInsight).where(
            FinancialInsight.user_id == user_id,
            FinancialInsight.insight_type == insight_type,
            FinancialInsight.title == title,
            FinancialInsight.related_date == related_date,
        )
        return self.db.execute(statement).scalars().first()
