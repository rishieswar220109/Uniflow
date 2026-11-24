"""Bank connection, consent and synchronisation API routes."""

import uuid
from typing import Annotated

from fastapi import APIRouter, Query, Response, status

from app.api.deps import CurrentUser, DatabaseSession
from app.providers.bank.registry import available_providers
from app.schemas.banking import (
    ConnectionCreate,
    ConnectionCreateResponse,
    ConnectionRead,
    ProviderInstitutionRead,
    ProviderRead,
    SyncJobRead,
)
from app.services.banking_service import BankingService

router = APIRouter(prefix="/banking", tags=["Banking"])


@router.get(
    "/providers",
    response_model=list[ProviderRead],
    summary="List supported financial data providers",
)
def list_providers() -> list[ProviderRead]:
    return [
        ProviderRead(
            slug=provider.slug,
            display_name=provider.display_name,
            is_mock=provider.is_mock,
            institutions=[
                ProviderInstitutionRead(
                    id=institution.id,
                    name=institution.name,
                    country=institution.country,
                    is_mock=institution.is_mock,
                )
                for institution in provider.list_institutions()
            ],
        )
        for provider in available_providers()
    ]


@router.post(
    "/connections",
    response_model=ConnectionCreateResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a consent-based bank connection and run an initial sync",
)
def create_connection(
    payload: ConnectionCreate,
    current_user: CurrentUser,
    db: DatabaseSession,
) -> ConnectionCreateResponse:
    connection, job = BankingService(db).connect(current_user, payload)
    return ConnectionCreateResponse(
        connection=ConnectionRead.model_validate(connection),
        sync_job=SyncJobRead.model_validate(job) if job is not None else None,
    )


@router.get(
    "/connections",
    response_model=list[ConnectionRead],
    summary="List the current user's bank connections",
)
def list_connections(
    current_user: CurrentUser, db: DatabaseSession
) -> list[ConnectionRead]:
    connections = BankingService(db).list_connections(current_user)
    return [ConnectionRead.model_validate(item) for item in connections]


@router.get(
    "/connections/{connection_id}",
    response_model=ConnectionRead,
    summary="Get one bank connection",
)
def get_connection(
    connection_id: uuid.UUID,
    current_user: CurrentUser,
    db: DatabaseSession,
) -> ConnectionRead:
    connection = BankingService(db).get_connection(current_user, connection_id)
    return ConnectionRead.model_validate(connection)


@router.delete(
    "/connections/{connection_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Revoke consent and disable a bank connection",
)
def revoke_connection(
    connection_id: uuid.UUID,
    current_user: CurrentUser,
    db: DatabaseSession,
) -> Response:
    BankingService(db).revoke(current_user, connection_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post(
    "/connections/{connection_id}/sync",
    response_model=SyncJobRead,
    summary="Synchronise accounts and transactions for a connection",
)
def sync_connection(
    connection_id: uuid.UUID,
    current_user: CurrentUser,
    db: DatabaseSession,
) -> SyncJobRead:
    job = BankingService(db).sync(current_user, connection_id)
    return SyncJobRead.model_validate(job)


@router.get(
    "/sync-jobs",
    response_model=list[SyncJobRead],
    summary="List recent synchronisation jobs",
)
def list_sync_jobs(
    current_user: CurrentUser,
    db: DatabaseSession,
    connection_id: uuid.UUID | None = None,
    limit: Annotated[int, Query(ge=1, le=50)] = 20,
) -> list[SyncJobRead]:
    jobs = BankingService(db).list_jobs(
        current_user, connection_id=connection_id, limit=limit
    )
    return [SyncJobRead.model_validate(job) for job in jobs]


@router.get(
    "/sync-jobs/{job_id}",
    response_model=SyncJobRead,
    summary="Get one synchronisation job",
)
def get_sync_job(
    job_id: uuid.UUID,
    current_user: CurrentUser,
    db: DatabaseSession,
) -> SyncJobRead:
    job = BankingService(db).get_job(current_user, job_id)
    return SyncJobRead.model_validate(job)
