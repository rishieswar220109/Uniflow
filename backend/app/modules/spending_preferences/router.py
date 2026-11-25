"""Spending preference API routes (proactive awareness & reminders)."""

from fastapi import APIRouter

from app.api.deps import CurrentUser, DatabaseSession
from app.schemas.spending_preferences import (
    SpendingPreferencesRead,
    SpendingPreferencesUpdate,
)
from app.services.spending_preference_service import SpendingPreferenceService

router = APIRouter(prefix="/spending-preferences", tags=["Spending Preferences"])


@router.get("", response_model=SpendingPreferencesRead, summary="Get spending preferences")
def get_spending_preferences(
    current_user: CurrentUser, db: DatabaseSession
) -> SpendingPreferencesRead:
    preference = SpendingPreferenceService(db).get_or_create(current_user)
    return SpendingPreferencesRead.model_validate(preference)


@router.patch(
    "", response_model=SpendingPreferencesRead, summary="Update spending preferences"
)
def update_spending_preferences(
    payload: SpendingPreferencesUpdate,
    current_user: CurrentUser,
    db: DatabaseSession,
) -> SpendingPreferencesRead:
    preference = SpendingPreferenceService(db).update(current_user, payload)
    return SpendingPreferencesRead.model_validate(preference)
