"""P2-12: bounded pool acquisition, server-side statement/lock timeouts.

The behavior tests run against real PostgreSQL with the same psycopg connect
options the application engine uses, so a stalled statement or lock fails fast
instead of hanging the request.
"""

from __future__ import annotations

import time

import pytest
from sqlalchemy import create_engine, text
from sqlalchemy.exc import DBAPIError
from sqlalchemy.exc import TimeoutError as SQLAlchemyTimeoutError

from utsavos.config import get_settings
from utsavos.db import _connect_args


def _probe_engine(timeout_ms: int, pool_size: int = 1):
    """An engine like the app's, but tiny, disposable, and with the given timeout."""
    settings = get_settings()
    options = f"-c statement_timeout={timeout_ms} -c lock_timeout={timeout_ms}"
    engine = create_engine(
        settings.database_url,
        pool_size=pool_size,
        max_overflow=0,
        pool_timeout=0.3,
        connect_args={"connect_timeout": 5, "options": options},
    )
    return engine


def test_connect_args_carry_statement_and_lock_timeouts() -> None:
    settings = get_settings()
    args = _connect_args(settings)
    options = args["options"]
    assert f"statement_timeout={settings.db_statement_timeout_ms}" in options
    assert f"lock_timeout={settings.db_lock_timeout_ms}" in options
    assert args["connect_timeout"] == 5


def test_pool_acquisition_is_bounded() -> None:
    engine = _probe_engine(5_000)
    try:
        held = engine.connect()
        try:
            start = time.monotonic()
            with pytest.raises(SQLAlchemyTimeoutError):
                engine.connect()
            elapsed = time.monotonic() - start
            # bounded by pool_timeout (0.3s here) rather than hanging
            assert elapsed < 2.0
        finally:
            held.close()
    finally:
        engine.dispose()


def test_statement_timeout_cancels_long_queries() -> None:
    engine = _probe_engine(200)
    try:
        with engine.connect() as conn:
            start = time.monotonic()
            with pytest.raises(DBAPIError):
                conn.execute(text("SELECT pg_sleep(1)"))
            assert time.monotonic() - start < 0.9
    finally:
        engine.dispose()


def test_lock_timeout_cancels_blocked_lock_waits() -> None:
    engine = _probe_engine(200, pool_size=2)  # two pooled connections, no overflow
    try:
        with engine.begin() as first:
            first.execute(text("SELECT pg_advisory_lock(424242)"))
            with engine.connect() as second:
                start = time.monotonic()
                with pytest.raises(DBAPIError):
                    second.execute(text("SELECT pg_advisory_lock(424242)"))
                assert time.monotonic() - start < 0.9
            first.execute(text("SELECT pg_advisory_unlock(424242)"))
    finally:
        engine.dispose()


def test_pool_timeout_returns_controlled_503_without_internals(
    client, monkeypatch
) -> None:
    import utsavos.db as db_module

    def exhausted():
        raise SQLAlchemyTimeoutError(
            "QueuePool limit of size 5 overflow 10 reached, connection timed out"
        )

    monkeypatch.setattr(db_module, "get_session_factory", exhausted)
    response = client.get("/api/v1/auth/me")
    assert response.status_code == 503
    body = response.json()["error"]
    assert body["code"] == "service_unavailable"
    assert body["message"] == "The service is busy. Try again shortly."
    assert "QueuePool" not in response.text and "sqlalchemy" not in response.text.lower()
