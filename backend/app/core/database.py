"""Database engine, session factory and declarative base."""

from collections.abc import Generator
from datetime import datetime

from sqlalchemy import DateTime, Engine, MetaData, create_engine, func
from sqlalchemy.orm import DeclarativeBase, Mapped, Session, mapped_column, sessionmaker

from app.core.config import settings

# Explicit naming conventions keep Alembic migrations deterministic.
NAMING_CONVENTION = {
    "ix": "ix_%(column_0_label)s",
    "uq": "uq_%(table_name)s_%(column_0_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s",
}


class Base(DeclarativeBase):
    metadata = MetaData(naming_convention=NAMING_CONVENTION)


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )


def build_engine(url: str | None = None, *, echo: bool | None = None) -> Engine:
    return create_engine(
        url or settings.database_url,
        echo=settings.database_echo if echo is None else echo,
        pool_pre_ping=True,
    )


engine: Engine = build_engine()

SessionLocal = sessionmaker(
    bind=engine, autoflush=False, autocommit=False, expire_on_commit=False
)


def get_db() -> Generator[Session, None, None]:
    """FastAPI dependency that yields a database session per request."""

    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def dispose_engine() -> None:
    """Release pooled connections during application shutdown."""

    engine.dispose()
