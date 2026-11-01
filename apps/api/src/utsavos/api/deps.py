"""Shared API dependencies: sessions, current user, CSRF, rate limiting."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime
from ipaddress import ip_address, ip_network

from fastapi import Depends, Request, Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..config import Settings, get_settings
from ..db import get_db
from ..models import SessionRow, User
from ..security import constant_time_equal, csrf_token, token_hash
from .errors import api_error

SAFE_METHODS = {"GET", "HEAD", "OPTIONS"}


def get_session_row(request: Request, db: Session = Depends(get_db)) -> SessionRow:
    settings = get_settings()
    raw = request.cookies.get(settings.cookie_name)
    if not raw:
        raise api_error(401, "not_authenticated", "Sign in to continue")
    row = db.scalar(
        select(SessionRow).where(
            SessionRow.token_hash == token_hash(raw), SessionRow.revoked_at.is_(None)
        )
    )
    if row is None:
        raise api_error(401, "invalid_session", "Your session is no longer valid")
    if row.expires_at <= datetime.now(UTC):
        raise api_error(401, "expired_session", "Your session has expired")
    return row


def get_current_user(
    session: SessionRow = Depends(get_session_row), db: Session = Depends(get_db)
) -> User:
    user = db.get(User, session.user_id)
    if user is None:
        raise api_error(401, "not_authenticated", "Sign in to continue")
    return user


def csrf_guard(
    request: Request, session: SessionRow = Depends(get_session_row)
) -> None:
    if request.method in SAFE_METHODS:
        return
    settings = get_settings()
    expected = csrf_token(str(session.id), settings.app_secret_key)
    header = request.headers.get("X-CSRF-Token", "")
    cookie = request.cookies.get(settings.csrf_cookie_name, "")
    if not (constant_time_equal(header, expected) and constant_time_equal(cookie, expected)):
        raise api_error(403, "csrf_failed", "CSRF token missing or invalid")


def set_session_cookies(
    response: Response, raw_token: str, session_id: uuid.UUID, settings: Settings
) -> None:
    max_age = settings.session_ttl_seconds
    response.set_cookie(
        settings.cookie_name,
        raw_token,
        max_age=max_age,
        httponly=True,
        secure=settings.secure_cookies,
        samesite="lax",
        path="/",
    )
    response.set_cookie(
        settings.csrf_cookie_name,
        csrf_token(str(session_id), settings.app_secret_key),
        max_age=max_age,
        httponly=False,
        secure=settings.secure_cookies,
        samesite="lax",
        path="/",
    )


def clear_session_cookies(response: Response, settings: Settings) -> None:
    response.delete_cookie(
        settings.cookie_name,
        path="/",
        secure=settings.secure_cookies,
        httponly=True,
        samesite="lax",
    )
    response.delete_cookie(
        settings.csrf_cookie_name,
        path="/",
        secure=settings.secure_cookies,
        httponly=False,
        samesite="lax",
    )


def _is_trusted_proxy(host: str, trusted: set[str]) -> bool:
    try:
        address = ip_address(host)
    except ValueError:
        return False
    for entry in trusted:
        try:
            network = ip_network(entry, strict=False)
        except ValueError:
            continue
        if address in network:
            return True
    return False


def client_ip(request: Request) -> str:
    peer = request.client.host if request.client else "unknown"
    trusted = get_settings().trusted_proxy_set
    if not trusted or not _is_trusted_proxy(peer, trusted):
        return peer
    hops = [
        hop.strip()
        for hop in request.headers.get("x-forwarded-for", "").split(",")
        if hop.strip()
    ]
    for hop in reversed(hops):
        try:
            ip_address(hop)
        except ValueError:
            continue
        if not _is_trusted_proxy(hop, trusted):
            return hop
    return peer
