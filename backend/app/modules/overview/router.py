"""Unified financial overview API routes."""

from typing import Annotated

from fastapi import APIRouter, Query

from app.api.deps import CurrentUser, DatabaseSession
from app.schemas.overview import (
    RecurringSuggestionRead,
    SummaryRead,
    UpcomingPaymentRead,
)
from app.services.recurring_service import RecurringPaymentService
from app.services.summary_service import SummaryService

router = APIRouter(tags=["Overview"])


@router.get(
    "/summary",
    response_model=SummaryRead,
    summary="Financial summary for the unified dashboard",
)
def get_summary(
    current_user: CurrentUser,
    db: DatabaseSession,
    days: Annotated[int, Query(ge=1, le=365)] = 30,
) -> SummaryRead:
    return SummaryService(db).summary(current_user, days=days)


@router.get(
    "/upcoming",
    response_model=list[UpcomingPaymentRead],
    summary="Bills and subscriptions due within a window",
)
def get_upcoming(
    current_user: CurrentUser,
    db: DatabaseSession,
    days: Annotated[int, Query(ge=1, le=365)] = 30,
) -> list[UpcomingPaymentRead]:
    return SummaryService(db).upcoming(current_user, days=days)


@router.get(
    "/recurring-payments",
    response_model=list[RecurringSuggestionRead],
    summary="Detect likely recurring payments from transaction history",
)
def get_recurring_payments(
    current_user: CurrentUser,
    db: DatabaseSession,
    lookback_days: Annotated[int, Query(ge=30, le=730)] = 180,
    min_occurrences: Annotated[int, Query(ge=2, le=12)] = 2,
) -> list[RecurringSuggestionRead]:
    return RecurringPaymentService(db).detect(
        current_user,
        lookback_days=lookback_days,
        min_occurrences=min_occurrences,
    )
