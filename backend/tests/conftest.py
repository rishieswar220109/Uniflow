"""Test configuration.

Tests never touch a development or personal database. By default an isolated
in-memory SQLite database is used. Set ``TEST_DATABASE_URL`` to exercise the
real PostgreSQL dialect; that database name must end with ``_test``.
"""

import os
import tempfile
from collections.abc import Generator
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.engine import make_url
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

os.environ["ENVIRONMENT"] = "test"
os.environ.setdefault(
    "JWT_SECRET_KEY", "test-only-secret-key-with-at-least-32-chars"
)

_test_database_url = os.environ.get("TEST_DATABASE_URL")
if _test_database_url:
    database_name = make_url(_test_database_url).database or ""
    if not database_name.endswith("_test"):
        raise RuntimeError(
            "TEST_DATABASE_URL must point to a database whose name ends with "
            "'_test'. Refusing to run destructive tests against "
            f"'{database_name}'."
        )
    os.environ["DATABASE_URL"] = _test_database_url
else:
    sqlite_path = Path(tempfile.gettempdir()) / "guardian_phase1_test.sqlite3"
    if sqlite_path.exists():
        sqlite_path.unlink()
    os.environ["DATABASE_URL"] = f"sqlite+pysqlite:///{sqlite_path.as_posix()}"

from app.core.database import Base, get_db  # noqa: E402
from app.core.rate_limit import auth_rate_limiter  # noqa: E402
from app.main import app  # noqa: E402
from app import models as _models  # noqa: E402,F401

DATABASE_URL = os.environ["DATABASE_URL"]

if DATABASE_URL.startswith("sqlite"):
    engine = create_engine(
        DATABASE_URL,
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
else:
    engine = create_engine(DATABASE_URL, pool_pre_ping=True)

TestingSessionLocal = sessionmaker(
    bind=engine, autoflush=False, autocommit=False, expire_on_commit=False
)


@pytest.fixture(autouse=True)
def _database_schema() -> Generator[None, None, None]:
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture(autouse=True)
def _reset_rate_limiter() -> Generator[None, None, None]:
    """Keep per-IP auth buckets from leaking between tests."""

    auth_rate_limiter.reset()
    yield
    auth_rate_limiter.reset()


@pytest.fixture
def db() -> Generator[Session, None, None]:
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture
def client(db: Session) -> Generator[TestClient, None, None]:
    def override_get_db() -> Generator[Session, None, None]:
        yield db

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture
def registered_user(client: TestClient) -> dict:
    response = client.post(
        "/api/v1/auth/register",
        json={
            "full_name": "Asha Verma",
            "email": "asha@example.com",
            "password": "Guardian123",
        },
    )
    assert response.status_code == 201, response.text
    return response.json()


@pytest.fixture
def auth_headers(registered_user: dict) -> dict[str, str]:
    return {"Authorization": f"Bearer {registered_user['access_token']}"}
