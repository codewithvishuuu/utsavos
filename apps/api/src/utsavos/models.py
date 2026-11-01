"""SQLAlchemy models. Money is always integer minor units (paise)."""

from __future__ import annotations

import uuid
from datetime import UTC, date, datetime
from typing import Any

from sqlalchemy import (
    BigInteger,
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .db import Base


def _uuid() -> uuid.UUID:
    return uuid.uuid4()


def utcnow() -> datetime:
    return datetime.now(UTC)


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow
    )


class User(TimestampMixin, Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    email: Mapped[str] = mapped_column(String(320), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    display_name: Mapped[str | None] = mapped_column(String(120))

    sessions: Mapped[list[SessionRow]] = relationship(
        back_populates="user", cascade="all, delete-orphan", passive_deletes=True
    )


class SessionRow(Base):
    __tablename__ = "sessions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    token_hash: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    user_agent: Mapped[str | None] = mapped_column(String(255))

    user: Mapped[User] = relationship(back_populates="sessions")


class Event(TimestampMixin, Base):
    __tablename__ = "events"
    __table_args__ = (
        CheckConstraint("guest_count >= 0", name="ck_events_guest_count"),
        CheckConstraint("budget_minor >= 0", name="ck_events_budget"),
        CheckConstraint(
            "reserve_minor >= 0 AND reserve_minor <= budget_minor", name="ck_events_reserve"
        ),
        CheckConstraint("version >= 1", name="ck_events_version"),
        CheckConstraint(
            "status IN ('planning','approved','cancelled')", name="ck_events_status"
        ),
        Index("ix_events_user_created", "user_id", "created_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    name: Mapped[str] = mapped_column(String(160))
    event_type: Mapped[str] = mapped_column(String(40), default="wedding")
    city: Mapped[str] = mapped_column(String(120))
    event_date: Mapped[date] = mapped_column(Date)
    guest_count: Mapped[int] = mapped_column(Integer, default=0)
    budget_minor: Mapped[int] = mapped_column(BigInteger)
    reserve_minor: Mapped[int] = mapped_column(BigInteger, default=0)
    currency: Mapped[str] = mapped_column(String(3), default="INR")
    status: Mapped[str] = mapped_column(String(20), default="planning")
    version: Mapped[int] = mapped_column(Integer, default=1)

    ceremonies: Mapped[list[Ceremony]] = relationship(
        back_populates="event", cascade="all, delete-orphan"
    )
    budget_items: Mapped[list[BudgetItem]] = relationship(
        back_populates="event", cascade="all, delete-orphan"
    )
    guests: Mapped[list[Guest]] = relationship(back_populates="event", cascade="all, delete-orphan")
    tasks: Mapped[list[Task]] = relationship(back_populates="event", cascade="all, delete-orphan")
    vendors: Mapped[list[Vendor]] = relationship(
        back_populates="event", cascade="all, delete-orphan"
    )
    proposals: Mapped[list[Proposal]] = relationship(
        back_populates="event", cascade="all, delete-orphan"
    )
    revisions: Mapped[list[Revision]] = relationship(
        back_populates="event", cascade="all, delete-orphan"
    )


class Ceremony(Base):
    __tablename__ = "ceremonies"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    event_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("events.id", ondelete="CASCADE"), index=True
    )
    name: Mapped[str] = mapped_column(String(120))
    ceremony_date: Mapped[date] = mapped_column(Date)
    guest_count: Mapped[int] = mapped_column(Integer, default=0)
    venue: Mapped[str | None] = mapped_column(String(160))

    event: Mapped[Event] = relationship(back_populates="ceremonies")


class BudgetItem(Base):
    __tablename__ = "budget_items"
    __table_args__ = (
        CheckConstraint("unit_amount_minor >= 0", name="ck_budget_items_amount"),
        CheckConstraint(
            "quote_override_minor IS NULL OR quote_override_minor >= 0",
            name="ck_budget_items_quote",
        ),
        CheckConstraint("quantity >= 0", name="ck_budget_items_quantity"),
        CheckConstraint("basis IN ('fixed','per_guest')", name="ck_budget_items_basis"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    event_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("events.id", ondelete="CASCADE"), index=True
    )
    category: Mapped[str] = mapped_column(String(60))
    label: Mapped[str] = mapped_column(String(160))
    basis: Mapped[str] = mapped_column(String(20), default="fixed")
    unit_amount_minor: Mapped[int] = mapped_column(BigInteger)
    quantity: Mapped[int] = mapped_column(Integer, default=1)
    vendor_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("vendors.id", ondelete="SET NULL"), index=True
    )
    quote_override_minor: Mapped[int | None] = mapped_column(BigInteger)
    is_optional: Mapped[bool] = mapped_column(Boolean, default=False)

    event: Mapped[Event] = relationship(back_populates="budget_items")
    vendor: Mapped[Vendor | None] = relationship(back_populates="budget_items")


class Guest(Base):
    __tablename__ = "guests"
    __table_args__ = (CheckConstraint("party_size >= 0", name="ck_guests_party_size"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    event_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("events.id", ondelete="CASCADE"), index=True
    )
    full_name: Mapped[str] = mapped_column(String(160))
    party_size: Mapped[int] = mapped_column(Integer, default=1)
    dietary_tags: Mapped[str | None] = mapped_column(String(255))
    accessibility_notes: Mapped[str | None] = mapped_column(Text)
    email: Mapped[str | None] = mapped_column(String(320))
    phone: Mapped[str | None] = mapped_column(String(40))
    notes: Mapped[str | None] = mapped_column(Text)

    event: Mapped[Event] = relationship(back_populates="guests")


class Vendor(TimestampMixin, Base):
    __tablename__ = "vendors"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    event_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("events.id", ondelete="CASCADE"), index=True
    )
    name: Mapped[str] = mapped_column(String(160))
    category: Mapped[str] = mapped_column(String(60))
    contact_name: Mapped[str | None] = mapped_column(String(120))
    email: Mapped[str | None] = mapped_column(String(320))
    phone: Mapped[str | None] = mapped_column(String(40))
    status: Mapped[str] = mapped_column(String(30), default="considering")

    event: Mapped[Event] = relationship(back_populates="vendors")
    quotes: Mapped[list[Quote]] = relationship(
        back_populates="vendor", cascade="all, delete-orphan"
    )
    budget_items: Mapped[list[BudgetItem]] = relationship(back_populates="vendor")


class Quote(TimestampMixin, Base):
    __tablename__ = "quotes"
    __table_args__ = (
        CheckConstraint("amount_minor >= 0", name="ck_quotes_amount"),
        CheckConstraint(
            "status IN ('estimated','quoted','confirmed','declined')", name="ck_quotes_status"
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    event_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("events.id", ondelete="CASCADE"), index=True
    )
    vendor_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("vendors.id", ondelete="CASCADE"), index=True
    )
    budget_item_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("budget_items.id", ondelete="SET NULL"), index=True
    )
    amount_minor: Mapped[int] = mapped_column(BigInteger)
    inclusions: Mapped[str | None] = mapped_column(Text)
    exclusions: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(20), default="quoted")
    valid_until: Mapped[date | None] = mapped_column(Date)

    vendor: Mapped[Vendor] = relationship(back_populates="quotes")


class Task(Base):
    __tablename__ = "tasks"
    __table_args__ = (
        CheckConstraint(
            "status IN ('todo','in_progress','done','cancelled')", name="ck_tasks_status"
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    event_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("events.id", ondelete="CASCADE"), index=True
    )
    title: Mapped[str] = mapped_column(String(160))
    status: Mapped[str] = mapped_column(String(20), default="todo")
    due_date: Mapped[date] = mapped_column(Date)
    offset_days: Mapped[int | None] = mapped_column(Integer)
    is_locked: Mapped[bool] = mapped_column(Boolean, default=False)

    event: Mapped[Event] = relationship(back_populates="tasks")


class TaskDependency(Base):
    __tablename__ = "task_dependencies"
    __table_args__ = (
        CheckConstraint("predecessor_id <> successor_id", name="ck_task_dep_not_self"),
    )

    predecessor_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("tasks.id", ondelete="CASCADE"), primary_key=True
    )
    successor_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("tasks.id", ondelete="CASCADE"), primary_key=True
    )


class Proposal(Base):
    __tablename__ = "proposals"
    __table_args__ = (
        CheckConstraint(
            "status IN ('draft','approved','rejected')", name="ck_proposals_status"
        ),
        UniqueConstraint("event_id", "id", name="uq_proposals_event_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    event_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("events.id", ondelete="CASCADE"), index=True
    )
    status: Mapped[str] = mapped_column(String(20), default="draft")
    base_version: Mapped[int] = mapped_column(Integer)
    scenario: Mapped[dict[str, Any]] = mapped_column(JSONB)
    impact: Mapped[dict[str, Any]] = mapped_column(JSONB)
    alternatives: Mapped[list[dict[str, Any]]] = mapped_column(JSONB, default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    decided_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    revision_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))

    event: Mapped[Event] = relationship(back_populates="proposals")


class Revision(Base):
    __tablename__ = "revisions"
    __table_args__ = (UniqueConstraint("event_id", "version", name="uq_revisions_event_version"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    event_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("events.id", ondelete="CASCADE"), index=True
    )
    proposal_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    version: Mapped[int] = mapped_column(Integer)
    before_json: Mapped[dict[str, Any]] = mapped_column(JSONB)
    after_json: Mapped[dict[str, Any]] = mapped_column(JSONB)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    actor_user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True))

    event: Mapped[Event] = relationship(back_populates="revisions")


class ConsentRecord(Base):
    __tablename__ = "consent_records"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    provider: Mapped[str] = mapped_column(String(40))
    policy_version: Mapped[str] = mapped_column(String(20))
    granted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class IdempotencyRecord(Base):
    """Completed response for a client retry, scoped to one user and mutation."""

    __tablename__ = "idempotency_records"
    __table_args__ = (
        UniqueConstraint(
            "user_id",
            "scope_key",
            "method",
            "endpoint",
            "idempotency_key",
            name="uq_idempotency_scope",
        ),
        Index("ix_idempotency_expires", "expires_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    event_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("events.id", ondelete="CASCADE"), index=True
    )
    # Event UUID for event-scoped writes, "account" for event creation.
    scope_key: Mapped[str] = mapped_column(String(64))
    method: Mapped[str] = mapped_column(String(10))
    endpoint: Mapped[str] = mapped_column(String(80))
    idempotency_key: Mapped[str] = mapped_column(String(255))
    request_hash: Mapped[str] = mapped_column(String(64))
    response_status: Mapped[int | None] = mapped_column(Integer)
    response_body: Mapped[dict[str, Any] | None] = mapped_column(JSONB)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
