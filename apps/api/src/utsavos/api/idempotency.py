"""Idempotent mutation responses backed by PostgreSQL.

The reservation row is inserted in the same transaction as the mutation. A
concurrent request with the same scope and key waits on the unique constraint,
then either replays the committed response or receives a payload conflict.
"""

from __future__ import annotations

import hashlib
import json
import uuid
from collections.abc import Callable
from datetime import timedelta
from typing import Any

from fastapi.encoders import jsonable_encoder
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..models import IdempotencyRecord, utcnow
from .errors import api_error

IDEMPOTENCY_HEADER = "Idempotency-Key"
IDEMPOTENCY_TTL = timedelta(hours=24)


def _validate_key(value: str | None) -> str | None:
    if value is None:
        return None
    key = value.strip()
    if not key or len(key) > 255 or any(ord(char) < 33 or ord(char) > 126 for char in key):
        raise api_error(
            422,
            "invalid_idempotency_key",
            "Idempotency-Key must be 1-255 printable ASCII characters.",
        )
    return key


def _fingerprint(payload: BaseModel, path_params: dict[str, str] | None) -> str:
    body = {
        "payload": payload.model_dump(mode="json"),
        "path": path_params or {},
    }
    canonical = json.dumps(body, sort_keys=True, separators=(",", ":"), ensure_ascii=True)
    return hashlib.sha256(canonical.encode()).hexdigest()


def _replay(record: IdempotencyRecord, fingerprint: str) -> JSONResponse:
    if record.response_status is None or record.response_body is None:
        raise api_error(
            409,
            "idempotency_in_progress",
            "This request is still being processed. Retry with the same key shortly.",
        )
    if record.request_hash != fingerprint:
        raise api_error(
            409,
            "idempotency_conflict",
            "This Idempotency-Key was already used with a different request. "
            "Start a new submission.",
        )
    return JSONResponse(
        status_code=record.response_status,
        content=record.response_body,
        headers={"Idempotency-Replayed": "true"},
    )


def run_idempotent(
    *,
    db: Session,
    user_id: uuid.UUID,
    event_id: uuid.UUID | None,
    endpoint: str,
    key: str | None,
    payload: BaseModel,
    action: Callable[[], dict[str, Any]],
    path_params: dict[str, str] | None = None,
    status_code: int = 201,
) -> JSONResponse:
    """Run one mutation, optionally recording and replaying its response."""
    idempotency_key = _validate_key(key)
    method = "POST"
    scope_key = str(event_id) if event_id is not None else "account"
    fingerprint = _fingerprint(payload, path_params)

    if idempotency_key is None:
        try:
            body = jsonable_encoder(action())
            db.commit()
        except Exception:
            db.rollback()
            raise
        return JSONResponse(status_code=status_code, content=body)

    record = IdempotencyRecord(
        user_id=user_id,
        event_id=event_id,
        scope_key=scope_key,
        method=method,
        endpoint=endpoint,
        idempotency_key=idempotency_key,
        request_hash=fingerprint,
        expires_at=utcnow() + IDEMPOTENCY_TTL,
    )
    db.add(record)
    try:
        db.flush()
    except IntegrityError:
        db.rollback()
        existing = db.scalar(
            select(IdempotencyRecord).where(
                IdempotencyRecord.user_id == user_id,
                IdempotencyRecord.scope_key == scope_key,
                IdempotencyRecord.method == method,
                IdempotencyRecord.endpoint == endpoint,
                IdempotencyRecord.idempotency_key == idempotency_key,
            )
        )
        if existing is None:
            raise api_error(
                409,
                "idempotency_in_progress",
                "This request is still being processed. Retry with the same key shortly.",
            ) from None
        return _replay(existing, fingerprint)

    try:
        body = jsonable_encoder(action())
        record.response_status = status_code
        record.response_body = body
        db.commit()
    except Exception:
        db.rollback()
        raise
    return JSONResponse(status_code=status_code, content=body)
