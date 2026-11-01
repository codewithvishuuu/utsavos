"""Adaptive planning engine.

Pure, deterministic functions over an immutable ``Snapshot``. The engine never
touches the database. Both the authenticated API and the public demo call this
module, so there is exactly one source of budget and timeline truth.

Money is integer paise everywhere. No float arithmetic.
"""

from __future__ import annotations

from dataclasses import dataclass, field, replace
from datetime import date, timedelta
from typing import Any, Literal

from .money import ceil_div

Basis = Literal["fixed", "per_guest"]
ChangeKind = Literal["guest_count", "budget", "date", "quote", "items", "proposal"]

MAX_GUESTS = 100_000
MAX_MONEY_MINOR = 10**14


@dataclass(frozen=True)
class Item:
    id: str
    label: str
    category: str
    basis: Basis
    unit_amount_minor: int
    quantity: int = 1
    vendor_id: str | None = None
    quote_minor: int | None = None  # confirmed quote total; overrides basis maths
    is_optional: bool = False


@dataclass(frozen=True)
class Task:
    id: str
    title: str
    status: str
    due_date: date
    offset_days: int | None = None
    is_locked: bool = False


@dataclass(frozen=True)
class Dependency:
    predecessor_id: str
    successor_id: str


@dataclass(frozen=True)
class Ceremony:
    id: str
    name: str
    ceremony_date: date


@dataclass(frozen=True)
class Snapshot:
    event_id: str
    name: str
    guest_count: int
    budget_minor: int
    reserve_minor: int
    event_date: date
    currency: str = "INR"
    items: tuple[Item, ...] = ()
    tasks: tuple[Task, ...] = ()
    dependencies: tuple[Dependency, ...] = ()
    ceremonies: tuple[Ceremony, ...] = ()


@dataclass(frozen=True)
class Totals:
    guest_count: int
    budget_minor: int
    reserve_minor: int
    spendable_minor: int
    fixed_minor: int
    per_guest_minor: int
    committed_minor: int
    per_guest_average_minor: int
    category_totals: dict[str, int] = field(default_factory=dict)
    vendor_totals: dict[str, int] = field(default_factory=dict)

    @property
    def remaining_budget_minor(self) -> int:
        """Total budget minus projected spend; the reserve is still included."""
        return self.budget_minor - self.committed_minor

    @property
    def remaining_spendable_minor(self) -> int:
        """Spendable budget minus projected spend; negative when over budget."""
        return self.spendable_minor - self.committed_minor

    @property
    def over_budget(self) -> bool:
        return self.committed_minor > self.spendable_minor

    @property
    def spendable_shortfall_minor(self) -> int:
        """How far projected spend exceeds the reserve-adjusted spendable budget."""
        return max(0, self.committed_minor - self.spendable_minor)

    def as_dict(self) -> dict[str, Any]:
        return {
            "guest_count": self.guest_count,
            "budget_minor": self.budget_minor,
            "reserve_minor": self.reserve_minor,
            "spendable_minor": self.spendable_minor,
            "fixed_minor": self.fixed_minor,
            "per_guest_minor": self.per_guest_minor,
            "committed_minor": self.committed_minor,
            "remaining_budget_minor": self.remaining_budget_minor,
            "remaining_spendable_minor": self.remaining_spendable_minor,
            "per_guest_average_minor": self.per_guest_average_minor,
            "over_budget": self.over_budget,
            "spendable_shortfall_minor": self.spendable_shortfall_minor,
            "category_totals": dict(sorted(self.category_totals.items())),
            "vendor_totals": dict(sorted(self.vendor_totals.items())),
        }


def item_amount(item: Item, guest_count: int) -> int:
    if item.quote_minor is not None:
        return item.quote_minor
    if item.basis == "per_guest":
        return item.unit_amount_minor * guest_count
    return item.unit_amount_minor * item.quantity


def compute_totals(snapshot: Snapshot) -> Totals:
    fixed = 0
    per_guest = 0
    categories: dict[str, int] = {}
    vendors: dict[str, int] = {}
    for item in snapshot.items:
        amount = item_amount(item, snapshot.guest_count)
        if item.quote_minor is not None or item.basis == "fixed":
            fixed += amount
        else:
            per_guest += amount
        categories[item.category] = categories.get(item.category, 0) + amount
        if item.vendor_id:
            vendors[item.vendor_id] = vendors.get(item.vendor_id, 0) + amount
    committed = fixed + per_guest
    spendable = snapshot.budget_minor - snapshot.reserve_minor
    average = per_guest // snapshot.guest_count if snapshot.guest_count > 0 else 0
    return Totals(
        guest_count=snapshot.guest_count,
        budget_minor=snapshot.budget_minor,
        reserve_minor=snapshot.reserve_minor,
        spendable_minor=spendable,
        fixed_minor=fixed,
        per_guest_minor=per_guest,
        committed_minor=committed,
        per_guest_average_minor=average,
        category_totals=categories,
        vendor_totals=vendors,
    )


@dataclass(frozen=True)
class Change:
    """A proposed edit. Only non-None fields are applied."""

    kind: ChangeKind
    guest_count: int | None = None
    budget_minor: int | None = None
    reserve_minor: int | None = None
    event_date: date | None = None
    item_units: dict[str, int] | None = None
    quote_totals: dict[str, int] | None = None

    def is_empty(self) -> bool:
        return all(
            value is None
            for value in (
                self.guest_count,
                self.budget_minor,
                self.reserve_minor,
                self.event_date,
                self.item_units,
                self.quote_totals,
            )
        )


class InvalidChange(ValueError):
    """Raised when a change violates a domain invariant."""


def apply_change(snapshot: Snapshot, change: Change) -> Snapshot:
    guests = snapshot.guest_count if change.guest_count is None else change.guest_count
    budget = snapshot.budget_minor if change.budget_minor is None else change.budget_minor
    reserve = snapshot.reserve_minor if change.reserve_minor is None else change.reserve_minor
    event_date = snapshot.event_date if change.event_date is None else change.event_date

    if not 0 <= guests <= MAX_GUESTS:
        raise InvalidChange(f"guest_count must be between 0 and {MAX_GUESTS}")
    if not 0 <= budget <= MAX_MONEY_MINOR:
        raise InvalidChange("budget_minor out of range")
    if not 0 <= reserve <= budget:
        raise InvalidChange("reserve_minor must be between 0 and budget_minor")

    items = snapshot.items
    if change.item_units:
        known = {item.id for item in items}
        unknown = set(change.item_units) - known
        if unknown:
            raise InvalidChange(f"unknown budget item ids: {sorted(unknown)}")
        items = tuple(
            replace(item, unit_amount_minor=change.item_units[item.id])
            if item.id in change.item_units
            else item
            for item in items
        )
        if any(item.unit_amount_minor < 0 for item in items):
            raise InvalidChange("unit amounts cannot be negative")

    if change.quote_totals:
        known = {item.id for item in items}
        unknown = set(change.quote_totals) - known
        if unknown:
            raise InvalidChange(f"unknown budget item ids: {sorted(unknown)}")
        for value in change.quote_totals.values():
            if not 0 <= value <= MAX_MONEY_MINOR:
                raise InvalidChange("quote amount out of range")
        items = tuple(
            replace(item, quote_minor=change.quote_totals[item.id])
            if item.id in change.quote_totals
            else item
            for item in items
        )

    return replace(
        snapshot,
        guest_count=guests,
        budget_minor=budget,
        reserve_minor=reserve,
        event_date=event_date,
        items=items,
    )


# --------------------------------------------------------------------------- timeline


def detect_cycle(tasks: tuple[Task, ...], dependencies: tuple[Dependency, ...]) -> list[str] | None:
    """Return a cycle path if one exists. Used before persisting dependencies."""
    graph: dict[str, list[str]] = {task.id: [] for task in tasks}
    for dep in dependencies:
        graph.setdefault(dep.predecessor_id, []).append(dep.successor_id)

    white, grey, black = 0, 1, 2
    colour = dict.fromkeys(graph, white)
    stack: list[str] = []

    def visit(node: str) -> list[str] | None:
        colour[node] = grey
        stack.append(node)
        for nxt in graph.get(node, []):
            if colour.get(nxt, white) == grey:
                start = stack.index(nxt)
                return stack[start:] + [nxt]
            if colour.get(nxt, white) == white:
                found = visit(nxt)
                if found:
                    return found
        stack.pop()
        colour[node] = black
        return None

    for node in graph:
        if colour[node] == white:
            found = visit(node)
            if found:
                return found
    return None


@dataclass(frozen=True)
class TaskChange:
    task_id: str
    title: str
    before: str
    after: str

    def as_dict(self) -> dict[str, str]:
        return {
            "task_id": self.task_id,
            "title": self.title,
            "before": self.before,
            "after": self.after,
        }


@dataclass(frozen=True)
class CeremonyChange:
    ceremony_id: str
    name: str
    before: str
    after: str

    def as_dict(self) -> dict[str, str]:
        return {
            "ceremony_id": self.ceremony_id,
            "name": self.name,
            "before": self.before,
            "after": self.after,
        }


@dataclass(frozen=True)
class Conflict:
    predecessor_id: str
    successor_id: str
    message: str

    def as_dict(self) -> dict[str, str]:
        return {
            "predecessor_id": self.predecessor_id,
            "successor_id": self.successor_id,
            "message": self.message,
        }


def project_timeline(
    snapshot: Snapshot, new_event_date: date
) -> tuple[tuple[Task, ...], list[TaskChange], list[Conflict]]:
    """Shift movable tasks with the event date, then check dependencies."""
    delta = (new_event_date - snapshot.event_date).days
    moved: list[TaskChange] = []
    tasks: list[Task] = []
    for task in snapshot.tasks:
        movable = task.offset_days is not None and task.status != "done" and not task.is_locked
        if movable and delta != 0:
            try:
                new_due = new_event_date + timedelta(days=task.offset_days or 0)
            except OverflowError as exc:
                raise InvalidChange("date shift is outside the supported range") from exc
            if new_due != task.due_date:
                moved.append(
                    TaskChange(
                        task_id=task.id,
                        title=task.title,
                        before=task.due_date.isoformat(),
                        after=new_due.isoformat(),
                    )
                )
            tasks.append(replace(task, due_date=new_due))
        else:
            tasks.append(task)

    by_id = {task.id: task for task in tasks}
    conflicts: list[Conflict] = []
    for dep in snapshot.dependencies:
        pred = by_id.get(dep.predecessor_id)
        succ = by_id.get(dep.successor_id)
        if pred and succ and pred.due_date > succ.due_date:
            conflicts.append(
                Conflict(
                    predecessor_id=pred.id,
                    successor_id=succ.id,
                    message=(
                        f"'{pred.title}' is due {pred.due_date.isoformat()} but must finish "
                        f"before '{succ.title}' ({succ.due_date.isoformat()}), which cannot move."
                    ),
                )
            )
    return tuple(tasks), moved, conflicts


def project_ceremonies(
    snapshot: Snapshot, new_event_date: date
) -> tuple[tuple[Ceremony, ...], list[CeremonyChange]]:
    """Shift every ceremony by the event-date delta, preserving relative spacing."""
    delta = (new_event_date - snapshot.event_date).days
    shifted: list[Ceremony] = []
    changes: list[CeremonyChange] = []
    for ceremony in snapshot.ceremonies:
        try:
            new_date = ceremony.ceremony_date + timedelta(days=delta)
        except OverflowError as exc:
            raise InvalidChange("date shift is outside the supported range") from exc
        if new_date != ceremony.ceremony_date:
            changes.append(
                CeremonyChange(
                    ceremony_id=ceremony.id,
                    name=ceremony.name,
                    before=ceremony.ceremony_date.isoformat(),
                    after=new_date.isoformat(),
                )
            )
        shifted.append(replace(ceremony, ceremony_date=new_date))
    return tuple(shifted), changes


def project_snapshot(
    snapshot: Snapshot, change: Change
) -> tuple[Snapshot, list[TaskChange], list[Conflict], list[CeremonyChange]]:
    """Apply a change and all date-dependent projections used by preview and approval."""
    projected = apply_change(snapshot, change)
    if change.event_date is None or change.event_date == snapshot.event_date:
        return projected, [], [], []

    tasks, task_changes, conflicts = project_timeline(snapshot, change.event_date)
    ceremonies, ceremony_changes = project_ceremonies(snapshot, change.event_date)
    return (
        replace(projected, tasks=tasks, ceremonies=ceremonies),
        task_changes,
        conflicts,
        ceremony_changes,
    )


# --------------------------------------------------------------------------- engine


@dataclass(frozen=True)
class ImpactLine:
    kind: str
    label: str
    before: Any
    after: Any
    delta: Any
    value_type: str = "money"

    def as_dict(self) -> dict[str, Any]:
        return {
            "kind": self.kind,
            "label": self.label,
            "before": self.before,
            "after": self.after,
            "delta": self.delta,
            "value_type": self.value_type,
        }


@dataclass(frozen=True)
class Alternative:
    id: str
    title: str
    summary: str
    changes: dict[str, Any]
    cost_impact_minor: int
    budget_after_minor: int
    committed_after_minor: int
    feasible: bool
    trade_offs: list[str]
    assumptions: list[str]

    def as_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "title": self.title,
            "summary": self.summary,
            "changes": self.changes,
            "cost_impact_minor": self.cost_impact_minor,
            "budget_after_minor": self.budget_after_minor,
            "committed_after_minor": self.committed_after_minor,
            "feasible": self.feasible,
            "trade_offs": self.trade_offs,
            "assumptions": self.assumptions,
        }


@dataclass(frozen=True)
class SimulationResult:
    change_kind: str
    feasible: bool
    baseline: Totals
    projected: Totals
    lines: list[ImpactLine]
    task_changes: list[TaskChange]
    ceremony_changes: list[CeremonyChange]
    conflicts: list[Conflict]
    alternatives: list[Alternative]
    alternative_notes: list[str]
    assumptions: list[str]

    def as_dict(self) -> dict[str, Any]:
        return {
            "change_kind": self.change_kind,
            "feasible": self.feasible,
            "baseline": self.baseline.as_dict(),
            "projected": self.projected.as_dict(),
            "lines": [line.as_dict() for line in self.lines],
            "task_changes": [change.as_dict() for change in self.task_changes],
            "ceremony_changes": [change.as_dict() for change in self.ceremony_changes],
            "conflicts": [conflict.as_dict() for conflict in self.conflicts],
            "alternatives": [alt.as_dict() for alt in self.alternatives],
            "alternative_notes": self.alternative_notes,
            "assumptions": self.assumptions,
        }


def _budget_lines(before: Totals, after: Totals) -> list[ImpactLine]:
    lines = [
        ImpactLine("guests", "Guests", before.guest_count, after.guest_count,
                   after.guest_count - before.guest_count, "count"),
        ImpactLine("budget", "Total budget", before.budget_minor, after.budget_minor,
                   after.budget_minor - before.budget_minor),
        ImpactLine("reserve", "Reserve", before.reserve_minor, after.reserve_minor,
                   after.reserve_minor - before.reserve_minor),
        ImpactLine("spendable", "Spendable after reserve", before.spendable_minor,
                   after.spendable_minor, after.spendable_minor - before.spendable_minor),
        ImpactLine("committed", "Projected spend", before.committed_minor, after.committed_minor,
                   after.committed_minor - before.committed_minor),
        ImpactLine("remaining_budget", "Remaining total budget", before.remaining_budget_minor,
                   after.remaining_budget_minor,
                   after.remaining_budget_minor - before.remaining_budget_minor),
        ImpactLine("remaining_spendable", "Remaining spendable",
                   before.remaining_spendable_minor, after.remaining_spendable_minor,
                   after.remaining_spendable_minor - before.remaining_spendable_minor),
        ImpactLine("spendable_shortfall", "Spendable shortfall",
                   before.spendable_shortfall_minor, after.spendable_shortfall_minor,
                   after.spendable_shortfall_minor - before.spendable_shortfall_minor),
    ]
    return lines


def _item_lines(snapshot: Snapshot, projected: Snapshot) -> list[ImpactLine]:
    before_items = {item.id: item for item in snapshot.items}
    lines: list[ImpactLine] = []
    for item in projected.items:
        previous = before_items.get(item.id)
        if previous is None:
            continue
        before_amount = item_amount(previous, snapshot.guest_count)
        after_amount = item_amount(item, projected.guest_count)
        if before_amount != after_amount:
            lines.append(
                ImpactLine("budget_item", item.label, before_amount, after_amount,
                           after_amount - before_amount)
            )
    return lines


def _vendor_impacts(before: Totals, after: Totals) -> list[dict[str, Any]]:
    impacts = []
    for vendor_id in sorted(set(before.vendor_totals) | set(after.vendor_totals)):
        old = before.vendor_totals.get(vendor_id, 0)
        new = after.vendor_totals.get(vendor_id, 0)
        if old != new:
            impacts.append(
                {
                    "vendor_id": vendor_id,
                    "before_minor": old,
                    "after_minor": new,
                    "delta_minor": new - old,
                }
            )
    return impacts


def _scale_per_guest_items(
    snapshot: Snapshot, target_unit_total: int
) -> dict[str, int] | None:
    """Scale per-guest rates down proportionally with integer floor."""
    scalable = [
        item
        for item in snapshot.items
        if item.basis == "per_guest" and item.quote_minor is None
    ]
    current_total = sum(item.unit_amount_minor for item in scalable)
    if current_total <= 0 or target_unit_total <= 0 or target_unit_total >= current_total:
        return None
    updates: dict[str, int] = {}
    for item in scalable:
        updates[item.id] = (item.unit_amount_minor * target_unit_total) // current_total

    # Integer floor can leave one paise over the target; take it from the largest rate.
    projected = apply_change(snapshot, Change(kind="items", item_units=updates))
    overage = sum(
        item.unit_amount_minor
        for item in projected.items
        if item.basis == "per_guest" and item.quote_minor is None
    ) - target_unit_total
    if overage > 0 and updates:
        largest = max(updates, key=lambda item_id: updates[item_id])
        updates[largest] -= overage
    if any(value < 0 for value in updates.values()):
        return None
    return updates


def build_alternatives(
    snapshot: Snapshot, change: Change, projected: Snapshot
) -> tuple[list[Alternative], list[str]]:
    totals = compute_totals(projected)
    if not totals.over_budget:
        return [], ["The projected plan fits the budget, so no alternatives are required."]

    shortfall = totals.spendable_shortfall_minor
    spendable = totals.spendable_minor
    fixed = totals.fixed_minor
    alternatives: list[Alternative] = []

    def add(alt: Alternative) -> None:
        alternatives.append(alt)

    if totals.reserve_minor >= shortfall and shortfall > 0:
        new_reserve = totals.reserve_minor - shortfall
        changes = {
            "guest_count": projected.guest_count,
            "budget_minor": projected.budget_minor,
            "reserve_minor": new_reserve,
        }
        add(
            Alternative(
                id="release_reserve",
                title=f"Release {shortfall // 100} rupees of the contingency reserve",
                summary="Keep the bigger guest list and spend part of the reserve.",
                changes=changes,
                cost_impact_minor=0,
                budget_after_minor=projected.budget_minor,
                committed_after_minor=totals.committed_minor,
                feasible=True,
                trade_offs=["Less buffer for price changes and last-minute costs."],
                assumptions=["The reserve is uncommitted and may be reallocated."],
            )
        )

    available = spendable - fixed
    guests = projected.guest_count
    if guests > 0 and available >= 0:
        required_unit_total = available // guests
        scalable = [
            item
            for item in projected.items
            if item.basis == "per_guest" and item.quote_minor is None
        ]
        current_unit_total = sum(item.unit_amount_minor for item in scalable)
        updates = _scale_per_guest_items(projected, required_unit_total)
        if updates and current_unit_total > 0:
            percent = ceil_div((current_unit_total - required_unit_total) * 100, current_unit_total)
            trimmed = apply_change(projected, Change(kind="items", item_units=updates))
            trimmed_totals = compute_totals(trimmed)
            if not trimmed_totals.over_budget:
                add(
                    Alternative(
                        id="trim_per_guest",
                        title=f"Renegotiate per-guest rates down by about {percent}%",
                        summary="Keep every guest and ask per-guest suppliers for a lower rate.",
                        changes={
                            "guest_count": projected.guest_count,
                            "budget_minor": projected.budget_minor,
                            "reserve_minor": projected.reserve_minor,
                            "item_units": updates,
                        },
                        cost_impact_minor=(
                            trimmed_totals.committed_minor - totals.committed_minor
                        ),
                        budget_after_minor=projected.budget_minor,
                        committed_after_minor=trimmed_totals.committed_minor,
                        feasible=True,
                        trade_offs=[
                            f"Per-guest rates fall about {percent}%; menu scope may shrink."
                        ],
                        assumptions=["Suppliers will renegotiate rather than hold their rate."],
                    )
                )

    per_guest_unit_total = sum(
        item.unit_amount_minor
        for item in projected.items
        if item.basis == "per_guest" and item.quote_minor is None
    )
    if per_guest_unit_total > 0 and available >= 0:
        max_guests = min(MAX_GUESTS, available // per_guest_unit_total)
        if max_guests < guests:
            reduced = apply_change(
                projected, Change(kind="guest_count", guest_count=max_guests)
            )
            reduced_totals = compute_totals(reduced)
            add(
                Alternative(
                    id="reduce_guests",
                    title=f"Reduce the guest list to {max_guests}",
                    summary="Keep current rates and fit the budget by cutting guests.",
                    changes={
                        "guest_count": max_guests,
                        "budget_minor": projected.budget_minor,
                        "reserve_minor": projected.reserve_minor,
                    },
                    cost_impact_minor=(
                        reduced_totals.committed_minor - totals.committed_minor
                    ),
                    budget_after_minor=projected.budget_minor,
                    committed_after_minor=reduced_totals.committed_minor,
                    feasible=True,
                    trade_offs=[f"{guests - max_guests} invited guests would be removed."],
                    assumptions=["Per-guest unit rates stay unchanged."],
                )
            )

    new_budget = totals.committed_minor + totals.reserve_minor
    add(
        Alternative(
            id="increase_budget",
            title=f"Increase the budget by {shortfall // 100} rupees",
            summary="Keep the plan and cover the shortfall with more money.",
            changes={
                "guest_count": projected.guest_count,
                "budget_minor": new_budget,
                "reserve_minor": projected.reserve_minor,
            },
            cost_impact_minor=0,
            budget_after_minor=new_budget,
            committed_after_minor=totals.committed_minor,
            feasible=True,
            trade_offs=["Spending rises; funding must come from somewhere else."],
            assumptions=["Additional funds are actually available."],
        )
    )

    notes: list[str] = []
    if len(alternatives) < 2:
        notes.append(
            f"Only {len(alternatives)} feasible alternative could be computed from the "
            "allowed levers; no substitute options were invented."
        )
    return alternatives, notes


def simulate(snapshot: Snapshot, change: Change) -> SimulationResult:
    if change.is_empty():
        raise InvalidChange("change contains no fields to apply")
    baseline = compute_totals(snapshot)
    projected, task_changes, conflicts, ceremony_changes = project_snapshot(snapshot, change)
    totals = compute_totals(projected)

    lines = _budget_lines(baseline, totals) + _item_lines(snapshot, projected)

    assumptions: list[str] = ["Integer paise arithmetic; no rounding to whole rupees."]
    if change.event_date is not None and change.event_date != snapshot.event_date:
        assumptions.append("Only unlocked, incomplete tasks with an event-offset move.")
        assumptions.append("Ceremony dates keep their spacing relative to the event date.")

    alternatives, notes = build_alternatives(snapshot, change, projected)

    return SimulationResult(
        change_kind=change.kind,
        feasible=not totals.over_budget and not conflicts,
        baseline=baseline,
        projected=totals,
        lines=lines,
        task_changes=task_changes,
        ceremony_changes=ceremony_changes,
        conflicts=conflicts,
        alternatives=alternatives,
        alternative_notes=notes,
        assumptions=assumptions,
    )


def vendor_impacts(baseline: Totals, projected: Totals) -> list[dict[str, Any]]:
    return _vendor_impacts(baseline, projected)
