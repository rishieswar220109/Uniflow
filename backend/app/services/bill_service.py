"""Bill management, payment recording and upcoming obligations."""

from __future__ import annotations

import uuid
from datetime import date
from decimal import Decimal

from sqlalchemy.orm import Session

from app.core.exceptions import BadRequestError, ConflictError, NotFoundError
from app.core.security import utcnow
from app.models.financial import Bill, Payment
from app.repositories.bill_repository import BillRepository, PaymentRepository
from app.repositories.transaction_repository import CategoryRepository
from app.schemas.bills import BillCreate, BillUpdate
from app.schemas.payments import PaymentCreate
from app.services.banking_service import account_currency
from app.services.recurrence import advance_until_after


class BillService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.repo = BillRepository(db)
        self.payments = PaymentRepository(db)
        self.categories = CategoryRepository(db)

    def list(
        self,
        user,
        *,
        state: str | None = None,
        days: int = 30,
        search: str | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> tuple[list[Bill], int]:
        allowed = {
            None,
            "all",
            "upcoming",
            "overdue",
            "due",
            "unpaid",
            "paid",
            "skipped",
            "cancelled",
        }
        if state not in allowed:
            raise BadRequestError("Unsupported bill state")
        return self.repo.list(
            user.id,
            state=None if state == "all" else state,
            days=days,
            search=search,
            limit=limit,
            offset=offset,
        )

    def get(self, user, bill_id: uuid.UUID) -> Bill:
        bill = self.repo.get(user.id, bill_id)
        if bill is None:
            raise NotFoundError("Bill not found")
        return bill

    def create(self, user, payload: BillCreate) -> Bill:
        category_id = self._resolve_category(user.id, payload.category_id)
        currency = (payload.currency or account_currency(user)).upper()
        bill = Bill(
            user_id=user.id,
            category_id=category_id,
            name=payload.name,
            payee=payload.payee,
            amount=Decimal(payload.amount).quantize(Decimal("0.01")),
            currency=currency,
            due_date=payload.due_date,
            recurrence=payload.recurrence,
            status="unpaid",
            autopay=payload.autopay,
            reminder_days_before=payload.reminder_days_before,
            notes=payload.notes,
        )
        self.repo.add(bill)
        self.db.commit()
        self.db.refresh(bill)
        return bill

    def update(self, user, bill_id: uuid.UUID, payload: BillUpdate) -> Bill:
        bill = self.get(user, bill_id)
        data = payload.model_dump(exclude_unset=True)

        if "category_id" in data:
            category_id = data.pop("category_id")
            if category_id is None:
                bill.category_id = None
            else:
                bill.category_id = self._resolve_category(user.id, category_id)
        if "amount" in data:
            data["amount"] = Decimal(data["amount"]).quantize(Decimal("0.01"))
        if "currency" in data and data["currency"] is not None:
            data["currency"] = data["currency"].upper()
        if data.get("status") == "paid" and bill.last_paid_at is None:
            bill.last_paid_at = utcnow()

        for field, value in data.items():
            if value is not None or field in {"payee", "notes"}:
                setattr(bill, field, value)

        self.db.commit()
        self.db.refresh(bill)
        return bill

    def delete(self, user, bill_id: uuid.UUID) -> None:
        bill = self.get(user, bill_id)
        self.db.delete(bill)
        self.db.commit()

    def pay(
        self, user, bill_id: uuid.UUID, payload: PaymentCreate
    ) -> Bill:
        bill = self.get(user, bill_id)
        if bill.status in {"cancelled", "skipped"}:
            raise ConflictError(
                "This bill is not payable in its current state",
                code="bill_not_payable",
            )
        if bill.status == "paid" and bill.recurrence == "none":
            raise ConflictError(
                "This bill has already been paid", code="already_paid"
            )

        paid_on = payload.paid_on or date.today()
        recorded = self.repo.list_payments(user.id, bill.id)
        if any(payment.paid_on == paid_on for payment in recorded):
            raise ConflictError(
                "A payment for this bill was already recorded on that date",
                code="payment_already_recorded",
            )

        amount = (
            Decimal(payload.amount).quantize(Decimal("0.01"))
            if payload.amount is not None
            else bill.amount
        )
        payment = Payment(
            user_id=user.id,
            bill_id=bill.id,
            amount=amount,
            currency=bill.currency,
            paid_on=paid_on,
            note=payload.note,
        )
        self.payments.add(payment)

        bill.last_paid_at = utcnow()
        if bill.recurrence == "none":
            bill.status = "paid"
        else:
            bill.due_date = advance_until_after(
                bill.due_date,
                bill.recurrence,
                after=max(date.today(), paid_on),
            )
            bill.status = "unpaid"

        self.db.commit()
        self.db.refresh(bill)
        return bill

    def list_payments(self, user, bill_id: uuid.UUID) -> list[Payment]:
        bill = self.get(user, bill_id)
        return self.repo.list_payments(user.id, bill.id)

    def _resolve_category(
        self, user_id: uuid.UUID, category_id: uuid.UUID | None
    ) -> uuid.UUID | None:
        if category_id is None:
            return None
        category = self.categories.get_accessible(user_id, category_id)
        if category is None:
            raise NotFoundError("Transaction category not found")
        return category.id
