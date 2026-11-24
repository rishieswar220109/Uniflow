"""Transaction queries, manual entry and category management."""

from __future__ import annotations

import hashlib
import uuid
from datetime import date
from decimal import Decimal

from sqlalchemy.orm import Session

from app.core.exceptions import BadRequestError, ConflictError, NotFoundError
from app.models.financial import Transaction
from app.repositories.banking_repository import BankingRepository
from app.repositories.transaction_repository import (
    CategoryRepository,
    TransactionRepository,
)
from app.schemas.transactions import TransactionCreate, TransactionUpdate
from app.services.categorization import (
    suggest_category_slug,
    suggest_transaction_type,
)


class TransactionService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.repo = TransactionRepository(db)
        self.categories = CategoryRepository(db)
        self.banking = BankingRepository(db)

    def list(
        self,
        user,
        *,
        account_id: uuid.UUID | None = None,
        category_id: uuid.UUID | None = None,
        transaction_type: str | None = None,
        from_date: date | None = None,
        to_date: date | None = None,
        search: str | None = None,
        source: str | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> tuple[list[Transaction], int]:
        if from_date and to_date and from_date > to_date:
            raise BadRequestError("The start date must be before the end date")
        if transaction_type is not None and transaction_type not in {
            "income",
            "expense",
            "transfer",
        }:
            raise BadRequestError("Unsupported transaction type")
        if source is not None and source not in {"provider", "manual"}:
            raise BadRequestError("Unsupported transaction source")
        return self.repo.list(
            user.id,
            account_id=account_id,
            category_id=category_id,
            transaction_type=transaction_type,
            from_date=from_date,
            to_date=to_date,
            search=search,
            source=source,
            limit=limit,
            offset=offset,
        )

    def get(self, user, transaction_id: uuid.UUID) -> Transaction:
        transaction = self.repo.get(user.id, transaction_id)
        if transaction is None:
            raise NotFoundError("Transaction not found")
        return transaction

    def list_categories(self, user):
        categories = self.categories.ensure_system_categories()
        # Persist any system categories created on this read so the returned
        # identifiers are usable in later create/update requests.
        self.db.commit()
        return categories

    def create(self, user, payload: TransactionCreate) -> Transaction:
        transaction, _ = self.create_with_alerts(user, payload)
        return transaction

    def create_with_alerts(
        self, user, payload: TransactionCreate
    ) -> tuple[Transaction, list]:
        """Record a manual transaction and run proactive spending awareness.

        The awareness rules are evaluated after the transaction is stored so
        they can use the persisted record, and their insights are returned to
        the caller together with the transaction. Nothing is sent as a push,
        email or SMS notification; insights are stored for the user to review.
        """
        account = self.banking.get_account(user.id, payload.account_id)
        if account is None:
            raise NotFoundError("Financial account not found")
        if not account.is_active:
            raise ConflictError(
                "This account is no longer active", code="account_inactive"
            )

        currency = (payload.currency or account.currency).upper()
        if currency != account.currency.upper():
            raise BadRequestError(
                "The currency must match the account currency",
                code="currency_mismatch",
            )

        category_id = self._resolve_category(user.id, payload.category_id)
        if category_id is None:
            slug = suggest_category_slug(payload.description, payload.merchant)
            categories = {
                category.slug: category
                for category in self.categories.ensure_system_categories()
            }
            category = categories.get(slug) or categories.get("other")
            category_id = category.id if category is not None else None

        amount = Decimal(payload.amount).quantize(Decimal("0.01"))
        dedupe_key = self._dedupe_key(
            account.id, payload.occurred_on, amount,
            payload.description, payload.merchant,
        )
        duplicate_detected = self.repo.exists_dedupe(account.id, dedupe_key)
        if duplicate_detected:
            if not payload.allow_duplicate:
                # Record the duplicate as a reviewable risk before returning
                # the conflict, so repeated accidental entries are visible.
                self._record_blocked_duplicate(user, payload, currency)
                raise ConflictError(
                    "A matching transaction already exists",
                    code="duplicate_transaction",
                )
            dedupe_key = hashlib.sha256(
                f"{dedupe_key}:{uuid.uuid4().hex}".encode("utf-8")
            ).hexdigest()

        transaction = Transaction(
            user_id=user.id,
            account_id=account.id,
            category_id=category_id,
            amount=amount,
            currency=currency,
            description=payload.description,
            merchant=payload.merchant,
            occurred_on=payload.occurred_on,
            transaction_type=suggest_transaction_type(amount),
            source="manual",
            external_id=None,
            dedupe_key=dedupe_key,
            is_pending=False,
            notes=payload.notes,
        )
        self.repo.add(transaction)
        self.db.commit()
        self.db.refresh(transaction)

        from app.services.intelligence_service import IntelligenceService

        alerts = IntelligenceService(self.db).evaluate_transaction(
            user, transaction, duplicate=duplicate_detected
        )
        return transaction, alerts

    def update(
        self, user, transaction_id: uuid.UUID, payload: TransactionUpdate
    ) -> Transaction:
        transaction = self.get(user, transaction_id)
        data = payload.model_dump(exclude_unset=True)

        if "category_id" in data:
            category_id = data["category_id"]
            if category_id is None:
                transaction.category_id = None
            else:
                category = self.categories.get_accessible(user.id, category_id)
                if category is None:
                    raise NotFoundError("Transaction category not found")
                transaction.category_id = category.id
        if "merchant" in data:
            transaction.merchant = data["merchant"]
        if "notes" in data:
            transaction.notes = data["notes"]

        self.db.commit()
        self.db.refresh(transaction)
        return transaction

    def delete(self, user, transaction_id: uuid.UUID) -> None:
        transaction = self.get(user, transaction_id)
        if transaction.source != "manual":
            raise ConflictError(
                "Provider-synced transactions cannot be deleted; "
                "recategorise or annotate them instead.",
                code="provider_transaction",
            )
        self.db.delete(transaction)
        self.db.commit()

    # ---------------------------------------------------------------- helpers
    def _record_blocked_duplicate(
        self, user, payload: TransactionCreate, currency: str
    ) -> None:
        """Persist a duplicate-transaction insight for a blocked manual entry."""
        from app.services.financial_insight_service import FinancialInsightService

        label = (payload.merchant or payload.description).strip()
        title = f"Possible duplicate transaction: {label}"
        service = FinancialInsightService(self.db)
        if service.find_existing(
            user,
            insight_type="duplicate_transaction",
            title=title,
            related_date=payload.occurred_on,
        ):
            return
        service.create(
            user,
            insight_type="duplicate_transaction",
            severity="warning",
            title=title,
            description=(
                f"A matching “{label}” transaction for "
                f"{currency} {abs(Decimal(payload.amount))} on "
                f"{payload.occurred_on.isoformat()} already exists. The new "
                "entry was not stored. Review your history to confirm whether "
                "the earlier record was correct."
            ),
            amount=abs(Decimal(payload.amount)),
            currency=currency,
            related_date=payload.occurred_on,
        )

    def _resolve_category(
        self, user_id: uuid.UUID, category_id: uuid.UUID | None
    ) -> uuid.UUID | None:
        if category_id is None:
            return None
        category = self.categories.get_accessible(user_id, category_id)
        if category is None:
            raise NotFoundError("Transaction category not found")
        return category.id

    @staticmethod
    def _dedupe_key(
        account_id: uuid.UUID,
        occurred_on: date,
        amount: Decimal,
        description: str,
        merchant: str | None,
    ) -> str:
        payload = "|".join(
            (
                str(account_id),
                occurred_on.isoformat(),
                f"{amount:.2f}",
                description.strip().lower(),
                (merchant or "").strip().lower(),
            )
        )
        return hashlib.sha256(payload.encode("utf-8")).hexdigest()
