"""Logging configuration.

Request bodies and credentials must never be logged. Handlers here only emit
method, path, status code and duration.
"""

import logging
import sys

from app.core.config import settings


def configure_logging() -> None:
    level = logging.DEBUG if settings.debug else logging.INFO
    logging.basicConfig(
        level=level,
        format="%(asctime)s %(levelname)s %(name)s %(message)s",
        stream=sys.stdout,
        force=True,
    )
    # SQLAlchemy echoes statements only when explicitly enabled; this logger
    # would otherwise include parameter values in logs.
    logging.getLogger("sqlalchemy.engine").setLevel(
        logging.INFO if settings.database_echo else logging.WARNING
    )
    logging.getLogger("uvicorn.access").setLevel(logging.INFO)
