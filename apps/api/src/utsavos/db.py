"""Database engine, session lifecycle, and declarative base."""

from __future__ import annotations

from collections.abc import Iterator
from pathlib import Path
from typing import Any

from alembic.script import ScriptDirectory
from sqlalchemy import create_engine, text
from sqlalchemy.engine import Engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from .config import Settings, get_settings

_ALEMBIC_VERSIONS = Path(__file__).resolve().parents[2] / "alembic" / "versions"
_MIGRATION_HEAD = "0002_idempotency"  # installed-package fallback; synced with alembic by tests

_engine: Engine | None = None
_session_factory: sessionmaker[Session] | None = None


class Base(DeclarativeBase):
    pass


def _connect_args(settings: Settings) -> dict[str, Any]:
    # Bounded waits on every pooled connection: pool acquisition is capped by
    # pool_timeout, and the server cancels stuck statements and lock waits so
    # requests fail predictably instead of hanging indefinitely.
    options = (
        f"-c statement_timeout={settings.db_statement_timeout_ms} "
        f"-c lock_timeout={settings.db_lock_timeout_ms}"
    )
    return {"connect_timeout": 5, "options": options}


def get_engine() -> Engine:
    global _engine
    if _engine is None:
        settings = get_settings()
        _engine = create_engine(
            settings.database_url,
            pool_pre_ping=True,
            pool_size=settings.db_pool_size,
            max_overflow=settings.db_pool_max_overflow,
            pool_timeout=settings.db_pool_timeout_seconds,
            pool_recycle=1800,
            connect_args=_connect_args(settings),
        )
    return _engine


def get_session_factory() -> sessionmaker[Session]:
    global _session_factory
    if _session_factory is None:
        _session_factory = sessionmaker(bind=get_engine(), expire_on_commit=False, autoflush=False)
    return _session_factory


def reset_engine() -> None:
    """Drop cached engine/factory (tests and configuration reloads)."""
    global _engine, _session_factory
    if _engine is not None:
        _engine.dispose()
    _engine = None
    _session_factory = None


def get_db() -> Iterator[Session]:
    with get_session_factory()() as session:
        yield session


def expected_migration_head() -> str | None:
    """Head revision from the alembic versions directory, None if unreadable."""
    versions = str(_ALEMBIC_VERSIONS)
    try:
        script = ScriptDirectory(versions, version_locations=[versions])
        return script.get_current_head()
    except Exception:  # noqa: BLE001 - readiness must degrade to the constant
        return _MIGRATION_HEAD


def check_database() -> tuple[bool, str | None]:
    """Readiness: connectivity, expected schema and current migrations.

    Reasons are fixed, non-sensitive strings; never echo SQL, hosts or versions.
    """
    from . import models  # noqa: F401 - register tables on Base.metadata

    try:
        with get_engine().connect() as conn:
            conn.execute(text("SELECT 1"))
            present = {
                row[0]
                for row in conn.execute(
                    text("SELECT tablename FROM pg_tables WHERE schemaname = 'public'")
                )
            }
            head = expected_migration_head()
            if not head:
                return False, "readiness configuration error"
            if "alembic_version" not in present:
                return False, "schema not migrated"
            version = conn.execute(
                text("SELECT version_num FROM alembic_version")
            ).scalar_one_or_none()
            if version != head:
                return False, "migrations out of date"
            if set(Base.metadata.tables) - present:
                return False, "schema not migrated"
            if get_settings().is_production:
                ssl_on = conn.execute(
                    text("SELECT ssl FROM pg_stat_ssl WHERE pid = pg_backend_pid()")
                ).scalar()
                if ssl_on is not True:
                    return False, "database TLS not verified"
        return True, None
    except Exception as exc:  # pragma: no cover - depends on environment
        return False, type(exc).__name__
