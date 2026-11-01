"""Request-ID correlation, production 500 hardening and log privacy."""

from __future__ import annotations

import logging
import re
import uuid

from fastapi.testclient import TestClient
from tests.support import PASSWORD, create_event, headers, signup

from utsavos.config import Settings

DB_PASSWORD = "a-strong-db-password-123456"  # noqa: S105 - test fixture only


def _production_settings() -> Settings:
    return Settings(
        app_env="production",
        app_secret_key="s" * 48,
        database_url=(
            f"postgresql+psycopg://utsavos:{DB_PASSWORD}@127.0.0.1:5432/utsavos"
            "?sslmode=verify-full&sslrootcert=/etc/ssl/certs/ca.crt"
        ),
        ai_local_enabled=False,
        cloud_ai_enabled=False,
        cors_origins="https://utsavos.example",
    )


def _production_app(monkeypatch):  # noqa: ANN001
    from utsavos import main as main_module

    settings = _production_settings()
    monkeypatch.setattr(main_module, "get_settings", lambda: settings)
    return main_module.create_app()


def _boom() -> None:
    raise RuntimeError("test boom")


def test_production_500_has_matching_headers_body_and_log_id(
    monkeypatch, caplog
) -> None:
    from utsavos.api.deps import get_current_user

    app = _production_app(monkeypatch)
    app.dependency_overrides[get_current_user] = _boom
    caplog.set_level(logging.INFO)

    with TestClient(
        app, base_url="https://testserver", raise_server_exceptions=False
    ) as client:
        response = client.get(
            "/api/v1/auth/me", headers={"X-Request-ID": "trace-500"}
        )

    assert response.status_code == 500
    request_id = response.json()["error"]["request_id"]
    assert request_id == "trace-500"
    assert response.headers["X-Request-ID"] == request_id
    assert response.headers["Content-Security-Policy"]
    assert response.headers["Strict-Transport-Security"].startswith("max-age=31536000")
    assert response.headers["Cache-Control"] == "no-store"
    assert response.headers["Pragma"] == "no-cache"
    assert response.headers["X-Content-Type-Options"] == "nosniff"
    assert response.headers["X-Frame-Options"] == "DENY"
    assert response.headers["Referrer-Policy"] == "no-referrer"

    records = [
        record
        for record in caplog.records
        if getattr(record, "request_id", None) == request_id
    ]
    assert any(record.getMessage() == "unhandled error" for record in records)
    assert any("status=500" in record.getMessage() for record in records)


def test_log_level_configures_root_logger() -> None:
    from utsavos.observability import configure_logging

    root = logging.getLogger()
    original = root.level
    try:
        configure_logging("warning")
        assert root.level == logging.WARNING
        configure_logging("not-a-level")
        assert root.level == logging.INFO
    finally:
        root.setLevel(original)


def test_request_completion_is_logged_for_200_4xx_and_500(
    monkeypatch, caplog
) -> None:
    from utsavos.api.deps import get_current_user

    app = _production_app(monkeypatch)
    app.dependency_overrides[get_current_user] = _boom
    caplog.set_level(logging.INFO)

    with TestClient(
        app, base_url="https://testserver", raise_server_exceptions=False
    ) as client:
        caplog.clear()
        assert client.get("/healthz").status_code == 200
        assert client.get("/api/v1/nope").status_code == 404
        assert client.get("/api/v1/auth/me").status_code == 500

    completed = [
        record
        for record in caplog.records
        if record.getMessage().startswith("request.completed")
    ]
    messages = " ".join(record.getMessage() for record in completed)
    assert "path=/healthz status=200" in messages
    assert "path=/api/v1/nope status=404" in messages
    assert "path=/api/v1/auth/me status=500" in messages
    assert all(record.request_id not in {"", "-"} for record in completed)


def test_inbound_request_id_is_sanitized(client, caplog) -> None:
    caplog.set_level(logging.INFO)
    accepted = "trace-abc_123:4.5"
    response = client.get("/healthz", headers={"X-Request-ID": accepted})
    assert response.headers["X-Request-ID"] == accepted

    for rejected in ("has space", "x" * 129, "bad<script>", ""):
        response = client.get("/healthz", headers={"X-Request-ID": rejected})
        generated = response.headers["X-Request-ID"]
        assert generated != rejected
        assert re.fullmatch(r"[0-9a-f]{32}", generated)


def test_logs_exclude_guest_contacts_session_tokens_and_secrets(
    client, caplog
) -> None:
    caplog.set_level(logging.INFO)
    email = f"logs-{uuid.uuid4().hex[:10]}@example.com"
    signup(client, email, PASSWORD)
    token = client.cookies.get("utsavos_session")
    assert token
    event = create_event(client, name="Private Log Event")

    phone = "9876543210"
    note = "Private dietary note 42"
    guest = client.post(
        f"/api/v1/events/{event['id']}/guests",
        json={"full_name": "Log Guest", "phone": phone, "notes": note},
        headers=headers(client),
    )
    assert guest.status_code == 201, guest.text

    caplog.clear()
    assert client.get(f"/api/v1/events/{event['id']}/plan").status_code == 200
    assert client.get(f"/healthz?contact={phone}").status_code == 200
    logged = caplog.text
    assert "request.completed" in logged
    for secret in (email, PASSWORD, token, phone, note, "Private Log Event"):
        assert secret not in logged
