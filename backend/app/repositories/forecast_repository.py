"""Data access for cash-flow forecasts."""

from __future__ import annotations

import uuid
from datetime import date

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.financial import Forecast


class ForecastRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def get(self, user_id: uuid.UUID, forecast_id: uuid.UUID) -> Forecast | None:
        statement = select(Forecast).where(
            Forecast.id == forecast_id, Forecast.user_id == user_id
        )
        return self.db.execute(statement).scalar_one_or_none()

    def add(self, forecast: Forecast) -> Forecast:
        self.db.add(forecast)
        return forecast

    def delete(self, forecast: Forecast) -> None:
        self.db.delete(forecast)

    def list(
        self,
        user_id: uuid.UUID,
        *,
        from_date: date | None = None,
        to_date: date | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> tuple[list[Forecast], int]:
        filters = [Forecast.user_id == user_id]
        if from_date is not None:
            filters.append(Forecast.forecast_date >= from_date)
        if to_date is not None:
            filters.append(Forecast.forecast_date <= to_date)

        total = int(
            self.db.scalar(
                select(func.count()).select_from(Forecast).where(*filters)
            )
            or 0
        )
        statement = (
            select(Forecast)
            .where(*filters)
            .order_by(Forecast.forecast_date.asc())
            .limit(limit)
            .offset(offset)
        )
        return list(self.db.scalars(statement)), total

    def latest_for_user(self, user_id: uuid.UUID) -> Forecast | None:
        statement = (
            select(Forecast)
            .where(Forecast.user_id == user_id)
            .order_by(Forecast.generated_at.desc())
            .limit(1)
        )
        return self.db.execute(statement).scalar_one_or_none()
