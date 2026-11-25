"""Subscription management API routes."""

import uuid
from typing import Annotated

from fastapi import APIRouter, Query, Response, status

from app.api.deps import CurrentUser, DatabaseSession
from app.schemas.payments import PaymentCreate, PaymentRead
from app.schemas.subscriptions import (
    SubscriptionCreate,
    SubscriptionPage,
    SubscriptionRead,
    SubscriptionUpdate,
)
from app.services.subscription_service import SubscriptionService

router = APIRouter(prefix="/subscriptions", tags=["Subscriptions"])


@router.get("", response_model=SubscriptionPage, summary="List subscriptions")
def list_subscriptions(
    current_user: CurrentUser,
    db: DatabaseSession,
    status_filter: Annotated[str | None, Query(alias="status")] = None,
    days: Annotated[int | None, Query(ge=1, le=365)] = None,
    search: str | None = None,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> SubscriptionPage:
    items, total = SubscriptionService(db).list(
        current_user,
        status=status_filter,
        days=days,
        search=search,
        limit=limit,
        offset=offset,
    )
    return SubscriptionPage(
        items=[SubscriptionRead.model_validate(item) for item in items],
        total=total,
        limit=limit,
        offset=offset,
    )


@router.post(
    "",
    response_model=SubscriptionRead,
    status_code=status.HTTP_201_CREATED,
    summary="Create a subscription",
)
def create_subscription(
    payload: SubscriptionCreate,
    current_user: CurrentUser,
    db: DatabaseSession,
) -> SubscriptionRead:
    subscription = SubscriptionService(db).create(current_user, payload)
    return SubscriptionRead.model_validate(subscription)


@router.get(
    "/{subscription_id}",
    response_model=SubscriptionRead,
    summary="Get one subscription",
)
def get_subscription(
    subscription_id: uuid.UUID,
    current_user: CurrentUser,
    db: DatabaseSession,
) -> SubscriptionRead:
    subscription = SubscriptionService(db).get(current_user, subscription_id)
    return SubscriptionRead.model_validate(subscription)


@router.patch(
    "/{subscription_id}",
    response_model=SubscriptionRead,
    summary="Update, pause or resume a subscription",
)
def update_subscription(
    subscription_id: uuid.UUID,
    payload: SubscriptionUpdate,
    current_user: CurrentUser,
    db: DatabaseSession,
) -> SubscriptionRead:
    subscription = SubscriptionService(db).update(
        current_user, subscription_id, payload
    )
    return SubscriptionRead.model_validate(subscription)


@router.delete(
    "/{subscription_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a subscription and its payment history",
)
def delete_subscription(
    subscription_id: uuid.UUID,
    current_user: CurrentUser,
    db: DatabaseSession,
) -> Response:
    SubscriptionService(db).delete(current_user, subscription_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post(
    "/{subscription_id}/pay",
    response_model=SubscriptionRead,
    summary="Record a subscription payment and advance the billing date",
)
def pay_subscription(
    subscription_id: uuid.UUID,
    payload: PaymentCreate,
    current_user: CurrentUser,
    db: DatabaseSession,
) -> SubscriptionRead:
    subscription = SubscriptionService(db).pay(
        current_user, subscription_id, payload
    )
    return SubscriptionRead.model_validate(subscription)


@router.get(
    "/{subscription_id}/payments",
    response_model=list[PaymentRead],
    summary="List a subscription's payment history",
)
def list_subscription_payments(
    subscription_id: uuid.UUID,
    current_user: CurrentUser,
    db: DatabaseSession,
) -> list[PaymentRead]:
    payments = SubscriptionService(db).list_payments(
        current_user, subscription_id
    )
    return [PaymentRead.model_validate(payment) for payment in payments]
