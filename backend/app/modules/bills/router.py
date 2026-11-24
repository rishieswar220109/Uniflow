"""Bill management API routes."""

import uuid
from typing import Annotated

from fastapi import APIRouter, Query, Response, status

from app.api.deps import CurrentUser, DatabaseSession
from app.schemas.bills import BillCreate, BillPage, BillRead, BillUpdate
from app.schemas.payments import PaymentCreate, PaymentRead
from app.services.bill_service import BillService

router = APIRouter(prefix="/bills", tags=["Bills"])


@router.get("", response_model=BillPage, summary="List bills by state")
def list_bills(
    current_user: CurrentUser,
    db: DatabaseSession,
    state: str | None = None,
    days: Annotated[int, Query(ge=1, le=365)] = 30,
    search: str | None = None,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> BillPage:
    items, total = BillService(db).list(
        current_user,
        state=state,
        days=days,
        search=search,
        limit=limit,
        offset=offset,
    )
    return BillPage(
        items=[BillRead.model_validate(item) for item in items],
        total=total,
        limit=limit,
        offset=offset,
    )


@router.post(
    "",
    response_model=BillRead,
    status_code=status.HTTP_201_CREATED,
    summary="Create a bill",
)
def create_bill(
    payload: BillCreate,
    current_user: CurrentUser,
    db: DatabaseSession,
) -> BillRead:
    bill = BillService(db).create(current_user, payload)
    return BillRead.model_validate(bill)


@router.get("/{bill_id}", response_model=BillRead, summary="Get one bill")
def get_bill(
    bill_id: uuid.UUID,
    current_user: CurrentUser,
    db: DatabaseSession,
) -> BillRead:
    bill = BillService(db).get(current_user, bill_id)
    return BillRead.model_validate(bill)


@router.patch("/{bill_id}", response_model=BillRead, summary="Update a bill")
def update_bill(
    bill_id: uuid.UUID,
    payload: BillUpdate,
    current_user: CurrentUser,
    db: DatabaseSession,
) -> BillRead:
    bill = BillService(db).update(current_user, bill_id, payload)
    return BillRead.model_validate(bill)


@router.delete(
    "/{bill_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a bill and its payment history",
)
def delete_bill(
    bill_id: uuid.UUID,
    current_user: CurrentUser,
    db: DatabaseSession,
) -> Response:
    BillService(db).delete(current_user, bill_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post(
    "/{bill_id}/pay",
    response_model=BillRead,
    summary="Record a bill payment and advance a recurring schedule",
)
def pay_bill(
    bill_id: uuid.UUID,
    payload: PaymentCreate,
    current_user: CurrentUser,
    db: DatabaseSession,
) -> BillRead:
    bill = BillService(db).pay(current_user, bill_id, payload)
    return BillRead.model_validate(bill)


@router.get(
    "/{bill_id}/payments",
    response_model=list[PaymentRead],
    summary="List a bill's payment history",
)
def list_bill_payments(
    bill_id: uuid.UUID,
    current_user: CurrentUser,
    db: DatabaseSession,
) -> list[PaymentRead]:
    payments = BillService(db).list_payments(current_user, bill_id)
    return [PaymentRead.model_validate(payment) for payment in payments]
