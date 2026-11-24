"""User profile and preferences business logic."""

import uuid

from sqlalchemy.orm import Session

from app.models.user import User
from app.schemas.user import UserPreferencesUpdate, UserUpdate
from app.services.account_status import AccountStatusService


class UserService:
    def __init__(self, db: Session) -> None:
        self.db = db

    def set_active(self, user_id: uuid.UUID, *, is_active: bool) -> User:
        """Change account status through the atomic status service."""

        return AccountStatusService(self.db).set_active(
            user_id, is_active=is_active
        )

    def update_profile(self, user: User, payload: UserUpdate) -> User:
        if payload.full_name is not None:
            user.full_name = payload.full_name
        if payload.preferences is not None:
            self._apply_preferences(user, payload.preferences)
        self.db.add(user)
        self.db.commit()
        self.db.refresh(user)
        return user

    def update_preferences(
        self, user: User, payload: UserPreferencesUpdate
    ) -> User:
        self._apply_preferences(user, payload)
        self.db.add(user)
        self.db.commit()
        self.db.refresh(user)
        return user

    @staticmethod
    def _apply_preferences(user: User, payload: UserPreferencesUpdate) -> None:
        preferences = user.preferences
        for field, value in payload.model_dump(exclude_unset=True).items():
            if value is not None:
                setattr(preferences, field, value)
