"""User profile and preferences API routes."""

from fastapi import APIRouter

from app.api.deps import CurrentUser, DatabaseSession
from app.schemas.user import (
    UserPreferencesRead,
    UserPreferencesUpdate,
    UserRead,
    UserUpdate,
)
from app.services.user_service import UserService

router = APIRouter(prefix="/users", tags=["Users"])


@router.get("/me", response_model=UserRead, summary="Get the current user's profile")
def get_profile(current_user: CurrentUser) -> UserRead:
    return UserRead.model_validate(current_user)


@router.patch(
    "/me", response_model=UserRead, summary="Update the current user's profile"
)
def update_profile(
    payload: UserUpdate,
    current_user: CurrentUser,
    db: DatabaseSession,
) -> UserRead:
    user = UserService(db).update_profile(current_user, payload)
    return UserRead.model_validate(user)


@router.get(
    "/me/preferences",
    response_model=UserPreferencesRead,
    summary="Get the current user's preferences",
)
def get_preferences(current_user: CurrentUser) -> UserPreferencesRead:
    return UserPreferencesRead.model_validate(current_user.preferences)


@router.patch(
    "/me/preferences",
    response_model=UserPreferencesRead,
    summary="Update the current user's preferences",
)
def update_preferences(
    payload: UserPreferencesUpdate,
    current_user: CurrentUser,
    db: DatabaseSession,
) -> UserPreferencesRead:
    user = UserService(db).update_preferences(current_user, payload)
    return UserPreferencesRead.model_validate(user.preferences)
