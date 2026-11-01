"""Public demo fixture: synthetic, versioned, validated at startup."""

from __future__ import annotations

import json
from datetime import date
from functools import lru_cache
from pathlib import Path

from pydantic import BaseModel, ConfigDict, Field, model_validator

from ..domain.planning import Change, Dependency, Item, Snapshot, Task, compute_totals, simulate

FIXTURE_PATH = Path(__file__).with_name("fixture.json")


class _Strict(BaseModel):
    model_config = ConfigDict(extra="forbid")


class FixtureEvent(_Strict):
    name: str
    city: str
    event_date: date
    guest_count: int = Field(ge=0, le=100_000)
    budget_minor: int = Field(ge=0)
    reserve_minor: int = Field(ge=0)
    currency: str = "INR"


class FixtureItem(_Strict):
    id: str
    label: str
    category: str
    basis: str
    unit_amount_minor: int = Field(ge=0)
    quantity: int = Field(ge=0)
    vendor_id: str | None = None


class FixtureTask(_Strict):
    id: str
    title: str
    status: str
    due_date: date
    offset_days: int | None = None
    is_locked: bool = False


class FixtureDependency(_Strict):
    predecessor_id: str
    successor_id: str


class FixtureScenario(_Strict):
    kind: str
    guest_count: int
    label: str


class Fixture(_Strict):
    id: str
    version: int
    disclaimer: str
    persona: dict
    event: FixtureEvent
    items: list[FixtureItem]
    tasks: list[FixtureTask]
    dependencies: list[FixtureDependency]
    scenario: FixtureScenario

    @model_validator(mode="after")
    def _consistent(self) -> Fixture:
        item_ids = [item.id for item in self.items]
        if len(set(item_ids)) != len(item_ids):
            raise ValueError("duplicate item ids")
        task_ids = {task.id for task in self.tasks}
        for dep in self.dependencies:
            if dep.predecessor_id not in task_ids or dep.successor_id not in task_ids:
                raise ValueError("dependency references an unknown task")
        if self.event.reserve_minor > self.event.budget_minor:
            raise ValueError("reserve exceeds budget")
        return self


@lru_cache
def load_fixture() -> Fixture:
    raw = json.loads(FIXTURE_PATH.read_text(encoding="utf-8"))
    return Fixture.model_validate(raw)


def fixture_snapshot(fixture: Fixture | None = None) -> Snapshot:
    fixture = fixture or load_fixture()
    return Snapshot(
        event_id=fixture.id,
        name=fixture.event.name,
        guest_count=fixture.event.guest_count,
        budget_minor=fixture.event.budget_minor,
        reserve_minor=fixture.event.reserve_minor,
        event_date=fixture.event.event_date,
        currency=fixture.event.currency,
        items=tuple(
            Item(
                id=item.id,
                label=item.label,
                category=item.category,
                basis=item.basis,  # type: ignore[arg-type]
                unit_amount_minor=item.unit_amount_minor,
                quantity=item.quantity,
                vendor_id=item.vendor_id,
            )
            for item in fixture.items
        ),
        tasks=tuple(
            Task(
                id=task.id,
                title=task.title,
                status=task.status,
                due_date=task.due_date,
                offset_days=task.offset_days,
                is_locked=task.is_locked,
            )
            for task in fixture.tasks
        ),
        dependencies=tuple(
            Dependency(dep.predecessor_id, dep.successor_id) for dep in fixture.dependencies
        ),
    )


def scenario_change(fixture: Fixture | None = None) -> Change:
    fixture = fixture or load_fixture()
    kind = fixture.scenario.kind
    if kind == "guest_count":
        return Change(kind="guest_count", guest_count=fixture.scenario.guest_count)
    raise ValueError(f"fixture scenario {kind!r} is not supported")


def run_scenario() -> dict:
    fixture = load_fixture()
    snapshot = fixture_snapshot(fixture)
    result = simulate(snapshot, scenario_change(fixture))
    return {
        "fixture": {
            "id": fixture.id,
            "version": fixture.version,
            "disclaimer": fixture.disclaimer,
            "persona": fixture.persona,
        },
        "scenario": {
            "kind": fixture.scenario.kind,
            "guest_count": fixture.scenario.guest_count,
            "label": fixture.scenario.label,
        },
        "baseline": compute_totals(snapshot).as_dict(),
        "result": result.as_dict(),
        "currency": fixture.event.currency,
    }


def fixture_metadata() -> dict:
    fixture = load_fixture()
    snapshot = fixture_snapshot(fixture)
    return {
        "id": fixture.id,
        "version": fixture.version,
        "disclaimer": fixture.disclaimer,
        "persona": fixture.persona,
        "event": fixture.event.model_dump(mode="json"),
        "scenario": fixture.scenario.model_dump(mode="json"),
        "baseline": compute_totals(snapshot).as_dict(),
        "read_only": True,
    }
