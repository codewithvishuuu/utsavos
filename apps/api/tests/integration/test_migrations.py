"""Migrations must work from a truly empty PostgreSQL database."""

from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path

import psycopg

ADMIN_DSN = "postgresql://utsavos:utsavos_dev@127.0.0.1:5432/postgres"
DB_NAME = "utsavos_migrate_test"
DSN = f"postgresql://utsavos:utsavos_dev@127.0.0.1:5432/{DB_NAME}"
API_ROOT = Path(__file__).resolve().parents[2]


def _run_alembic(*args: str) -> subprocess.CompletedProcess[str]:
    env = os.environ.copy()
    env["DATABASE_URL"] = (
        f"postgresql+psycopg://utsavos:utsavos_dev@127.0.0.1:5432/{DB_NAME}"
    )
    env["APP_ENV"] = "test"
    return subprocess.run(  # noqa: S603 - fixed executable, no shell
        [sys.executable, "-m", "alembic", *args],
        cwd=API_ROOT,
        env=env,
        capture_output=True,
        text=True,
        timeout=120,
    )


def test_expected_migration_head_matches_alembic_versions() -> None:
    """Ratchet: readyz uses this head; keep it in sync when adding revisions."""
    from alembic.script import ScriptDirectory

    import utsavos.db as db_module

    versions = db_module._ALEMBIC_VERSIONS
    assert versions.is_dir()
    versions_str = str(versions)
    actual_head = ScriptDirectory(versions_str, version_locations=[versions_str]).get_current_head()
    assert db_module.expected_migration_head() == actual_head == "0002_idempotency"


def test_upgrade_downgrade_upgrade_from_empty_database() -> None:
    with psycopg.connect(ADMIN_DSN, autocommit=True) as conn:
        exists = conn.execute(
            "SELECT 1 FROM pg_database WHERE datname = %s", (DB_NAME,)
        ).fetchone()
        if not exists:
            conn.execute(f'CREATE DATABASE "{DB_NAME}"')  # noqa: S608 - constant name

    with psycopg.connect(DSN, autocommit=True) as conn:
        conn.execute("DROP SCHEMA public CASCADE")
        conn.execute("CREATE SCHEMA public")

    upgrade = _run_alembic("upgrade", "head")
    assert upgrade.returncode == 0, upgrade.stderr
    with psycopg.connect(DSN) as conn:
        assert conn.execute("SELECT to_regclass('public.events')").fetchone()[0]
        assert conn.execute("SELECT to_regclass('public.revisions')").fetchone()[0]
        assert conn.execute(
            "SELECT to_regclass('public.idempotency_records')"
        ).fetchone()[0]
        version = conn.execute("SELECT version_num FROM alembic_version").fetchone()[0]
        assert version == "0002_idempotency"

    downgrade = _run_alembic("downgrade", "base")
    assert downgrade.returncode == 0, downgrade.stderr
    with psycopg.connect(DSN) as conn:
        assert conn.execute("SELECT to_regclass('public.events')").fetchone()[0] is None

    again = _run_alembic("upgrade", "head")
    assert again.returncode == 0, again.stderr
    with psycopg.connect(DSN) as conn:
        assert conn.execute("SELECT to_regclass('public.events')").fetchone()[0]


def test_0002_adds_table_to_existing_0001_database() -> None:
    """A pre-H8 database at 0001 has no idempotency table until 0002 runs."""
    with psycopg.connect(DSN, autocommit=True) as conn:
        conn.execute("DROP SCHEMA public CASCADE")
        conn.execute("CREATE SCHEMA public")

    old = _run_alembic("upgrade", "0001_initial")
    assert old.returncode == 0, old.stderr
    with psycopg.connect(DSN, autocommit=True) as conn:
        # 0001 uses current metadata, so remove the new table to model the
        # schema an existing pre-H8 deployment actually has.
        conn.execute("DROP TABLE idempotency_records")
        assert (
            conn.execute("SELECT to_regclass('public.idempotency_records')").fetchone()[0]
            is None
        )

    upgraded = _run_alembic("upgrade", "head")
    assert upgraded.returncode == 0, upgraded.stderr
    with psycopg.connect(DSN) as conn:
        assert conn.execute(
            "SELECT to_regclass('public.idempotency_records')"
        ).fetchone()[0]
        version = conn.execute("SELECT version_num FROM alembic_version").fetchone()[0]
        assert version == "0002_idempotency"
