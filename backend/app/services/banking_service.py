"""Bank connection, consent and synchronisation business logic."""

from __future__ import annotations

import hashlib
import logging
import uuid
from datetime import date, timedelta
from decimal import Decimal

from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.exceptions import BadRequestError, ConflictError, NotFoundError
from app.core.security import ensure_utc, utcnow
from app.models.financial import (
    BankConnection,
    BankConsent,
    FinancialAccount,
    SyncJob,
    Transaction,
)
from app.providers.bank.base import ProviderAccount, ProviderError, ProviderTransaction
from app.providers.bank.registry import get_provider
from app.repositories.banking_repository import BankingRepository
from app.repositories.transaction_repository import (
    CategoryRepository,
    TransactionRepository,
)
from app.schemas.banking import ConnectionCreate
from app.services.categorization import suggest_category_slug

logger = logging.getLogger(__name__)

MAX_CONNECTIONS_PER_USER = 10
_ALLOWED_ACCOUNT_TYPES = {"checking", "savings", "credit_card", "loan", "wallet"}
_ALLOWED_TRANSACTION_TYPES = {"income", "expense", "transfer"}
_CENT = Decimal("0.01")
_MAX_ABS_AMOUNT = Decimal("1000000000000")


def _money(value: Decimal) -> Decimal:
    return Decimal(value).quantize(_CENT)


class BankingService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.repo = BankingRepository(db)

    # --------------------------------------------------------------- connect
    def connect(
        self, user, payload: ConnectionCreate
    ) -> tuple[BankConnection, SyncJob | None]:
        provider = self._resolve_provider(payload.provider)
        if self.repo.count_connections(user.id) >= MAX_CONNECTIONS_PER_USER:
            raise ConflictError(
                "You have reached the maximum number of bank connections",
                code="connection_limit_reached",
            )

        try:
            authorization = provider.authorize(
                institution_id=payload.institution_id,
                user_reference=user.id,
            )
        except ProviderError as exc:
            raise BadRequestError(str(exc), code="provider_error") from exc

        connection = BankConnection(
            user_id=user.id,
            provider=provider.slug,
            institution_id=authorization.institution_id,
            institution_name=authorization.institution_name,
            external_reference=authorization.external_reference,
            status="active",
            is_mock=provider.is_mock,
        )
        consent = BankConsent(
            user_id=user.id,
            scopes=",".join(authorization.scopes),
            status="active",
            granted_at=utcnow(),
            expires_at=authorization.expires_at,
        )
        connection.consents.append(consent)
        self.repo.add_connection(connection)
        self.db.commit()
        self.db.refresh(connection)

        job = self.sync(user, connection.id)
        self.db.refresh(connection)
        return connection, job

    # ------------------------------------------------------------- retrieval
    def list_connections(self, user) -> list[BankConnection]:
        return self.repo.list_connections(user.id)

    def get_connection(self, user, connection_id: uuid.UUID) -> BankConnection:
        connection = self.repo.get_connection(user.id, connection_id)
        if connection is None:
            raise NotFoundError("Bank connection not found")
        return connection

    def revoke(self, user, connection_id: uuid.UUID) -> None:
        connection = self.get_connection(user, connection_id)
        consent = self.repo.latest_consent(connection.id)
        now = utcnow()
        if consent is not None and consent.status != "revoked":
            consent.status = "revoked"
            consent.revoked_at = now
        connection.status = "revoked"
        connection.last_error = None
        for account in connection.accounts:
            account.is_active = False

        try:
            get_provider(connection.provider).revoke(
                external_reference=connection.external_reference
            )
        except Exception:  # local revocation must still succeed
            logger.warning(
                "Provider revocation failed for connection %s",
                connection.id,
                exc_info=True,
            )

        self.db.commit()

    # ------------------------------------------------------------------ sync
    def sync(self, user, connection_id: uuid.UUID) -> SyncJob:
        connection = self.repo.get_connection(user.id, connection_id, lock=True)
        if connection is None:
            raise NotFoundError("Bank connection not found")
        if connection.status == "revoked":
            raise ConflictError(
                "This connection has been revoked. Reconnect to continue.",
                code="connection_revoked",
            )

        consent = self.repo.latest_consent(connection.id)
        now = utcnow()
        if consent is None or consent.status == "revoked":
            connection.status = "revoked"
            self.db.commit()
            raise ConflictError(
                "Consent has been revoked. Reconnect to continue.",
                code="consent_revoked",
            )
        if consent.status == "expired" or ensure_utc(consent.expires_at) <= now:
            consent.status = "expired"
            connection.status = "expired"
            connection.last_error = "Consent expired"
            self.db.commit()
            raise ConflictError(
                "Consent has expired. Reconnect to continue.",
                code="consent_expired",
            )

        job = SyncJob(
            user_id=user.id,
            connection_id=connection.id,
            status="running",
            started_at=now,
        )
        self.repo.add_sync_job(job)
        self.db.commit()
        self.db.refresh(job)

        try:
            provider = get_provider(connection.provider)
        except KeyError:
            return self._fail(job, connection, "The provider is no longer available")

        try:
            provider_accounts = provider.list_accounts(
                external_reference=connection.external_reference
            )
            for account in provider_accounts:
                self._validate_provider_account(account)
        except Exception:
            logger.exception("Provider account retrieval failed")
            return self._fail(job, connection, "Account retrieval failed")

        accounts_by_external: dict[str, FinancialAccount] = {}
        for provider_account in provider_accounts:
            account = self.repo.get_account_by_external(
                connection.id, provider_account.external_id
            )
            if account is None:
                account = FinancialAccount(
                    user_id=user.id,
                    connection_id=connection.id,
                    external_id=provider_account.external_id,
                    name=provider_account.name,
                    account_type=provider_account.account_type,
                    currency=provider_account.currency.upper(),
                    balance=_money(provider_account.balance),
                    available_balance=_money(provider_account.available_balance),
                    is_mock=connection.is_mock,
                )
                self.repo.add_account(account)
            else:
                account.name = provider_account.name
                account.account_type = provider_account.account_type
                account.currency = provider_account.currency.upper()
                account.balance = _money(provider_account.balance)
                account.available_balance = _money(provider_account.available_balance)
                account.is_active = True
            account.last_synced_at = now
            accounts_by_external[provider_account.external_id] = account

        self.db.flush()

        categories = {
            category.slug: category
            for category in CategoryRepository(self.db).ensure_system_categories()
        }

        lookback = timedelta(days=settings.bank_sync_lookback_days)
        if connection.last_synced_at is not None:
            since = ensure_utc(connection.last_synced_at).date() - timedelta(days=3)
        else:
            since = date.today() - lookback

        created = 0
        skipped = 0
        account_errors = 0
        account_failures: list[str] = []
        seen_keys: set[str] = set()
        transaction_repo = TransactionRepository(self.db)

        for provider_account in provider_accounts:
            account = accounts_by_external[provider_account.external_id]
            try:
                records = provider.list_transactions(
                    external_reference=connection.external_reference,
                    account_external_id=provider_account.external_id,
                    since=since,
                )
            except Exception:
                account_errors += 1
                account_failures.append(provider_account.external_id)
                logger.exception(
                    "Transaction retrieval failed for account %s",
                    provider_account.external_id,
                )
                continue

            for record in records:
                try:
                    self._validate_provider_transaction(record)
                except ValueError:
                    skipped += 1
                    continue
                if record.account_external_id != provider_account.external_id:
                    skipped += 1
                    continue

                dedupe_key = self._dedupe_key(
                    account.id, record.external_id
                )
                if dedupe_key in seen_keys or transaction_repo.exists_dedupe(
                    account.id, dedupe_key
                ):
                    skipped += 1
                    continue
                seen_keys.add(dedupe_key)

                slug = suggest_category_slug(record.description, record.merchant)
                transaction = Transaction(
                    user_id=user.id,
                    account_id=account.id,
                    category_id=(
                        categories[slug].id
                        if slug in categories
                        else categories["other"].id
                    ),
                    amount=_money(record.amount),
                    currency=record.currency.upper(),
                    description=record.description,
                    merchant=record.merchant,
                    occurred_on=record.occurred_on,
                    transaction_type=record.transaction_type,
                    source="provider",
                    external_id=record.external_id,
                    dedupe_key=dedupe_key,
                    is_pending=record.is_pending,
                )
                transaction_repo.add(transaction)
                created += 1

        finished_at = utcnow()
        job.accounts_synced = len(provider_accounts)
        job.transactions_created = created
        job.transactions_skipped = skipped
        job.finished_at = finished_at
        if account_errors and account_errors == len(provider_accounts):
            job.status = "failed"
            job.error_message = "Transaction retrieval failed"
        elif account_errors:
            job.status = "partial"
            job.error_message = (
                "Some accounts could not be synchronised: "
                + ", ".join(account_failures)
            )[:500]
        else:
            job.status = "succeeded"

        connection.last_synced_at = finished_at
        connection.last_error = job.error_message
        if connection.status != "expired":
            connection.status = "active"
        self.db.commit()
        self.db.refresh(job)
        return job

    # ------------------------------------------------------------------ jobs
    def list_jobs(
        self,
        user,
        *,
        connection_id: uuid.UUID | None = None,
        limit: int = 20,
    ) -> list[SyncJob]:
        if connection_id is not None:
            self.get_connection(user, connection_id)
        return self.repo.list_sync_jobs(
            user.id, connection_id=connection_id, limit=limit
        )

    def get_job(self, user, job_id: uuid.UUID) -> SyncJob:
        job = self.repo.get_sync_job(user.id, job_id)
        if job is None:
            raise NotFoundError("Synchronisation job not found")
        return job

    # -------------------------------------------------------------- helpers
    @staticmethod
    def _resolve_provider(slug: str | None):
        try:
            return get_provider(slug)
        except KeyError as exc:
            raise BadRequestError(
                "Unknown financial data provider", code="unknown_provider"
            ) from exc

    @staticmethod
    def _dedupe_key(account_id: uuid.UUID, external_id: str) -> str:
        return hashlib.sha256(
            f"{account_id}:{external_id}".encode("utf-8")
        ).hexdigest()

    def _fail(
        self, job: SyncJob, connection: BankConnection, message: str
    ) -> SyncJob:
        job.status = "failed"
        job.finished_at = utcnow()
        job.error_message = (message or "Synchronisation failed")[:500]
        connection.last_error = job.error_message
        self.db.commit()
        self.db.refresh(job)
        return job

    @staticmethod
    def _validate_provider_account(account: ProviderAccount) -> None:
        if not account.external_id or len(account.external_id) > 128:
            raise ProviderError("Provider returned an invalid account identifier")
        if not account.name or len(account.name) > 120:
            raise ProviderError("Provider returned an invalid account name")
        if account.account_type not in _ALLOWED_ACCOUNT_TYPES:
            raise ProviderError("Provider returned an unsupported account type")
        if (
            len(account.currency) != 3
            or not account.currency.isalpha()
        ):
            raise ProviderError("Provider returned an invalid currency")
        for value in (account.balance, account.available_balance):
            if not Decimal(value).is_finite() or abs(Decimal(value)) > _MAX_ABS_AMOUNT:
                raise ProviderError("Provider returned an invalid balance")

    @staticmethod
    def _validate_provider_transaction(record: ProviderTransaction) -> None:
        if not record.external_id or len(record.external_id) > 128:
            raise ValueError("invalid transaction identifier")
        if not record.description or len(record.description) > 255:
            raise ValueError("invalid description")
        if record.merchant is not None and len(record.merchant) > 120:
            raise ValueError("invalid merchant")
        if len(record.currency) != 3 or not record.currency.isalpha():
            raise ValueError("invalid currency")
        amount = Decimal(record.amount)
        if not amount.is_finite() or amount == 0 or abs(amount) > _MAX_ABS_AMOUNT:
            raise ValueError("invalid amount")
        if record.transaction_type not in _ALLOWED_TRANSACTION_TYPES:
            raise ValueError("invalid transaction type")
        if record.occurred_on > date.today() + timedelta(days=1):
            raise ValueError("transaction date is in the future")


def account_currency(user) -> str:
    """The user's preferred currency, used as a default for new records."""

    preferences = getattr(user, "preferences", None)
    if preferences is not None and getattr(preferences, "currency", None):
        return preferences.currency
    return "INR"


__all__ = ["BankingService", "account_currency"]
