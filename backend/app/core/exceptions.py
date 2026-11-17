"""Centralised application exceptions and FastAPI error handlers."""

import logging
from typing import Any

from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

logger = logging.getLogger(__name__)


class AppError(Exception):
    """Base class for expected, client-safe application errors."""

    status_code: int = status.HTTP_400_BAD_REQUEST
    code: str = "bad_request"

    def __init__(self, message: str, *, code: str | None = None) -> None:
        super().__init__(message)
        self.message = message
        if code:
            self.code = code


class BadRequestError(AppError):
    status_code = status.HTTP_400_BAD_REQUEST
    code = "bad_request"


class UnauthorizedError(AppError):
    status_code = status.HTTP_401_UNAUTHORIZED
    code = "unauthorized"

    def __init__(self, message: str = "Authentication required") -> None:
        super().__init__(message)

    @property
    def headers(self) -> dict[str, str]:
        return {"WWW-Authenticate": "Bearer"}


class ForbiddenError(AppError):
    status_code = status.HTTP_403_FORBIDDEN
    code = "forbidden"


class NotFoundError(AppError):
    status_code = status.HTTP_404_NOT_FOUND
    code = "not_found"


class ConflictError(AppError):
    status_code = status.HTTP_409_CONFLICT
    code = "conflict"


class RateLimitError(AppError):
    status_code = status.HTTP_429_TOO_MANY_REQUESTS
    code = "rate_limited"


def _error_response(
    status_code: int,
    message: str,
    *,
    code: str,
    headers: dict[str, str] | None = None,
) -> JSONResponse:
    return JSONResponse(
        status_code=status_code,
        content={"detail": message, "code": code},
        headers=headers,
    )


def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppError)
    async def handle_app_error(_: Request, exc: AppError) -> JSONResponse:
        headers = getattr(exc, "headers", None)
        return _error_response(
            exc.status_code, exc.message, code=exc.code, headers=headers
        )

    @app.exception_handler(RequestValidationError)
    async def handle_validation_error(
        _: Request, exc: RequestValidationError
    ) -> JSONResponse:
        # Never echo submitted values (a password may appear in ``input``).
        safe_errors: list[dict[str, Any]] = [
            {
                "loc": list(error.get("loc", [])),
                "msg": error.get("msg", "Invalid value"),
                "type": error.get("type", "value_error"),
            }
            for error in exc.errors()
        ]
        first = safe_errors[0]["msg"] if safe_errors else "Invalid request"
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            content={"detail": first, "code": "validation_error", "errors": safe_errors},
        )

    @app.exception_handler(Exception)
    async def handle_unexpected_error(request: Request, exc: Exception) -> JSONResponse:
        logger.exception(
            "Unhandled error on %s %s", request.method, request.url.path
        )
        return _error_response(
            status.HTTP_500_INTERNAL_SERVER_ERROR,
            "An unexpected error occurred. Please try again later.",
            code="internal_error",
        )
