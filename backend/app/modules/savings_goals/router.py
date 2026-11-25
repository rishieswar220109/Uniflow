"""Savings goal API routes."""

import uuid
from typing import Annotated

from fastapi import APIRouter, Query, status

from app.api.deps import CurrentUser, DatabaseSession
from app.schemas.savings_goals import (
    SavingsGoalCreate,
    SavingsGoalPage,
    SavingsGoalRead,
    SavingsGoalUpdate,
)
from app.services.savings_goal_service import SavingsGoalService

router = APIRouter(prefix="/savings-goals", tags=["Savings Goals"])


@router.get("", response_model=SavingsGoalPage, summary="List savings goals")
def list_savings_goals(
    current_user: CurrentUser,
    db: DatabaseSession,
    is_active: Annotated[bool | None, Query()] = None,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> SavingsGoalPage:
    service = SavingsGoalService(db)
    items, total = service.list(
        current_user, is_active=is_active, limit=limit, offset=offset
    )
    return SavingsGoalPage(
        items=[SavingsGoalRead.model_validate(item) for item in items],
        total=total,
        limit=limit,
        offset=offset,
    )


@router.get("/summary", summary="Savings goals summary")
def savings_goals_summary(
    current_user: CurrentUser, db: DatabaseSession
) -> dict:
    return SavingsGoalService(db).summary(current_user)


@router.post(
    "", response_model=SavingsGoalRead, status_code=status.HTTP_201_CREATED
)
def create_savings_goal(
    payload: SavingsGoalCreate,
    current_user: CurrentUser,
    db: DatabaseSession,
) -> SavingsGoalRead:
    goal = SavingsGoalService(db).create(current_user, payload)
    return SavingsGoalRead.model_validate(goal)


@router.get("/{goal_id}", response_model=SavingsGoalRead, summary="Get one savings goal")
def get_savings_goal(
    goal_id: uuid.UUID,
    current_user: CurrentUser,
    db: DatabaseSession,
) -> SavingsGoalRead:
    goal = SavingsGoalService(db).get(current_user, goal_id)
    return SavingsGoalRead.model_validate(goal)


@router.patch("/{goal_id}", response_model=SavingsGoalRead, summary="Update a savings goal")
def update_savings_goal(
    goal_id: uuid.UUID,
    payload: SavingsGoalUpdate,
    current_user: CurrentUser,
    db: DatabaseSession,
) -> SavingsGoalRead:
    goal = SavingsGoalService(db).update(current_user, goal_id, payload)
    return SavingsGoalRead.model_validate(goal)


@router.delete(
    "/{goal_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a savings goal",
)
def delete_savings_goal(
    goal_id: uuid.UUID,
    current_user: CurrentUser,
    db: DatabaseSession,
) -> None:
    SavingsGoalService(db).delete(current_user, goal_id)
