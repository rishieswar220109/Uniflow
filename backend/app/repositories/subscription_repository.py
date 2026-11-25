"""Data access for subscriptions and their payment history."""

from __future__ import annotations

import uuid
from datetime import date, timedelta

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.financial import Payment, Subscription


class SubscriptionRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def get(
        self, user_id: uuid.UUID, subscription_id: uuid.UUID
    ) -> Subscription | None:
        statement = select(Subscription).where(
            Subscription.id == subscription_id,
            Subscription.user_id == user_id,
        )
        return self.db.execute(statement).scalar_one_or_none()

    def add(self, subscription: Subscription) -> Subscription:
        self.db.add(subscription)
        return subscription

    def delete(self, subscription: Subscription) -> None:
        self.db.delete(subscription)

    def list(
        self,
        user_id: uuid.UUID,
        *,
        status: str | None = None,
        days: int | None = None,
        search: str | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> tuple[list[Subscription], int]:
        filters = [Subscription.user_id == user_id]
        if status is not None:
            filters.append(Subscription.status == status)
        if days is not None:
            today = date.today()
            filters += [
                Subscription.status == "active",
                Subscription.next_payment_date
                <= today + timedelta(days=days),
            ]
        if search:
            pattern = f"%{search.strip().lower()}%"
            filters.append(
                func.lower(Subscription.name).like(pattern)
                | func.lower(func.coalesce(Subscription.provider, "")).like(pattern)
            )

        total = int(
            self.db.scalar(
                select(func.count()).select_from(Subscription).where(*filters)
            )
            or 0
        )
        statement = (
            select(Subscription)
            .where(*filters)
            .order_by(Subscription.next_payment_date.asc(), Subscription.created_at.asc())
            .limit(limit)
            .offset(offset)
        )
        return list(self.db.scalars(statement)), total

    def list_upcoming(
        self, user_id: uuid.UUID, *, days: int = 30, limit: int = 50
    ) -> list[Subscription]:
        today = date.today()
        statement = (
            select(Subscription)
            .where(
                Subscription.user_id == user_id,
                Subscription.status == "active",
                Subscription.next_payment_date
                <= today + timedelta(days=days),
            )
            .order_by(Subscription.next_payment_date.asc())
            .limit(limit)
        )
        return list(self.db.scalars(statement))

    def find_by_name(
        self, user_id: uuid.UUID, name: str
    ) -> Subscription | None:
        statement = (
            select(Subscription)
            .where(
                Subscription.user_id == user_id,
                func.lower(Subscription.name) == name.strip().lower(),
            )
            .limit(1)
        )
        return self.db.execute(statement).scalar_one_or_none()

    def list_payments(
        self, user_id: uuid.UUID, subscription_id: uuid.UUID
    ) -> list[Payment]:
        statement = (
            select(Payment)
            .where(
                Payment.user_id == user_id,
                Payment.subscription_id == subscription_id,
            )
            .order_by(Payment.paid_on.desc(), Payment.created_at.desc())
        )
        return list(self.db.scalars(statement))
