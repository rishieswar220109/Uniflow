"""Transaction and category API routes."""

import uuid
from datetime import date
from typing import Annotated

from fastapi import APIRouter, Query, Response, status

from app.api.deps import CurrentUser, DatabaseSession
from app.schemas.transactions import (
    CategoryRead,
    TransactionCreate,
    TransactionPage,
    TransactionRead,
    TransactionUpdate,
)
from app.schemas.financial_insights import FinancialInsightRead
from app.services.transaction_service import TransactionService

router = APIRouter(prefix="/transactions", tags=["Transactions"])


@router.get(
    "/categories",
    response_model=list[CategoryRead],
    summary="List available transaction categories",
)
def list_categories(
    current_user: CurrentUser, db: DatabaseSession
) -> list[CategoryRead]:
    categories = TransactionService(db).list_categories(current_user)
    return [CategoryRead.model_validate(category) for category in categories]


@router.get(
    "",
    response_model=TransactionPage,
    summary="List transactions with filters",
)
def list_transactions(
    current_user: CurrentUser,
    db: DatabaseSession,
    account_id: uuid.UUID | None = None,
    category_id: uuid.UUID | None = None,
    transaction_type: str | None = None,
    from_date: date | None = None,
    to_date: date | None = None,
    search: str | None = None,
    source: str | None = None,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> TransactionPage:
    items, total = TransactionService(db).list(
        current_user,
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
    return TransactionPage(
        items=[TransactionRead.model_validate(item) for item in items],
        total=total,
        limit=limit,
        offset=offset,
    )


@router.post(
    "",
    response_model=TransactionRead,
    status_code=status.HTTP_201_CREATED,
    summary="Record a manual transaction",
)
def create_transaction(
    payload: TransactionCreate,
    current_user: CurrentUser,
    db: DatabaseSession,
) -> TransactionRead:
    transaction, alerts = TransactionService(db).create_with_alerts(
        current_user, payload
    )
    response = TransactionRead.model_validate(transaction)
    response.alerts = [
        FinancialInsightRead.model_validate(alert) for alert in alerts
    ]
    return response


@router.get(
    "/{transaction_id}",
    response_model=TransactionRead,
    summary="Get one transaction",
)
def get_transaction(
    transaction_id: uuid.UUID,
    current_user: CurrentUser,
    db: DatabaseSession,
) -> TransactionRead:
    transaction = TransactionService(db).get(current_user, transaction_id)
    return TransactionRead.model_validate(transaction)


@router.patch(
    "/{transaction_id}",
    response_model=TransactionRead,
    summary="Recategorise or annotate a transaction",
)
def update_transaction(
    transaction_id: uuid.UUID,
    payload: TransactionUpdate,
    current_user: CurrentUser,
    db: DatabaseSession,
) -> TransactionRead:
    transaction = TransactionService(db).update(
        current_user, transaction_id, payload
    )
    return TransactionRead.model_validate(transaction)


@router.delete(
    "/{transaction_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a manually recorded transaction",
)
def delete_transaction(
    transaction_id: uuid.UUID,
    current_user: CurrentUser,
    db: DatabaseSession,
) -> Response:
    TransactionService(db).delete(current_user, transaction_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
