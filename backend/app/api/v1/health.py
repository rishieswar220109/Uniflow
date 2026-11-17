"""Health check endpoint used by Docker and clients."""

from typing import Literal

from fastapi import APIRouter
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from app.core.config import settings
from app.core.database import SessionLocal

router = APIRouter(tags=["Health"])


class HealthResponse(BaseModel):
    status: Literal["ok", "degraded"]
    database: Literal["ok", "unavailable"]
    version: str
    environment: str


@router.get("/health", response_model=HealthResponse, summary="Service health")
def health() -> HealthResponse | JSONResponse:
    database_status: Literal["ok", "unavailable"] = "ok"
    try:
        with SessionLocal() as db:
            db.execute(text("SELECT 1"))
    except SQLAlchemyError:
        database_status = "unavailable"

    payload = {
        "status": "ok" if database_status == "ok" else "degraded",
        "database": database_status,
        "version": settings.app_version,
        "environment": settings.environment,
    }
    if database_status != "ok":
        return JSONResponse(status_code=503, content=payload)
    return HealthResponse(**payload)
