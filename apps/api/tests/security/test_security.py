"""Security behaviour: CORS, IDOR, mass assignment, headers, size limits."""

from __future__ import annotations

import uuid

from tests.support import add_item, create_event, headers, signup


def test_cors_allows_configured_origin_only(client) -> None:
    allowed = client.options(
        "/api/v1/events",
        headers={
            "Origin": "http://localhost:5173",
            "Access-Control-Request-Method": "POST",
        },
    )
    assert allowed.headers.get("access-control-allow-origin") == "http://localhost:5173"

    denied = client.options(
        "/api/v1/events",
        headers={"Origin": "https://evil.example", "Access-Control-Request-Method": "POST"},
    )
    assert denied.headers.get("access-control-allow-origin") is None

    idempotent = client.options(
        "/api/v1/events",
        headers={
            "Origin": "http://localhost:5173",
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "Idempotency-Key, X-CSRF-Token",
        },
    )
    allowed_headers = idempotent.headers.get("access-control-allow-headers", "").lower()
    assert "idempotency-key" in allowed_headers
    assert "x-csrf-token" in allowed_headers


def test_security_headers_are_present(client) -> None:
    response = client.get("/healthz")
    assert response.headers["X-Frame-Options"] == "DENY"
    assert response.headers["Referrer-Policy"] == "no-referrer"
    assert response.headers["X-Content-Type-Options"] == "nosniff"
    csp = response.headers["Content-Security-Policy"]
    assert "default-src 'self'" in csp
    assert "script-src 'self'" in csp
    assert "style-src 'self'" in csp
    assert "frame-ancestors 'none'" in csp
    assert "'unsafe-inline'" not in csp
    assert "'unsafe-eval'" not in csp


def test_api_responses_are_not_cacheable(client) -> None:
    for path in ("/api/v1/demo/fixture", "/api/v1/nope"):
        response = client.get(path)
        assert response.headers["Cache-Control"] == "no-store"
        assert response.headers["Pragma"] == "no-cache"


def test_swagger_docs_are_exempt_from_strict_csp_in_development(client) -> None:
    response = client.get("/api/docs")
    assert response.status_code == 200
    # Swagger UI loads CDN and inline assets; production disables the route entirely.
    assert "Content-Security-Policy" not in response.headers


def test_mass_assignment_is_rejected(client) -> None:
    signup(client, f"sec-{uuid.uuid4().hex[:10]}@example.com")
    response = client.post(
        "/api/v1/events",
        json={
            "name": "Nope",
            "city": "Hyderabad",
            "event_date": "2027-02-14",
            "guest_count": 10,
            "budget_minor": 1_000,
            "version": 99,
            "user_id": str(uuid.uuid4()),
        },
        headers=headers(client),
    )
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "validation_error"


def test_nested_resources_are_owner_scoped(client) -> None:
    from fastapi.testclient import TestClient

    from utsavos.main import app

    signup(client, f"sec-{uuid.uuid4().hex[:10]}@example.com")
    event = create_event(client)
    item = add_item(client, event["id"], "Venue", 1_000)

    with TestClient(app) as intruder:
        signup(intruder, f"sec-{uuid.uuid4().hex[:10]}@example.com")
        assert (
            intruder.patch(
                f"/api/v1/events/{event['id']}/budget-items/{item['id']}",
                json={"unit_amount_minor": 1},
                headers=headers(intruder),
            ).status_code
            == 404
        )
        assert (
            intruder.post(
                f"/api/v1/events/{event['id']}/simulate",
                json={"kind": "guest_count", "guest_count": 200},
                headers=headers(intruder),
            ).status_code
            == 404
        )
        assert (
            intruder.get(f"/api/v1/events/{event['id']}/export").status_code == 404
        )


def test_private_data_never_appears_in_public_demo(client) -> None:
    signup(client, f"sec-{uuid.uuid4().hex[:10]}@example.com")
    event = create_event(client, name="Private Secret Wedding")
    add_item(client, event["id"], "Private Venue", 42_000_000)
    body = client.get("/api/v1/demo/fixture").text
    assert "Private Secret Wedding" not in body
    assert "Private Venue" not in body


def test_oversized_request_is_rejected_before_parsing(client) -> None:
    response = client.post(
        "/api/v1/auth/login",
        content=b'{"email":"a@b.com","password":"' + b"x" * (70 * 1024) + b'"}',
    )
    assert response.status_code == 413
    assert response.headers["X-Request-ID"]
    assert "Content-Security-Policy" in response.headers


def test_unauthenticated_access_is_rejected(client) -> None:
    assert client.get("/api/v1/events").status_code == 401
    assert client.get("/api/v1/ai/status").status_code == 401

def test_production_rejects_insecure_cookie_and_weak_database_password() -> None:
    import pytest

    from utsavos.config import Settings

    common = {
        "app_env": "production",
        "app_secret_key": "x" * 40,
        "database_url": (
            "postgresql+psycopg://utsavos:strong-url-safe-password-123@db/utsavos"
            "?sslmode=verify-full&sslrootcert=/etc/ssl/certs/ca.crt"
        ),
    }
    with pytest.raises(RuntimeError, match="SESSION_COOKIE_SECURE"):
        Settings(**common, session_cookie_secure=False).validate_runtime()
    with pytest.raises(RuntimeError, match="strong database password"):
        Settings(
            **{**common, "database_url": "postgresql+psycopg://utsavos:utsavos_dev@db/utsavos"}
        ).validate_runtime()
    with pytest.raises(RuntimeError, match="strong database password"):
        Settings(
            **{**common, "database_url": "postgresql+psycopg://utsavos:short@db/utsavos"}
        ).validate_runtime()
    Settings(**common).validate_runtime()


def test_hsts_is_only_sent_in_production() -> None:
    from fastapi import Response

    from utsavos.config import Settings
    from utsavos.main import apply_security_headers

    production = Settings(
        app_env="production",
        app_secret_key="x" * 40,
        database_url=(
            "postgresql+psycopg://utsavos:strong-url-safe-password-123@db/utsavos"
            "?sslmode=verify-full&sslrootcert=/etc/ssl/certs/ca.crt"
        ),
    )
    response = Response()
    apply_security_headers(response, "req", "/healthz", production)
    assert response.headers["Strict-Transport-Security"] == (
        "max-age=31536000; includeSubDomains"
    )

    development = Settings(app_env="test")
    dev_response = Response()
    apply_security_headers(dev_response, "req", "/healthz", development)
    assert "Strict-Transport-Security" not in dev_response.headers


def _request(peer: str, forwarded_for: str | None):
    from starlette.requests import Request

    headers = []
    if forwarded_for is not None:
        headers.append((b"x-forwarded-for", forwarded_for.encode()))
    return Request(
        {
            "type": "http",
            "method": "GET",
            "path": "/",
            "headers": headers,
            "client": (peer, 1234),
            "scheme": "http",
            "server": ("testserver", 80),
            "query_string": b"",
        }
    )


def test_forwarded_for_is_only_trusted_from_configured_proxies(monkeypatch) -> None:
    from utsavos.api import deps
    from utsavos.config import Settings

    settings = Settings(app_env="test", trusted_proxy_ips="10.0.0.5, 10.0.0.0/24")
    monkeypatch.setattr(deps, "get_settings", lambda: settings)

    assert deps.client_ip(_request("203.0.113.9", "1.2.3.4")) == "203.0.113.9"
    assert deps.client_ip(_request("10.0.0.5", "1.2.3.4, 10.0.0.5")) == "1.2.3.4"
    assert deps.client_ip(_request("10.0.0.7", "1.2.3.4")) == "1.2.3.4"
    assert deps.client_ip(_request("10.0.0.5", "not-an-ip")) == "10.0.0.5"
