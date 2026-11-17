"""Model package.

Importing this module registers every model on ``Base.metadata`` for Alembic
and test schema creation.
"""

from app.models.user import AuthSession, User, UserPreferences

__all__ = ["AuthSession", "User", "UserPreferences"]
