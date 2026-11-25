"""Data access for bills and their payment history."""

from __future__ import annotations

import uuid
from datetime import date, timedelta

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.financial import Bill, Payment


class BillRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def get(self, user_id: uuid.UUID, bill_id: uuid.UUID) -> Bill | None:
        statement = select(Bill).where(
            Bill.id == bill_id, Bill.user_id == user_id
        )
        return self.db.execute(statement).scalar_one_or_none()

    def add(self, bill: Bill) -> Bill:
        self.db.add(bill)
        return bill

    def delete(self, bill: Bill) -> None:
        self.db.delete(bill)

    def list(
        self,
        user_id: uuid.UUID,
        *,
        state: str | None = None,
        days: int = 30,
        search: str | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> tuple[list[Bill], int]:
        today = date.today()
        filters = [Bill.user_id == user_id]
        if state == "upcoming":
            filters += [
                Bill.status == "unpaid",
                Bill.due_date >= today,
                Bill.due_date <= today + timedelta(days=days),
            ]
        elif state == "overdue":
            filters += [Bill.status == "unpaid", Bill.due_date < today]
        elif state == "due":
            filters += [Bill.status == "unpaid", Bill.due_date == today]
        elif state in {"paid", "skipped", "cancelled"}:
            filters.append(Bill.status == state)
        elif state == "unpaid":
            filters.append(Bill.status == "unpaid")

        if search:
            pattern = f"%{search.strip().lower()}%"
            filters.append(
                func.lower(Bill.name).like(pattern)
                | func.lower(func.coalesce(Bill.payee, "")).like(pattern)
            )

        total = int(
            self.db.scalar(select(func.count()).select_from(Bill).where(*filters))
            or 0
        )
        statement = (
            select(Bill)
            .where(*filters)
            .order_by(Bill.due_date.asc(), Bill.created_at.asc())
            .limit(limit)
            .offset(offset)
        )
        return list(self.db.scalars(statement)), total

    def list_upcoming(
        self, user_id: uuid.UUID, *, days: int = 30, limit: int = 50
    ) -> list[Bill]:
        today = date.today()
        statement = (
            select(Bill)
            .where(
                Bill.user_id == user_id,
                Bill.status == "unpaid",
                Bill.due_date <= today + timedelta(days=days),
            )
            .order_by(Bill.due_date.asc())
            .limit(limit)
        )
        return list(self.db.scalars(statement))

    def find_by_name(self, user_id: uuid.UUID, name: str) -> Bill | None:
        statement = (
            select(Bill)
            .where(
                Bill.user_id == user_id,
                func.lower(Bill.name) == name.strip().lower(),
            )
            .limit(1)
        )
        return self.db.execute(statement).scalar_one_or_none()

    def list_payments(self, user_id: uuid.UUID, bill_id: uuid.UUID) -> list[Payment]:
        statement = (
            select(Payment)
            .where(Payment.user_id == user_id, Payment.bill_id == bill_id)
            .order_by(Payment.paid_on.desc(), Payment.created_at.desc())
        )
        return list(self.db.scalars(statement))


class PaymentRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def add(self, payment: Payment) -> Payment:
        self.db.add(payment)
        return payment
