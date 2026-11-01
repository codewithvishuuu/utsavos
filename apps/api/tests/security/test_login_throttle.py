"""P2-05: login throttling must resist bypass via rotating IPs or email variants."""

from __future__ import annotations

import logging
import uuid

from tests.support import PASSWORD, signup

LOGIN = "/api/v1/auth/login"
BAD = "wrong-password-1"  # noqa: S105 - test fixture only


def _login(client, email: str, password: str = PASSWORD):
    return client.post(LOGIN, json={"email": email, "password": password})


def test_login_throttle_limits_are_wired_from_settings() -> None:
    from utsavos.api import auth
    from utsavos.config import get_settings

    settings = get_settings()
    assert auth.login_ip_limiter.limit == settings.login_rate_limit_per_ip
    assert auth.login_account_limiter.limit == settings.login_rate_limit_per_account


def test_login_is_throttled_per_account_despite_ip_rotation(
    client, monkeypatch
) -> None:
    from utsavos.api import auth
    from utsavos.api.auth import login_account_limiter, login_ip_limiter

    email = f"victim-{uuid.uuid4().hex[:10]}@example.com"
    signup(client, email)
    monkeypatch.setattr(login_account_limiter, "limit", 2)
    monkeypatch.setattr(login_ip_limiter, "limit", 10**9)  # isolate the account window
    # each attempt claims a different source IP, as through a trusted proxy
    rotating_ips = iter(f"198.51.100.{n}" for n in range(1, 10))
    monkeypatch.setattr(auth, "client_ip", lambda request: next(rotating_ips))

    for _ in range(2):
        assert _login(client, email, BAD).status_code == 401
    limited = _login(client, email, BAD)
    assert limited.status_code == 429
    assert limited.json()["error"]["code"] == "rate_limited"
    assert email not in limited.text


def test_login_is_throttled_per_ip_despite_rotating_email_targets(
    client, monkeypatch
) -> None:
    from utsavos.api.auth import login_account_limiter, login_ip_limiter

    monkeypatch.setattr(login_ip_limiter, "limit", 3)
    monkeypatch.setattr(login_account_limiter, "limit", 10**9)  # isolate the IP window

    # password spraying: three distinct accounts from one IP still fit
    for n in range(3):
        attempt = _login(
            client, f"spray-{n}-{uuid.uuid4().hex[:8]}@example.com", BAD
        )
        assert attempt.status_code == 401
    # a fourth distinct account from the same IP is stopped by the per-IP window
    assert _login(
        client, f"spray-999-{uuid.uuid4().hex[:8]}@example.com", BAD
    ).status_code == 429


def test_account_throttle_uses_normalised_email_and_hides_it(
    client, monkeypatch, caplog
) -> None:
    from utsavos.api.auth import login_account_limiter, login_ip_limiter

    email = f"norm-{uuid.uuid4().hex[:10]}@example.com"
    signup(client, email)
    monkeypatch.setattr(login_account_limiter, "limit", 2)
    monkeypatch.setattr(login_ip_limiter, "limit", 10**9)
    caplog.set_level(logging.INFO)

    # case variants must count as the same account (the schema strips whitespace)
    for variant in (email.upper(), email.title()):
        assert _login(client, variant, BAD).status_code == 401

    limited = _login(client, email, BAD)
    assert limited.status_code == 429
    assert email not in limited.text

    logged = " ".join(record.getMessage() for record in caplog.records)
    assert email not in logged


def test_legitimate_login_is_not_broken_by_default_windows(client) -> None:
    email = f"ok-{uuid.uuid4().hex[:10]}@example.com"
    signup(client, email)
    assert _login(client, email, BAD).status_code == 401
    assert _login(client, email).status_code == 200
