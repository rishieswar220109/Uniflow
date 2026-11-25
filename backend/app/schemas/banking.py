"""Schemas for bank connections, consents and synchronisation jobs."""

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.accounts import FinancialAccountRead


class ProviderInstitutionRead(BaseModel):
    id: str
    name: str
    country: str
    is_mock: bool


class ProviderRead(BaseModel):
    slug: str
    display_name: str
    is_mock: bool
    institutions: list[ProviderInstitutionRead]


class ConsentRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    status: str
    scopes: str
    granted_at: datetime
    expires_at: datetime
    revoked_at: datetime | None


class ConnectionCreate(BaseModel):
    institution_id: str = Field(min_length=1, max_length=64)
    provider: str | None = Field(default=None, min_length=1, max_length=32)


class ConnectionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    provider: str
    institution_id: str
    institution_name: str
    status: str
    is_mock: bool
    last_synced_at: datetime | None
    last_error: str | None
    created_at: datetime
    accounts: list[FinancialAccountRead] = []
    consents: list[ConsentRead] = []


class SyncJobRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    connection_id: uuid.UUID
    status: str
    started_at: datetime
    finished_at: datetime | None
    accounts_synced: int
    transactions_created: int
    transactions_skipped: int
    error_message: str | None


class ConnectionCreateResponse(BaseModel):
    connection: ConnectionRead
    sync_job: SyncJobRead | None = None
