"""Pydantic v2 request/response schemas. Unknown fields are rejected."""

from __future__ import annotations

import re
import uuid
from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

MAX_MONEY_MINOR = 10**14
MAX_GUESTS = 100_000

Currency = Literal["INR"]
Basis = Literal["fixed", "per_guest"]
QuoteStatus = Literal["estimated", "quoted", "confirmed", "declined"]
TaskStatus = Literal["todo", "in_progress", "done", "cancelled"]

_SAFE_TEXT = re.compile(r"^[^\x00-\x08\x0b\x0c\x0e-\x1f]*$")
_DATE_MIN = date(2000, 1, 1)
_DATE_MAX = date(2100, 12, 31)


def _check_date_range(value: date) -> date:
    if not _DATE_MIN <= value <= _DATE_MAX:
        raise ValueError("date must be between 2000 and 2100")
    return value


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class SignupIn(StrictModel):
    email: str = Field(max_length=320)
    password: str = Field(min_length=10, max_length=128)
    display_name: str | None = Field(default=None, max_length=120)


class LoginIn(StrictModel):
    email: str = Field(max_length=320)
    password: str = Field(min_length=1, max_length=128)


class DeleteAccountIn(StrictModel):
    password: str = Field(min_length=1, max_length=128)


class UserOut(StrictModel):
    id: uuid.UUID
    email: str
    display_name: str | None
    created_at: datetime


class EventCreate(StrictModel):
    name: str = Field(min_length=1, max_length=160)
    event_type: str = Field(default="wedding", min_length=1, max_length=40)
    city: str = Field(min_length=1, max_length=120)
    event_date: date
    guest_count: int = Field(default=0, ge=0, le=MAX_GUESTS)
    budget_minor: int = Field(ge=0, le=MAX_MONEY_MINOR)
    reserve_minor: int = Field(default=0, ge=0, le=MAX_MONEY_MINOR)
    currency: Currency = "INR"

    @field_validator("event_date")
    @classmethod
    def _sane_date(cls, value: date) -> date:
        return _check_date_range(value)

    @model_validator(mode="after")
    def _reserve_within_budget(self) -> EventCreate:
        if self.reserve_minor > self.budget_minor:
            raise ValueError("reserve_minor cannot exceed budget_minor")
        return self


class EventUpdate(StrictModel):
    name: str | None = Field(default=None, min_length=1, max_length=160)
    event_type: str | None = Field(default=None, min_length=1, max_length=40)
    city: str | None = Field(default=None, min_length=1, max_length=120)
    event_date: date | None = None
    guest_count: int | None = Field(default=None, ge=0, le=MAX_GUESTS)
    budget_minor: int | None = Field(default=None, ge=0, le=MAX_MONEY_MINOR)
    reserve_minor: int | None = Field(default=None, ge=0, le=MAX_MONEY_MINOR)
    expected_version: int = Field(ge=1)

    @field_validator("event_date")
    @classmethod
    def _sane_date(cls, value: date | None) -> date | None:
        return None if value is None else _check_date_range(value)

    @model_validator(mode="after")
    def _at_least_one(self) -> EventUpdate:
        fields = {
            self.name,
            self.event_type,
            self.city,
            self.event_date,
            self.guest_count,
            self.budget_minor,
            self.reserve_minor,
        }
        if all(value is None for value in fields):
            raise ValueError("no fields to update")
        return self


class EventOut(StrictModel):
    id: uuid.UUID
    name: str
    event_type: str
    city: str
    event_date: date
    guest_count: int
    budget_minor: int
    reserve_minor: int
    currency: str
    status: str
    version: int
    created_at: datetime
    updated_at: datetime


class CeremonyIn(StrictModel):
    name: str = Field(min_length=1, max_length=120)
    ceremony_date: date
    guest_count: int = Field(default=0, ge=0, le=MAX_GUESTS)
    venue: str | None = Field(default=None, max_length=160)

    @field_validator("ceremony_date")
    @classmethod
    def _sane_date(cls, value: date) -> date:
        return _check_date_range(value)


class BudgetItemIn(StrictModel):
    category: str = Field(min_length=1, max_length=60)
    label: str = Field(min_length=1, max_length=160)
    basis: Basis = "fixed"
    unit_amount_minor: int = Field(ge=0, le=MAX_MONEY_MINOR)
    quantity: int = Field(default=1, ge=1, le=1_000_000)
    vendor_id: uuid.UUID | None = None
    is_optional: bool = False


class BudgetItemPatch(StrictModel):
    unit_amount_minor: int | None = Field(default=None, ge=0, le=MAX_MONEY_MINOR)
    quantity: int | None = Field(default=None, ge=1, le=1_000_000)


class BudgetItemOut(StrictModel):
    id: uuid.UUID
    category: str
    label: str
    basis: str
    unit_amount_minor: int
    quantity: int
    vendor_id: uuid.UUID | None
    quote_override_minor: int | None
    is_optional: bool


class GuestIn(StrictModel):
    full_name: str = Field(min_length=1, max_length=160)
    party_size: int = Field(default=1, ge=0, le=50)
    dietary_tags: str | None = Field(default=None, max_length=255)
    accessibility_notes: str | None = Field(default=None, max_length=1000)
    email: str | None = Field(default=None, max_length=320)
    phone: str | None = Field(default=None, max_length=40)
    notes: str | None = Field(default=None, max_length=2000)

    @field_validator("full_name", "notes", "accessibility_notes", "dietary_tags")
    @classmethod
    def _no_control_chars(cls, value: str | None) -> str | None:
        if value is not None and not _SAFE_TEXT.match(value):
            raise ValueError("value contains control characters")
        return value


class GuestOut(StrictModel):
    id: uuid.UUID
    full_name: str
    party_size: int
    dietary_tags: str | None
    accessibility_notes: str | None
    email: str | None
    phone: str | None
    notes: str | None


class TaskIn(StrictModel):
    title: str = Field(min_length=1, max_length=160)
    due_date: date
    status: TaskStatus = "todo"
    offset_days: int | None = Field(default=None, ge=-3650, le=3650)
    is_locked: bool = False

    @field_validator("due_date")
    @classmethod
    def _sane_date(cls, value: date) -> date:
        return _check_date_range(value)


class TaskOut(StrictModel):
    id: uuid.UUID
    title: str
    status: str
    due_date: date
    offset_days: int | None
    is_locked: bool


class TaskPatch(StrictModel):
    status: TaskStatus | None = None
    is_locked: bool | None = None
    due_date: date | None = None

    @field_validator("due_date")
    @classmethod
    def _sane_date(cls, value: date | None) -> date | None:
        return None if value is None else _check_date_range(value)


class DependencyIn(StrictModel):
    predecessor_id: uuid.UUID
    successor_id: uuid.UUID


class VendorIn(StrictModel):
    name: str = Field(min_length=1, max_length=160)
    category: str = Field(min_length=1, max_length=60)
    contact_name: str | None = Field(default=None, max_length=120)
    email: str | None = Field(default=None, max_length=320)
    phone: str | None = Field(default=None, max_length=40)
    status: str = Field(default="considering", max_length=30)


class QuoteIn(StrictModel):
    amount_minor: int = Field(ge=0, le=MAX_MONEY_MINOR)
    budget_item_id: uuid.UUID | None = None
    inclusions: str | None = Field(default=None, max_length=2000)
    exclusions: str | None = Field(default=None, max_length=2000)
    status: QuoteStatus = "quoted"
    valid_until: date | None = None

    @field_validator("valid_until")
    @classmethod
    def _sane_date(cls, value: date | None) -> date | None:
        return None if value is None else _check_date_range(value)


class ChangeIn(StrictModel):
    kind: Literal["guest_count", "budget", "date", "quote", "items"]
    guest_count: int | None = Field(default=None, ge=0, le=MAX_GUESTS)
    budget_minor: int | None = Field(default=None, ge=0, le=MAX_MONEY_MINOR)
    reserve_minor: int | None = Field(default=None, ge=0, le=MAX_MONEY_MINOR)
    event_date: date | None = None
    item_units: dict[str, int] | None = None
    quote_totals: dict[str, int] | None = None

    @field_validator("event_date")
    @classmethod
    def _sane_date(cls, value: date | None) -> date | None:
        return None if value is None else _check_date_range(value)

    @model_validator(mode="after")
    def _has_payload(self) -> ChangeIn:
        if all(
            value is None
            for value in (
                self.guest_count,
                self.budget_minor,
                self.reserve_minor,
                self.event_date,
                self.item_units,
                self.quote_totals,
            )
        ):
            raise ValueError("change contains no fields")
        return self


class ProposalIn(StrictModel):
    change: ChangeIn
    expected_base_version: int | None = Field(default=None, ge=1)
    expected_baseline_hash: str | None = Field(
        default=None, pattern=r"^[0-9a-f]{64}$"
    )


class RejectIn(StrictModel):
    reason: str | None = Field(default=None, max_length=500)


class ProposalOut(StrictModel):
    id: uuid.UUID
    status: str
    base_version: int
    scenario: dict
    impact: dict
    alternatives: list[dict]
    created_at: datetime
    decided_at: datetime | None
    revision_id: uuid.UUID | None


class RevisionOut(StrictModel):
    id: uuid.UUID
    version: int
    proposal_id: uuid.UUID | None
    before_json: dict
    after_json: dict
    created_at: datetime


class ConsentIn(StrictModel):
    policy_version: str = Field(min_length=1, max_length=20)


class DemoIn(StrictModel):
    scenario: Literal["guests_180_to_240"]


class ExplainIn(StrictModel):
    change: ChangeIn


class PreferencesIn(StrictModel):
    text: str = Field(min_length=3, max_length=1000)


class DirectionsIn(StrictModel):
    change: ChangeIn
