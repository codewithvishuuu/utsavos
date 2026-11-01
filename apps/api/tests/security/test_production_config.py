"""Production configuration guards and response headers."""

from __future__ import annotations

import pytest
from fastapi import Response

from utsavos.config import Settings
from utsavos.main import apply_security_headers

DB_PASSWORD = "a-strong-db-password-123456"  # noqa: S105 - test fixture only


def _production(**overrides) -> Settings:
    values = {
        "app_env": "production",
        "app_secret_key": "s" * 48,
        "database_url": (
            f"postgresql+psycopg://utsavos:{DB_PASSWORD}@127.0.0.1:5432/utsavos"
            "?sslmode=verify-full&sslrootcert=/etc/ssl/certs/ca.crt"
        ),
    }
    values.update(overrides)
    return Settings(**values)


def test_production_cookie_and_header_posture() -> None:
    settings = _production()
    settings.validate_runtime()
    assert settings.secure_cookies is True
    assert settings.cookie_name == "__Host-utsavos_session"

    response = Response()
    apply_security_headers(response, "request-id", "/api/v1/events", settings)
    assert response.headers["Strict-Transport-Security"].startswith("max-age=31536000")
    assert response.headers["Cache-Control"] == "no-store"
    assert response.headers["Pragma"] == "no-cache"
    assert response.headers["X-Content-Type-Options"] == "nosniff"


def test_production_rejects_wildcard_trusted_proxy() -> None:
    settings = _production(trusted_proxy_ips="0.0.0.0/0")
    with pytest.raises(RuntimeError, match="cannot trust every address"):
        settings.validate_runtime()


def test_production_rejects_invalid_trusted_proxy() -> None:
    settings = _production(trusted_proxy_ips="proxy.internal")
    with pytest.raises(RuntimeError, match="IP addresses or CIDR"):
        settings.validate_runtime()


def test_production_accepts_private_proxy_ranges() -> None:
    settings = _production(trusted_proxy_ips="10.0.0.0/8, 192.168.1.10")
    settings.validate_runtime()


def test_production_rejects_non_postgres_database() -> None:
    settings = _production(
        database_url=f"sqlite:///tmp/utsavos.db?password={DB_PASSWORD}"
    )
    with pytest.raises(RuntimeError, match="must use PostgreSQL"):
        settings.validate_runtime()


def test_production_requires_verified_tls_with_ca_bundle() -> None:
    base = f"postgresql+psycopg://utsavos:{DB_PASSWORD}@db.internal:5432/utsavos"
    with pytest.raises(RuntimeError, match="sslmode=verify-full"):
        _production(database_url=base).validate_runtime()
    with pytest.raises(RuntimeError, match="sslmode=verify-full"):
        _production(database_url=f"{base}?sslmode=require").validate_runtime()
    with pytest.raises(RuntimeError, match="sslrootcert"):
        _production(database_url=f"{base}?sslmode=verify-full").validate_runtime()
    with pytest.raises(RuntimeError, match="sslrootcert"):
        _production(database_url=f"{base}?sslmode=verify-full&sslrootcert=").validate_runtime()
    _production(
        database_url=f"{base}?sslmode=verify-full&sslrootcert=/etc/ssl/certs/db-ca.crt"
    ).validate_runtime()
    _production(database_url=f"{base}?sslmode=verify-full&sslrootcert=system").validate_runtime()


def test_public_ollama_requires_explicit_remote_opt_in() -> None:
    public = Settings(
        app_env="test",
        ai_local_enabled=True,
        ollama_base_url="http://8.8.8.8:11434",
    )
    with pytest.raises(RuntimeError, match="AI_LOCAL_ALLOW_REMOTE"):
        public.validate_runtime()

    allowed = Settings(
        app_env="test",
        ai_local_enabled=True,
        ai_local_allow_remote=True,
        ollama_base_url="http://8.8.8.8:11434",
    )
    allowed.validate_runtime()
    assert allowed.ollama_endpoint_is_local is False

    local = Settings(
        app_env="test",
        ai_local_enabled=True,
        ollama_base_url="http://127.0.0.1:11434",
    )
    local.validate_runtime()
    assert local.ollama_endpoint_is_local is True
