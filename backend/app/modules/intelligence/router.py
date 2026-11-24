"""Financial intelligence API routes: analysis, forecasts, risks, insights."""

import uuid
from datetime import date
from typing import Annotated

from fastapi import APIRouter, Query, status

from app.api.deps import CurrentUser, DatabaseSession
from app.core.exceptions import BadRequestError
from app.schemas.financial_insights import FinancialInsightPage, FinancialInsightRead
from app.schemas.intelligence import ProactiveAwarenessRequest
from app.services.financial_insight_service import FinancialInsightService
from app.services.intelligence_service import IntelligenceService

router = APIRouter(prefix="/intelligence", tags=["Financial Intelligence"])


@router.get("/summary", summary="Monthly income/expense summary")
def monthly_summary(
    current_user: CurrentUser,
    db: DatabaseSession,
    year: Annotated[int, Query(ge=2000, le=2100)] = date.today().year,
    month: Annotated[int, Query(ge=1, le=12)] = date.today().month,
) -> dict:
    return IntelligenceService(db).monthly_summary(current_user, year, month)


@router.get("/trends", summary="Spending trends over a lookback window")
def spending_trends(
    current_user: CurrentUser,
    db: DatabaseSession,
    lookback_days: Annotated[int, Query(ge=30, le=730)] = 90,
) -> dict:
    return IntelligenceService(db).spending_trends(current_user, lookback_days)


@router.get("/forecast", summary="Cash-flow forecast")
def cash_flow_forecast(
    current_user: CurrentUser,
    db: DatabaseSession,
    days: Annotated[int, Query(ge=1, le=365)] = 30,
) -> dict:
    return IntelligenceService(db).forecast(current_user, days)


@router.get("/reports", summary="Monthly financial report")
def financial_report(
    current_user: CurrentUser,
    db: DatabaseSession,
    year: Annotated[int, Query(ge=2000, le=2100)] = date.today().year,
    month: Annotated[int, Query(ge=1, le=12)] = date.today().month,
) -> dict:
    return IntelligenceService(db).reports(current_user, year, month)


@router.get("/risks", summary="Detected financial risks")
def detect_risks(
    current_user: CurrentUser, db: DatabaseSession
) -> list[dict]:
    return IntelligenceService(db).detect_risks(current_user)


@router.post(
    "/insights",
    response_model=list[FinancialInsightRead],
    status_code=status.HTTP_201_CREATED,
    summary="Generate and persist risk insights",
)
def generate_insights(
    current_user: CurrentUser, db: DatabaseSession
) -> list[FinancialInsightRead]:
    insights = IntelligenceService(db).generate_insights(current_user)
    return [FinancialInsightRead.model_validate(item) for item in insights]


@router.get(
    "/insights", response_model=FinancialInsightPage, summary="List financial insights"
)
def list_insights(
    current_user: CurrentUser,
    db: DatabaseSession,
    insight_type: Annotated[str | None, Query()] = None,
    severity: Annotated[str | None, Query()] = None,
    is_dismissed: Annotated[bool | None, Query()] = None,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> FinancialInsightPage:
    service = FinancialInsightService(db)
    items, total = service.list(
        current_user,
        insight_type=insight_type,
        severity=severity,
        is_dismissed=is_dismissed,
        limit=limit,
        offset=offset,
    )
    return FinancialInsightPage(
        items=[FinancialInsightRead.model_validate(item) for item in items],
        total=total,
        limit=limit,
        offset=offset,
    )


@router.patch(
    "/insights/{insight_id}/dismiss",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Dismiss a financial insight",
)
def dismiss_insight(
    insight_id: uuid.UUID,
    current_user: CurrentUser,
    db: DatabaseSession,
) -> None:
    FinancialInsightService(db).dismiss(current_user, insight_id)


@router.post(
    "/proactive-awareness",
    summary="Check proactive spending awareness before a transaction",
)
def proactive_awareness(
    current_user: CurrentUser,
    db: DatabaseSession,
    payload: ProactiveAwarenessRequest,
) -> dict | None:
    if payload.transaction_amount is None:
        raise BadRequestError("transaction_amount is required")
    return IntelligenceService(db).proactive_awareness(
        current_user,
        payload.transaction_amount,
        payload.transaction_category,
    )
