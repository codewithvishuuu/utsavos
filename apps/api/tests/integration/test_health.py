from sqlalchemy import text

from utsavos.db import expected_migration_head, get_engine

_ALEMBIC_DDL = (
    "CREATE TABLE IF NOT EXISTS alembic_version "
    "(version_num VARCHAR(32) NOT NULL, "
    "CONSTRAINT alembic_version_pkc PRIMARY KEY (version_num))"
)


def test_health_and_readiness(client) -> None:
    assert client.get("/healthz").json() == {"status": "ok"}
    ready = client.get("/readyz")
    assert ready.status_code == 200
    assert ready.json()["database"] is True


def test_healthz_never_touches_the_database(client, monkeypatch) -> None:
    import utsavos.main as main

    def _boom() -> tuple[bool, str | None]:
        raise AssertionError("healthz must not query the database")

    monkeypatch.setattr(main, "check_database", _boom)
    assert client.get("/healthz").status_code == 200


def _restamp_migrations() -> None:
    with get_engine().begin() as conn:
        conn.execute(text(_ALEMBIC_DDL))
        conn.execute(text("DELETE FROM alembic_version"))
        conn.execute(
            text("INSERT INTO alembic_version (version_num) VALUES (:head)"),
            {"head": expected_migration_head()},
        )


def test_readiness_detects_missing_migrations_table(client) -> None:
    with get_engine().begin() as conn:
        conn.execute(text("DROP TABLE alembic_version"))
    try:
        ready = client.get("/readyz")
        assert ready.json() == {
            "status": "not_ready",
            "database": False,
            "reason": "schema not migrated",
        }
        assert ready.status_code == 503
    finally:
        _restamp_migrations()
    assert client.get("/readyz").status_code == 200


def test_readiness_detects_stale_migrations(client) -> None:
    with get_engine().begin() as conn:
        conn.execute(text("UPDATE alembic_version SET version_num = '0001_initial'"))
    try:
        ready = client.get("/readyz")
        assert ready.status_code == 503
        body = ready.json()
        assert body["status"] == "not_ready"
        assert body["reason"] == "migrations out of date"
    finally:
        _restamp_migrations()
    assert client.get("/readyz").status_code == 200


def test_readiness_detects_missing_schema_tables(client) -> None:
    with get_engine().begin() as conn:
        conn.execute(text("DROP TABLE idempotency_records"))
    try:
        ready = client.get("/readyz")
        assert ready.status_code == 503
        assert ready.json()["reason"] == "schema not migrated"
    finally:
        from utsavos.db import Base

        Base.metadata.create_all(get_engine())
    assert client.get("/readyz").status_code == 200


def test_readyz_fails_closed_when_production_connection_has_no_tls(
    client, monkeypatch
) -> None:
    import utsavos.db as db_module

    class ProductionFlag:
        is_production = True  # local test connection runs without TLS

    monkeypatch.setattr(db_module, "get_settings", lambda: ProductionFlag())
    ready = client.get("/readyz")
    assert ready.status_code == 503
    assert ready.json()["reason"] == "database TLS not verified"


def test_unknown_route_returns_json_envelope(client) -> None:
    response = client.get("/api/v1/nope")
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "not_found"
    assert "request_id" in response.json()["error"]
    assert response.headers["X-Request-ID"]
    assert response.headers["X-Content-Type-Options"] == "nosniff"
