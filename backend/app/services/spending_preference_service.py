"""Spending preference service for proactive awareness and reminders."""

from __future__ import annotations

import uuid
from decimal import Decimal

from sqlalchemy.orm import Session

from app.core.exceptions import NotFoundError
from app.models.financial import SpendingPreference
from app.repositories.spending_preference_repository import (
    SpendingPreferenceRepository,
)
from app.schemas.spending_preferences import SpendingPreferencesUpdate


class SpendingPreferenceService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.repo = SpendingPreferenceRepository(db)

    def get_or_create(self, user) -> SpendingPreference:
        return self.repo.upsert_for_user(user.id)

    def get(self, user) -> SpendingPreference:
        preference = self.repo.get_by_user(user.id)
        if preference is None:
            raise NotFoundError("Spending preferences not found")
        return preference

    def find(self, user) -> SpendingPreference | None:
        """Return stored preferences, or ``None`` when defaults apply.

        Read paths use this so they never create rows as a side effect.
        """
        return self.repo.get_by_user(user.id)

    def update(self, user, payload: SpendingPreferencesUpdate) -> SpendingPreference:
        preference = self.get_or_create(user)
        data = payload.model_dump(exclude_unset=True)

        if "proactive_awareness_enabled" in data:
            preference.proactive_awareness_enabled = data[
                "proactive_awareness_enabled"
            ]
        if "significant_spending_threshold" in data:
            preference.significant_spending_threshold = Decimal(
                str(data["significant_spending_threshold"])
            ).quantize(Decimal("0.01"))
        if "reminder_advance_days" in data:
            preference.reminder_advance_days = data["reminder_advance_days"]
        if "enable_due_reminders" in data:
            preference.enable_due_reminders = data["enable_due_reminders"]
        if "enable_post_payment_reminders" in data:
            preference.enable_post_payment_reminders = data[
                "enable_post_payment_reminders"
            ]
        if "enable_entertainment_alerts" in data:
            preference.enable_entertainment_alerts = data[
                "enable_entertainment_alerts"
            ]
        if "entertainment_categories" in data:
            preference.entertainment_categories = data["entertainment_categories"]
        if "reminder_frequency" in data:
            preference.reminder_frequency = data["reminder_frequency"]
        if "currency" in data:
            preference.currency = data["currency"].upper()

        self.db.commit()
        self.db.refresh(preference)
        return preference
