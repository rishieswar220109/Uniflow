"""Authentication API routes."""

from typing import Annotated

from fastapi import APIRouter, Body, Depends, Request, Response, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.api.deps import CurrentUser, DatabaseSession
from app.core.config import settings
from app.core.exceptions import ForbiddenError, RateLimitError
from app.core.rate_limit import auth_rate_limiter
from app.schemas.auth import (
    LoginRequest,
    LogoutRequest,
    RefreshRequest,
    RegisterRequest,
    TokenResponse,
)
from app.schemas.user import UserRead
from app.services.account_status import lock_user_for_refresh
from app.services.auth_service import AuthService, RequestMetadata, TokenBundle

router = APIRouter(prefix="/auth", tags=["Authentication"])

_optional_bearer = HTTPBearer(auto_error=False)
MOBILE_CLIENT_HEADER = "x-client-platform"


def _request_metadata(request: Request) -> RequestMetadata:
    return RequestMetadata(
        user_agent=(request.headers.get("user-agent") or "")[:255] or None,
        ip_address=request.client.host if request.client else None,
    )


def _is_mobile(request: Request) -> bool:
    return request.headers.get(MOBILE_CLIENT_HEADER, "").lower() == "mobile"


def _enforce_rate_limit(request: Request, action: str) -> None:
    """Limit authentication requests per client address and action.

    The bucket key includes the action so exhausting login attempts does not
    block registration or session refresh.
    """

    if not settings.auth_rate_limit_enabled:
        return
    client = request.client.host if request.client else "unknown"
    retry_after = auth_rate_limiter.check(
        f"{action}:{client}",
        limit=settings.auth_rate_limit_attempts,
        window_seconds=settings.auth_rate_limit_window_seconds,
    )
    if retry_after is not None:
        raise RateLimitError(
            "Too many requests. Please try again later.",
            retry_after=retry_after,
        )


def set_refresh_cookie(response: Response, refresh_token: str) -> None:
    response.set_cookie(
        key=settings.refresh_cookie_name,
        value=refresh_token,
        max_age=settings.refresh_token_expire_seconds,
        httponly=True,
        secure=settings.refresh_cookie_secure,
        samesite=settings.refresh_cookie_samesite,
        path=settings.refresh_cookie_path,
    )


def clear_refresh_cookie(response: Response) -> None:
    response.delete_cookie(
        key=settings.refresh_cookie_name,
        httponly=True,
        secure=settings.refresh_cookie_secure,
        samesite=settings.refresh_cookie_samesite,
        path=settings.refresh_cookie_path,
    )


def _build_token_response(
    bundle: TokenBundle,
    response: Response,
    *,
    include_refresh_token: bool,
) -> TokenResponse:
    set_refresh_cookie(response, bundle.refresh_token)
    return TokenResponse(
        access_token=bundle.access_token,
        expires_in=bundle.expires_in,
        refresh_token=bundle.refresh_token if include_refresh_token else None,
        user=UserRead.model_validate(bundle.user),
    )


@router.post(
    "/register",
    response_model=TokenResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new account",
)
def register(
    payload: RegisterRequest,
    request: Request,
    response: Response,
    db: DatabaseSession,
) -> TokenResponse:
    _enforce_rate_limit(request, "register")
    service = AuthService(db)
    bundle = service.register(payload)
    return _build_token_response(
        bundle,
        response,
        include_refresh_token=_is_mobile(request),
    )


@router.post(
    "/login",
    response_model=TokenResponse,
    status_code=status.HTTP_200_OK,
    summary="Login with email and password",
)
def login(
    payload: LoginRequest,
    request: Request,
    response: Response,
    db: DatabaseSession,
) -> TokenResponse:
    _enforce_rate_limit(request, "login")
    service = AuthService(db)
    bundle = service.login(payload, _request_metadata(request))
    return _build_token_response(
        bundle,
        response,
        include_refresh_token=_is_mobile(request),
    )


@router.post(
    "/refresh",
    response_model=TokenResponse,
    status_code=status.HTTP_200_OK,
    summary="Rotate a refresh token and issue a new access token",
)
def refresh(
    request: Request,
    response: Response,
    db: DatabaseSession,
    payload: Annotated[RefreshRequest | None, Body()] = None,
) -> TokenResponse:
    _enforce_rate_limit(request, "refresh")
    body_token = payload.refresh_token if payload else None
    raw_token = body_token or request.cookies.get(settings.refresh_cookie_name)
    # Take the user-row lock before rotation so a concurrent status change
    # cannot commit a new session behind the disable operation.
    if not lock_user_for_refresh(db, raw_token):
        raise ForbiddenError("This account has been disabled")
    service = AuthService(db)
    bundle = service.refresh(raw_token, _request_metadata(request))
    # Only a body-supplied refresh token is returned to the client. A request
    # authenticated by the HttpOnly cookie must never expose the rotated token,
    # even if the caller spoofs the mobile platform header.
    return _build_token_response(
        bundle,
        response,
        include_refresh_token=body_token is not None,
    )


@router.post(
    "/logout",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Revoke the current session",
)
def logout(
    request: Request,
    db: DatabaseSession,
    credentials: Annotated[
        HTTPAuthorizationCredentials | None, Depends(_optional_bearer)
    ] = None,
    payload: Annotated[LogoutRequest | None, Body()] = None,
) -> Response:
    raw_refresh = (payload.refresh_token if payload else None) or request.cookies.get(
        settings.refresh_cookie_name
    )
    access_token = credentials.credentials if credentials else None
    AuthService(db).logout(
        raw_refresh_token=raw_refresh, access_token=access_token
    )
    response = Response(status_code=status.HTTP_204_NO_CONTENT)
    clear_refresh_cookie(response)
    return response


@router.get(
    "/me",
    response_model=UserRead,
    summary="Get the authenticated user",
)
def read_current_user(current_user: CurrentUser) -> UserRead:
    return UserRead.model_validate(current_user)
