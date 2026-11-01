"""Test bootstrap: real PostgreSQL, real app, no SQLite substitution."""

from __future__ import annotations

import os
import uuid

from sqlalchemy import text

os.environ["APP_ENV"] = "test"
os.environ["DATABASE_URL"] = (
    "postgresql+psycopg://utsavos:utsavos_dev@127.0.0.1:5432/utsavos_test"
)
TEST_SECRET = "test-secret-key-that-is-long-enough-123456"  # noqa: S105 - test only
os.environ["APP_SECRET_KEY"] = TEST_SECRET
os.environ["AI_LOCAL_ENABLED"] = "false"
os.environ["CLOUD_AI_ENABLED"] = "false"
os.environ["GEMINI_API_KEY"] = ""

import psycopg  # noqa: E402
import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

ADMIN_DSN = "postgresql://utsavos:utsavos_dev@127.0.0.1:5432/postgres"
TEST_DB = "utsavos_test"
TEST_DSN = "postgresql://utsavos:utsavos_dev@127.0.0.1:5432/utsavos_test"


def ensure_database(name: str) -> None:
    if not name.replace("_", "").isalnum():
        raise ValueError("database name must be a simple identifier")
    with psycopg.connect(ADMIN_DSN, autocommit=True) as conn:
        exists = conn.execute(
            "SELECT 1 FROM pg_database WHERE datname = %s", (name,)
        ).fetchone()
        if not exists:
            conn.execute(f'CREATE DATABASE "{name}"')  # noqa: S608 - sanitised above


_ALEMBIC_DDL = (
    "CREATE TABLE IF NOT EXISTS alembic_version "
    "(version_num VARCHAR(32) NOT NULL, "
    "CONSTRAINT alembic_version_pkc PRIMARY KEY (version_num))"
)


@pytest.fixture(scope="session", autouse=True)
def database() -> None:
    ensure_database(TEST_DB)
    from utsavos import models  # noqa: F401  (register tables)
    from utsavos.db import Base, expected_migration_head, get_engine

    engine = get_engine()
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    # mark the test schema as migrated; readyz verifies this
    with engine.begin() as conn:
        conn.execute(text(_ALEMBIC_DDL))
        conn.execute(text("DELETE FROM alembic_version"))
        conn.execute(
            text("INSERT INTO alembic_version (version_num) VALUES (:head)"),
            {"head": expected_migration_head()},
        )
    yield
    Base.metadata.drop_all(engine)


@pytest.fixture(autouse=True)
def reset_rate_limits() -> None:
    from utsavos.api.auth import login_account_limiter, login_ip_limiter, signup_limiter
    from utsavos.api.demo import _limiter

    login_ip_limiter.reset()
    login_account_limiter.reset()
    signup_limiter.reset()
    _limiter.reset()


@pytest.fixture
def client():
    from utsavos.main import app

    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture
def owner(client):
    from tests.support import signup

    email = f"owner-{uuid.uuid4().hex[:12]}@example.com"
    return {"email": email, "user": signup(client, email)}
