"""Ownership-scoped helpers shared by routers."""

from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models import Event, User
from .errors import api_error


def parse_uuid(value: str, label: str = "resource") -> uuid.UUID:
    try:
        return uuid.UUID(value)
    except (ValueError, AttributeError):
        raise api_error(404, "not_found", f"{label.capitalize()} not found") from None


def owned_event(
    db: Session, user: User, event_id: uuid.UUID, lock: bool = False
) -> Event:
    statement = select(Event).where(Event.id == event_id, Event.user_id == user.id)
    if lock:
        statement = statement.with_for_update()
    event = db.execute(statement).scalar_one_or_none()
    if event is None:
        # Same response for "does not exist" and "belongs to someone else".
        raise api_error(404, "not_found", "Event not found")
    return event
