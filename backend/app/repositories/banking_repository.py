"""Data access for bank connections, consents, accounts and sync jobs."""

import uuid

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.financial import (
    BankConnection,
    BankConsent,
    FinancialAccount,
    SyncJob,
)


class BankingRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    # ---------------------------------------------------------- connections
    def add_connection(self, connection: BankConnection) -> BankConnection:
        self.db.add(connection)
        return connection

    def get_connection(
        self, user_id: uuid.UUID, connection_id: uuid.UUID, *, lock: bool = False
    ) -> BankConnection | None:
        statement = select(BankConnection).where(
            BankConnection.id == connection_id,
            BankConnection.user_id == user_id,
        )
        if lock:
            statement = statement.with_for_update()
        return self.db.execute(statement).scalar_one_or_none()

    def list_connections(self, user_id: uuid.UUID) -> list[BankConnection]:
        statement = (
            select(BankConnection)
            .where(BankConnection.user_id == user_id)
            .order_by(BankConnection.created_at.desc())
        )
        return list(self.db.scalars(statement))

    def count_connections(self, user_id: uuid.UUID) -> int:
        statement = (
            select(func.count())
            .select_from(BankConnection)
            .where(BankConnection.user_id == user_id)
        )
        return int(self.db.scalar(statement) or 0)

    # ------------------------------------------------------------- consents
    def latest_consent(self, connection_id: uuid.UUID) -> BankConsent | None:
        statement = (
            select(BankConsent)
            .where(BankConsent.connection_id == connection_id)
            .order_by(BankConsent.granted_at.desc())
            .limit(1)
        )
        return self.db.execute(statement).scalar_one_or_none()

    def add_consent(self, consent: BankConsent) -> BankConsent:
        self.db.add(consent)
        return consent

    # ------------------------------------------------------------- accounts
    def get_account(
        self, user_id: uuid.UUID, account_id: uuid.UUID
    ) -> FinancialAccount | None:
        statement = select(FinancialAccount).where(
            FinancialAccount.id == account_id,
            FinancialAccount.user_id == user_id,
        )
        return self.db.execute(statement).scalar_one_or_none()

    def get_account_by_external(
        self, connection_id: uuid.UUID, external_id: str
    ) -> FinancialAccount | None:
        statement = select(FinancialAccount).where(
            FinancialAccount.connection_id == connection_id,
            FinancialAccount.external_id == external_id,
        )
        return self.db.execute(statement).scalar_one_or_none()

    def list_accounts(
        self, user_id: uuid.UUID, *, active_only: bool = False
    ) -> list[FinancialAccount]:
        statement = select(FinancialAccount).where(
            FinancialAccount.user_id == user_id
        )
        if active_only:
            statement = statement.where(FinancialAccount.is_active.is_(True))
        statement = statement.order_by(FinancialAccount.created_at.asc())
        return list(self.db.scalars(statement))

    def add_account(self, account: FinancialAccount) -> FinancialAccount:
        self.db.add(account)
        return account

    # ------------------------------------------------------------ sync jobs
    def add_sync_job(self, job: SyncJob) -> SyncJob:
        self.db.add(job)
        return job

    def get_sync_job(
        self, user_id: uuid.UUID, job_id: uuid.UUID
    ) -> SyncJob | None:
        statement = select(SyncJob).where(
            SyncJob.id == job_id, SyncJob.user_id == user_id
        )
        return self.db.execute(statement).scalar_one_or_none()

    def list_sync_jobs(
        self,
        user_id: uuid.UUID,
        *,
        connection_id: uuid.UUID | None = None,
        limit: int = 20,
    ) -> list[SyncJob]:
        statement = select(SyncJob).where(SyncJob.user_id == user_id)
        if connection_id is not None:
            statement = statement.where(SyncJob.connection_id == connection_id)
        statement = statement.order_by(SyncJob.started_at.desc()).limit(limit)
        return list(self.db.scalars(statement))
