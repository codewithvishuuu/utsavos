"""Authentication, cookies, rotation, CSRF, and account lifecycle."""

from __future__ import annotations

import os
import uuid
from datetime import UTC, datetime, timedelta

from fastapi.testclient import TestClient
from tests.support import PASSWORD, headers, login, signup

from utsavos.config import Settings


def test_signup_login_me_logout(client) -> None:
    email = f"a-{uuid.uuid4().hex[:10]}@example.com"
    user = signup(client, email)
    assert user["email"] == email
    assert client.get("/api/v1/auth/me").json()["id"] == user["id"]

    assert client.post("/api/v1/auth/logout", headers=headers(client)).status_code == 204
    assert client.get("/api/v1/auth/me").status_code == 401

    login(client, email)
    assert client.get("/api/v1/auth/me").status_code == 200


def test_login_is_generic_for_wrong_password_and_unknown_email(client) -> None:
    email = f"b-{uuid.uuid4().hex[:10]}@example.com"
    signup(client, email)
    wrong = client.post(
        "/api/v1/auth/login", json={"email": email, "password": "wrong-password-123"}
    )
    missing = client.post(
        "/api/v1/auth/login",
        json={"email": "nobody@example.com", "password": "wrong-password-123"},
    )
    assert wrong.status_code == missing.status_code == 401
    assert wrong.json()["error"]["message"] == missing.json()["error"]["message"]


def test_cookie_flags(client) -> None:
    email = f"c-{uuid.uuid4().hex[:10]}@example.com"
    response = client.post(
        "/api/v1/auth/signup", json={"email": email, "password": PASSWORD}
    )
    cookies = response.headers.get_list("set-cookie")
    session_cookie = next(cookie for cookie in cookies if cookie.startswith("utsavos_session="))
    csrf_cookie = next(cookie for cookie in cookies if cookie.startswith("utsavos_csrf="))
    assert "HttpOnly" in session_cookie
    assert "SameSite=lax" in session_cookie
    assert "HttpOnly" not in csrf_cookie  # the SPA must read this one


def test_session_rotation_invalidates_previous_cookie(client) -> None:
    email = f"d-{uuid.uuid4().hex[:10]}@example.com"
    signup(client, email)
    old_token = client.cookies.get("utsavos_session")
    login(client, email)
    new_token = client.cookies.get("utsavos_session")
    assert old_token and new_token and old_token != new_token

    from utsavos.main import app

    with TestClient(app) as old_client:
        old_client.cookies.set("utsavos_session", old_token)
        assert old_client.get("/api/v1/auth/me").status_code == 401


def test_expired_session_is_rejected(client) -> None:
    email = f"e-{uuid.uuid4().hex[:10]}@example.com"
    signup(client, email)
    raw = client.cookies.get("utsavos_session")
    from sqlalchemy import select

    from utsavos.db import get_session_factory
    from utsavos.models import SessionRow
    from utsavos.security import token_hash

    with get_session_factory()() as db:
        row = db.scalar(select(SessionRow).where(SessionRow.token_hash == token_hash(raw)))
        row.expires_at = datetime.now(UTC) - timedelta(minutes=1)
        db.commit()
    assert client.get("/api/v1/auth/me").status_code == 401


def test_csrf_is_required_for_mutations(client) -> None:
    signup(client, f"f-{uuid.uuid4().hex[:10]}@example.com")
    payload = {
        "name": "No CSRF",
        "city": "Hyderabad",
        "event_date": "2027-02-14",
        "guest_count": 100,
        "budget_minor": 100_000_000,
    }
    response = client.post("/api/v1/events", json=payload)
    assert response.status_code == 403
    assert response.json()["error"]["code"] == "csrf_failed"

    forged = client.post(
        "/api/v1/events", json=payload, headers={"X-CSRF-Token": "forged"}
    )
    assert forged.status_code == 403


def test_rate_limit_on_login(client, monkeypatch) -> None:
    from utsavos.api.auth import login_account_limiter

    monkeypatch.setattr(login_account_limiter, "limit", 2)
    email = f"g-{uuid.uuid4().hex[:10]}@example.com"
    signup(client, email)
    for _ in range(2):
        assert (
            client.post(
                "/api/v1/auth/login", json={"email": email, "password": "bad-password"}
            ).status_code
            == 401
        )
    limited = client.post(
        "/api/v1/auth/login", json={"email": email, "password": "bad-password"}
    )
    assert limited.status_code == 429


def test_weak_password_rejected(client) -> None:
    response = client.post(
        "/api/v1/auth/signup",
        json={"email": f"h-{uuid.uuid4().hex[:10]}@example.com", "password": "short"},
    )
    assert response.status_code == 422


def test_duplicate_email_rejected(client) -> None:
    email = f"i-{uuid.uuid4().hex[:10]}@example.com"
    signup(client, email)
    response = client.post(
        "/api/v1/auth/signup", json={"email": email, "password": PASSWORD}
    )
    assert response.status_code == 409


def test_account_deletion_removes_access(client) -> None:
    email = f"j-{uuid.uuid4().hex[:10]}@example.com"
    signup(client, email)
    response = client.request(
        "DELETE",
        "/api/v1/auth/account",
        json={"password": PASSWORD},
        headers=headers(client),
    )
    assert response.status_code == 204
    assert client.get("/api/v1/auth/me").status_code == 401
    assert (
        client.post(
            "/api/v1/auth/login", json={"email": email, "password": PASSWORD}
        ).status_code
        == 401
    )


def test_account_deletion_requires_correct_password(client) -> None:
    signup(client, f"k-{uuid.uuid4().hex[:10]}@example.com")
    response = client.request(
        "DELETE",
        "/api/v1/auth/account",
        json={"password": "not-the-password"},
        headers=headers(client),
    )
    assert response.status_code == 403

def test_production_logout_deletes_host_cookie_and_ends_session(client, monkeypatch) -> None:
    email = f"prod-logout-{uuid.uuid4().hex[:10]}@example.com"
    signup(client, email)

    production = Settings(
        app_env="production",
        app_secret_key=os.environ["APP_SECRET_KEY"],
        database_url=os.environ["DATABASE_URL"],
        session_cookie_secure=True,
    )
    from utsavos.api import auth, deps
    from utsavos.main import app

    monkeypatch.setattr(auth, "get_settings", lambda: production)
    monkeypatch.setattr(deps, "get_settings", lambda: production)

    with TestClient(app, base_url="https://testserver") as browser:
        login(browser, email)
        response = browser.post("/api/v1/auth/logout", headers=headers(browser))
        assert response.status_code == 204
        deletes = response.headers.get_list("set-cookie")
        session_delete = next(
            value for value in deletes if value.startswith("__Host-utsavos_session=")
        )
        assert "Path=/" in session_delete
        assert "Secure" in session_delete
        assert "HttpOnly" in session_delete
        assert "SameSite=lax" in session_delete
        assert browser.cookies.get("__Host-utsavos_session") is None
        assert browser.get("/api/v1/auth/me").status_code == 401
