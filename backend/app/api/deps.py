"""Shared FastAPI dependencies for authentication."""

import uuid
from typing import Annotated

import jwt
from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.exceptions import ForbiddenError, UnauthorizedError
from app.core.security import decode_access_token
from app.models.user import User
from app.repositories.auth_session_repository import AuthSessionRepository

bearer_scheme = HTTPBearer(auto_error=False)


def get_current_user(
    credentials: Annotated[
        HTTPAuthorizationCredentials | None, Depends(bearer_scheme)
    ],
    db: Annotated[Session, Depends(get_db)],
) -> User:
    """Validate the bearer token and its backing server-side session."""

    if credentials is None or credentials.scheme.lower() != "bearer":
        raise UnauthorizedError()

    try:
        payload = decode_access_token(credentials.credentials)
    except jwt.ExpiredSignatureError as exc:
        raise UnauthorizedError("Session has expired") from exc
    except jwt.InvalidTokenError as exc:
        raise UnauthorizedError("Invalid authentication token") from exc

    try:
        user_id = uuid.UUID(payload["sub"])
        session_id = uuid.UUID(payload["sid"])
    except (KeyError, ValueError) as exc:
        raise UnauthorizedError("Invalid authentication token") from exc

    session = AuthSessionRepository(db).get_by_id(session_id)
    if session is None or session.user_id != user_id:
        raise UnauthorizedError("Session is no longer valid")
    if session.revoked_at is not None:
        raise UnauthorizedError("Session is no longer valid")
    if not session.is_active:
        raise UnauthorizedError("Session has expired")

    user = session.user
    if user.id != user_id:
        raise UnauthorizedError("Session is no longer valid")
    if not user.is_active:
        raise ForbiddenError("This account has been disabled")
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]
DatabaseSession = Annotated[Session, Depends(get_db)]
