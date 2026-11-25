"""Subscription management, payment history and reminders."""

from __future__ import annotations

import uuid
from datetime import date
from decimal import Decimal

from sqlalchemy.orm import Session

from app.core.exceptions import ConflictError, NotFoundError
from app.models.financial import Payment, Subscription
from app.repositories.bill_repository import PaymentRepository
from app.repositories.subscription_repository import SubscriptionRepository
from app.repositories.transaction_repository import CategoryRepository
from app.schemas.payments import PaymentCreate
from app.schemas.subscriptions import SubscriptionCreate, SubscriptionUpdate
from app.services.banking_service import account_currency
from app.services.recurrence import advance_until_after


class SubscriptionService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.repo = SubscriptionRepository(db)
        self.payments = PaymentRepository(db)
        self.categories = CategoryRepository(db)

    def list(
        self,
        user,
        *,
        status: str | None = None,
        days: int | None = None,
        search: str | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> tuple[list[Subscription], int]:
        if status is not None and status not in {"active", "paused", "cancelled"}:
            raise ConflictError("Unsupported subscription status", code="bad_status")
        return self.repo.list(
            user.id,
            status=status,
            days=days,
            search=search,
            limit=limit,
            offset=offset,
        )

    def get(self, user, subscription_id: uuid.UUID) -> Subscription:
        subscription = self.repo.get(user.id, subscription_id)
        if subscription is None:
            raise NotFoundError("Subscription not found")
        return subscription

    def create(self, user, payload: SubscriptionCreate) -> Subscription:
        category_id = self._resolve_category(user.id, payload.category_id)
        subscription = Subscription(
            user_id=user.id,
            category_id=category_id,
            name=payload.name,
            provider=payload.provider,
            amount=Decimal(payload.amount).quantize(Decimal("0.01")),
            currency=(payload.currency or account_currency(user)).upper(),
            billing_cycle=payload.billing_cycle,
            next_payment_date=payload.next_payment_date,
            started_on=payload.started_on,
            status="active",
            reminder_days_before=payload.reminder_days_before,
            notes=payload.notes,
        )
        self.repo.add(subscription)
        self.db.commit()
        self.db.refresh(subscription)
        return subscription

    def update(
        self, user, subscription_id: uuid.UUID, payload: SubscriptionUpdate
    ) -> Subscription:
        subscription = self.get(user, subscription_id)
        data = payload.model_dump(exclude_unset=True)

        if "category_id" in data:
            category_id = data.pop("category_id")
            subscription.category_id = (
                None
                if category_id is None
                else self._resolve_category(user.id, category_id)
            )
        if "amount" in data and data["amount"] is not None:
            data["amount"] = Decimal(data["amount"]).quantize(Decimal("0.01"))
        if data.get("currency") is not None:
            data["currency"] = data["currency"].upper()

        for field, value in data.items():
            if value is not None or field in {"provider", "notes", "started_on"}:
                setattr(subscription, field, value)

        self.db.commit()
        self.db.refresh(subscription)
        return subscription

    def delete(self, user, subscription_id: uuid.UUID) -> None:
        subscription = self.get(user, subscription_id)
        self.db.delete(subscription)
        self.db.commit()

    def pay(
        self, user, subscription_id: uuid.UUID, payload: PaymentCreate
    ) -> Subscription:
        subscription = self.get(user, subscription_id)
        if subscription.status != "active":
            raise ConflictError(
                "Only active subscriptions can record payments",
                code="subscription_not_active",
            )

        paid_on = payload.paid_on or date.today()
        existing = self.repo.list_payments(user.id, subscription.id)
        if any(payment.paid_on == paid_on for payment in existing):
            raise ConflictError(
                "A payment for this subscription was already recorded on that date",
                code="payment_already_recorded",
            )

        amount = (
            Decimal(payload.amount).quantize(Decimal("0.01"))
            if payload.amount is not None
            else subscription.amount
        )
        self.payments.add(
            Payment(
                user_id=user.id,
                subscription_id=subscription.id,
                amount=amount,
                currency=subscription.currency,
                paid_on=paid_on,
                note=payload.note,
            )
        )
        subscription.next_payment_date = advance_until_after(
            subscription.next_payment_date,
            subscription.billing_cycle,
            after=max(date.today(), paid_on),
        )
        self.db.commit()
        self.db.refresh(subscription)
        return subscription

    def list_payments(self, user, subscription_id: uuid.UUID) -> list[Payment]:
        subscription = self.get(user, subscription_id)
        return self.repo.list_payments(user.id, subscription.id)

    def _resolve_category(
        self, user_id: uuid.UUID, category_id: uuid.UUID | None
    ) -> uuid.UUID | None:
        if category_id is None:
            return None
        category = self.categories.get_accessible(user_id, category_id)
        if category is None:
            raise NotFoundError("Transaction category not found")
        return category.id
