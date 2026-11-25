"""Data access for users and their preferences."""

import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.models.user import User, UserPreferences


class UserRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def get_by_id(self, user_id: uuid.UUID) -> User | None:
        return self.db.get(User, user_id, options=[selectinload(User.preferences)])

    def get_by_id_for_update(self, user_id: uuid.UUID) -> User | None:
        """Load a user while holding a row lock.

        ``populate_existing`` refreshes attributes already present in the
        identity map, so a caller that waited on the lock observes the status
        committed by the transaction that held it.
        """

        statement = (
            select(User)
            .where(User.id == user_id)
            .execution_options(populate_existing=True)
            .with_for_update()
        )
        return self.db.execute(statement).scalar_one_or_none()

    def get_by_email(self, email: str) -> User | None:
        statement = (
            select(User)
            .where(User.email == email.lower())
            .options(selectinload(User.preferences))
        )
        return self.db.execute(statement).scalar_one_or_none()

    def create(
        self, *, full_name: str, email: str, hashed_password: str
    ) -> User:
        user = User(
            full_name=full_name,
            email=email.lower(),
            hashed_password=hashed_password,
            preferences=UserPreferences(),
        )
        self.db.add(user)
        self.db.flush()
        return user

    def update_name(self, user: User, full_name: str) -> User:
        user.full_name = full_name
        self.db.add(user)
        self.db.flush()
        return user

    def save(self) -> None:
        self.db.commit()
