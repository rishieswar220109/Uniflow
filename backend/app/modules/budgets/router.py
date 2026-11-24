"""Budget API routes."""

import uuid
from datetime import date
from typing import Annotated

from fastapi import APIRouter, Query, status

from app.api.deps import CurrentUser, DatabaseSession
from app.schemas.budgets import (
    BudgetCreate,
    BudgetPage,
    BudgetRead,
    BudgetSpendingRead,
    BudgetUpdate,
)
from app.services.budget_service import BudgetService

router = APIRouter(prefix="/budgets", tags=["Budgets"])


@router.get(
    "", response_model=BudgetPage, summary="List budgets with optional spending"
)
def list_budgets(
    current_user: CurrentUser,
    db: DatabaseSession,
    is_active: Annotated[bool | None, Query()] = None,
    category_id: Annotated[uuid.UUID | None, Query()] = None,
    include_spending: Annotated[bool, Query()] = False,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> BudgetPage:
    service = BudgetService(db)
    items, total = service.list(
        current_user,
        is_active=is_active,
        category_id=category_id,
        limit=limit,
        offset=offset,
    )
    reads = [BudgetRead.model_validate(item) for item in items]
    if include_spending:
        spending_reads: list[BudgetSpendingRead] = []
        for item, read in zip(items, reads):
            summary = service.spending_summary(current_user, item)
            spending_reads.append(
                BudgetSpendingRead(
                    **{k: read.model_dump().get(k) for k in read.model_fields},
                    spent=summary["spent"],
                    remaining=summary["remaining"],
                    overspending=summary["overspending"],
                    percent_used=summary["percent_used"],
                )
            )
        return BudgetPage(items=spending_reads, total=total, limit=limit, offset=offset)
    return BudgetPage(items=reads, total=total, limit=limit, offset=offset)


@router.post(
    "", response_model=BudgetRead, status_code=status.HTTP_201_CREATED
)
def create_budget(
    payload: BudgetCreate,
    current_user: CurrentUser,
    db: DatabaseSession,
) -> BudgetRead:
    budget = BudgetService(db).create(current_user, payload)
    return BudgetRead.model_validate(budget)


@router.get("/{budget_id}", response_model=BudgetRead, summary="Get one budget")
def get_budget(
    budget_id: uuid.UUID,
    current_user: CurrentUser,
    db: DatabaseSession,
) -> BudgetRead:
    budget = BudgetService(db).get(current_user, budget_id)
    return BudgetRead.model_validate(budget)


@router.patch("/{budget_id}", response_model=BudgetRead, summary="Update a budget")
def update_budget(
    budget_id: uuid.UUID,
    payload: BudgetUpdate,
    current_user: CurrentUser,
    db: DatabaseSession,
) -> BudgetRead:
    budget = BudgetService(db).update(current_user, budget_id, payload)
    return BudgetRead.model_validate(budget)


@router.delete(
    "/{budget_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Delete a budget"
)
def delete_budget(
    budget_id: uuid.UUID,
    current_user: CurrentUser,
    db: DatabaseSession,
) -> None:
    BudgetService(db).delete(current_user, budget_id)


@router.get(
    "/{budget_id}/spending",
    response_model=BudgetSpendingRead,
    summary="Get budget spending summary",
)
def budget_spending(
    budget_id: uuid.UUID,
    current_user: CurrentUser,
    db: DatabaseSession,
) -> BudgetSpendingRead:
    service = BudgetService(db)
    budget = service.get(current_user, budget_id)
    summary = service.spending_summary(current_user, budget)
    return BudgetSpendingRead(
        **{
            k: summary[k]
            for k in (
                "budget_id",
                "name",
                "period",
                "amount",
                "currency",
                "spent",
                "remaining",
                "alert_threshold",
                "overspending",
                "percent_used",
                "category_id",
            )
        }
    )
