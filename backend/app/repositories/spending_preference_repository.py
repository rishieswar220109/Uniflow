"""Data access for spending preferences."""

from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.financial import SpendingPreference


class SpendingPreferenceRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def get_by_user(self, user_id: uuid.UUID) -> SpendingPreference | None:
        statement = select(SpendingPreference).where(
            SpendingPreference.user_id == user_id
        )
        return self.db.execute(statement).scalar_one_or_none()

    def add(self, preference: SpendingPreference) -> SpendingPreference:
        self.db.add(preference)
        return preference

    def upsert_for_user(self, user_id: uuid.UUID) -> SpendingPreference:
        """Return the user's preferences, creating defaults if missing."""
        preference = self.get_by_user(user_id)
        if preference is None:
            preference = SpendingPreference(user_id=user_id)
            self.db.add(preference)
            self.db.flush()
        return preference
