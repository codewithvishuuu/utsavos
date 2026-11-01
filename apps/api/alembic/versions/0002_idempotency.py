"""Idempotency records for mutation retries.

Revision ID: 0002_idempotency
Revises: 0001_initial
Create Date: 2026-10-26

shortcut: 0001 creates the schema from current SQLAlchemy metadata, so a fresh
database already has this table. The existence check keeps existing 0001
databases and fresh installs on the same path. Replace 0001 with explicit
operations before the next destructive migration.
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0002_idempotency"
down_revision = "0001_initial"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    if "idempotency_records" in sa.inspect(bind).get_table_names():
        return
    op.create_table(
        "idempotency_records",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "event_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("events.id", ondelete="CASCADE"),
            nullable=True,
        ),
        sa.Column("scope_key", sa.String(length=64), nullable=False),
        sa.Column("method", sa.String(length=10), nullable=False),
        sa.Column("endpoint", sa.String(length=80), nullable=False),
        sa.Column("idempotency_key", sa.String(length=255), nullable=False),
        sa.Column("request_hash", sa.String(length=64), nullable=False),
        sa.Column("response_status", sa.Integer(), nullable=True),
        sa.Column("response_body", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint(
            "user_id",
            "scope_key",
            "method",
            "endpoint",
            "idempotency_key",
            name="uq_idempotency_scope",
        ),
    )
    op.create_index(
        "ix_idempotency_records_user_id", "idempotency_records", ["user_id"]
    )
    op.create_index(
        "ix_idempotency_records_event_id", "idempotency_records", ["event_id"]
    )
    op.create_index("ix_idempotency_expires", "idempotency_records", ["expires_at"])


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "idempotency_records" not in inspector.get_table_names():
        return
    indexes = {index["name"] for index in inspector.get_indexes("idempotency_records")}
    for name in (
        "ix_idempotency_expires",
        "ix_idempotency_records_event_id",
        "ix_idempotency_records_user_id",
    ):
        if name in indexes:
            op.drop_index(name, table_name="idempotency_records")
    op.drop_table("idempotency_records")
