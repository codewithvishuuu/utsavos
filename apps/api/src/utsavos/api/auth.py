"""Authentication: signup, login, logout, current user, account deletion."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends, Request, Response, status
from sqlalchemy import delete, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..config import get_settings
from ..db import get_db
from ..models import ConsentRecord, SessionRow, User
from ..schemas import DeleteAccountIn, LoginIn, SignupIn, UserOut
from ..security import (
    burn_password_check,
    hash_password,
    needs_rehash,
    new_session_token,
    normalise_email,
    password_problem,
    token_hash,
    valid_email,
    verify_password,
)
from ..security.rate_limit import RateLimiter
from .deps import (
    clear_session_cookies,
    client_ip,
    csrf_guard,
    get_current_user,
    get_session_row,
    set_session_cookies,
)
from .errors import api_error

router = APIRouter(prefix="/auth", tags=["auth"])

login_ip_limiter = RateLimiter(limit=get_settings().login_rate_limit_per_ip)
login_account_limiter = RateLimiter(limit=get_settings().login_rate_limit_per_account)
signup_limiter = RateLimiter(limit=get_settings().auth_rate_limit_per_minute)


def _rate_limit(limiter: RateLimiter, key: str) -> None:
    if not limiter.allow(key):
        raise api_error(429, "rate_limited", "Too many attempts. Wait a minute and try again.")


def _issue_session(
    db: Session, user: User, request: Request, replace_cookie: str | None
) -> tuple[str, SessionRow]:
    settings = get_settings()
    if replace_cookie:
        existing = db.scalar(
            select(SessionRow).where(SessionRow.token_hash == token_hash(replace_cookie))
        )
        if existing is not None:
            db.delete(existing)
    raw, hashed = new_session_token()
    row = SessionRow(
        user_id=user.id,
        token_hash=hashed,
        expires_at=datetime.now(UTC) + timedelta(seconds=settings.session_ttl_seconds),
        user_agent=(request.headers.get("user-agent") or "")[:255] or None,
    )
    db.add(row)
    db.flush()
    return raw, row


def _user_dto(user: User) -> dict:
    return UserOut(
        id=user.id,
        email=user.email,
        display_name=user.display_name,
        created_at=user.created_at,
    ).model_dump(mode="json")


@router.post("/signup", status_code=status.HTTP_201_CREATED, response_model=UserOut)
def signup(
    payload: SignupIn,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
) -> dict:
    _rate_limit(signup_limiter, client_ip(request))
    email = normalise_email(payload.email)
    if not valid_email(email):
        raise api_error(422, "validation_error", "Enter a valid email address")
    problem = password_problem(payload.password)
    if problem:
        raise api_error(422, "weak_password", problem)

    user = User(
        email=email,
        password_hash=hash_password(payload.password),
        display_name=payload.display_name,
    )
    db.add(user)
    try:
        db.flush()
    except IntegrityError:
        db.rollback()
        raise api_error(409, "email_taken", "An account with this email already exists.") from None
    raw, row = _issue_session(db, user, request, None)
    db.commit()
    set_session_cookies(response, raw, row.id, get_settings())
    return _user_dto(user)


@router.post("/login", response_model=UserOut)
def login(
    payload: LoginIn,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
) -> dict:
    settings = get_settings()
    email = normalise_email(payload.email)
    # Two windows: per-IP stops password spraying across accounts; per-account
    # stops brute force from rotating IPs. The key only ever sits in the
    # limiter's in-process memory (single worker), never in logs or responses.
    _rate_limit(login_ip_limiter, client_ip(request))
    _rate_limit(login_account_limiter, email)
    user = db.scalar(select(User).where(User.email == email))
    if user is None:
        burn_password_check(payload.password)
        raise api_error(401, "invalid_credentials", "Email or password is incorrect")
    if not verify_password(user.password_hash, payload.password):
        raise api_error(401, "invalid_credentials", "Email or password is incorrect")
    if needs_rehash(user.password_hash):
        user.password_hash = hash_password(payload.password)

    raw, row = _issue_session(
        db, user, request, request.cookies.get(settings.cookie_name)
    )
    db.commit()
    set_session_cookies(response, raw, row.id, settings)
    return _user_dto(user)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(
    response: Response,
    session: SessionRow = Depends(get_session_row),
    db: Session = Depends(get_db),
    _: None = Depends(csrf_guard),
) -> None:
    row = db.get(SessionRow, session.id)
    if row is not None:
        row.revoked_at = datetime.now(UTC)
        db.commit()
    clear_session_cookies(response, get_settings())


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(get_current_user)) -> dict:
    return _user_dto(user)


@router.delete("/account", status_code=status.HTTP_204_NO_CONTENT)
def delete_account(
    payload: DeleteAccountIn,
    response: Response,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    _: None = Depends(csrf_guard),
) -> None:
    if not verify_password(user.password_hash, payload.password):
        raise api_error(403, "invalid_password", "Password is incorrect")
    db.execute(delete(ConsentRecord).where(ConsentRecord.user_id == user.id))
    db.delete(user)
    db.commit()
    clear_session_cookies(response, get_settings())
