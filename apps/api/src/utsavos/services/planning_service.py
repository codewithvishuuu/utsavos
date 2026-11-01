"""Planning service: database snapshots, simulation, proposals, approval.

The engine in ``utsavos.domain.planning`` never sees a Session. This module is
the only place that converts between rows and domain snapshots.
"""

from __future__ import annotations

import hashlib
import json
import uuid
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import select, update
from sqlalchemy.orm import Session

from ..domain.planning import (
    Ceremony,
    Change,
    Dependency,
    InvalidChange,
    Item,
    Snapshot,
    Task,
    compute_totals,
    project_snapshot,
    simulate,
)
from ..models import BudgetItem, Event, Proposal, Revision, TaskDependency
from ..models import Ceremony as CeremonyRow
from ..models import Task as TaskRow
from ..schemas import ChangeIn
from .errors import Conflict, NotFound, Unprocessable

POLICY_VERSION = "2026-10-v1"


def build_snapshot(db: Session, event: Event) -> Snapshot:
    items = db.scalars(
        select(BudgetItem)
        .where(BudgetItem.event_id == event.id)
        .order_by(BudgetItem.category, BudgetItem.label, BudgetItem.id)
    ).all()
    tasks = db.scalars(
        select(TaskRow).where(TaskRow.event_id == event.id).order_by(TaskRow.due_date, TaskRow.id)
    ).all()
    ceremonies = db.scalars(
        select(CeremonyRow)
        .where(CeremonyRow.event_id == event.id)
        .order_by(CeremonyRow.ceremony_date, CeremonyRow.id)
    ).all()
    task_ids = [task.id for task in tasks]
    deps = (
        db.scalars(
            select(TaskDependency).where(
                TaskDependency.predecessor_id.in_(task_ids),
                TaskDependency.successor_id.in_(task_ids),
            )
        ).all()
        if task_ids
        else []
    )
    return Snapshot(
        event_id=str(event.id),
        name=event.name,
        guest_count=event.guest_count,
        budget_minor=event.budget_minor,
        reserve_minor=event.reserve_minor,
        event_date=event.event_date,
        currency=event.currency,
        items=tuple(
            Item(
                id=str(item.id),
                label=item.label,
                category=item.category,
                basis=item.basis,  # type: ignore[arg-type]
                unit_amount_minor=item.unit_amount_minor,
                quantity=item.quantity,
                vendor_id=str(item.vendor_id) if item.vendor_id else None,
                quote_minor=item.quote_override_minor,
                is_optional=item.is_optional,
            )
            for item in items
        ),
        tasks=tuple(
            Task(
                id=str(task.id),
                title=task.title,
                status=task.status,
                due_date=task.due_date,
                offset_days=task.offset_days,
                is_locked=task.is_locked,
            )
            for task in tasks
        ),
        dependencies=tuple(
            Dependency(str(dep.predecessor_id), str(dep.successor_id)) for dep in deps
        ),
        ceremonies=tuple(
            Ceremony(
                id=str(ceremony.id),
                name=ceremony.name,
                ceremony_date=ceremony.ceremony_date,
            )
            for ceremony in ceremonies
        ),
    )


def baseline_hash(snapshot: Snapshot) -> str:
    """Fingerprint every snapshot input that can change a simulation or approval.

    ``event.version`` only tracks event-row writes. Budget items, quotes, tasks
    and dependencies are separate rows, so approval compares this fingerprint
    under the event row lock instead of trusting the version alone.
    """
    payload = {
        "guest_count": snapshot.guest_count,
        "budget_minor": snapshot.budget_minor,
        "reserve_minor": snapshot.reserve_minor,
        "event_date": snapshot.event_date.isoformat(),
        "currency": snapshot.currency,
        "items": [
            {
                "id": item.id,
                "category": item.category,
                "label": item.label,
                "basis": item.basis,
                "unit_amount_minor": item.unit_amount_minor,
                "quantity": item.quantity,
                "vendor_id": item.vendor_id,
                "quote_minor": item.quote_minor,
                "is_optional": item.is_optional,
            }
            for item in sorted(snapshot.items, key=lambda item: item.id)
        ],
        "tasks": [
            {
                "id": task.id,
                "title": task.title,
                "status": task.status,
                "due_date": task.due_date.isoformat(),
                "offset_days": task.offset_days,
                "is_locked": task.is_locked,
            }
            for task in sorted(snapshot.tasks, key=lambda task: task.id)
        ],
        "dependencies": sorted(
            [dep.predecessor_id, dep.successor_id] for dep in snapshot.dependencies
        ),
        "ceremonies": [
            {
                "id": ceremony.id,
                "name": ceremony.name,
                "ceremony_date": ceremony.ceremony_date.isoformat(),
            }
            for ceremony in sorted(snapshot.ceremonies, key=lambda ceremony: ceremony.id)
        ],
    }
    canonical = json.dumps(payload, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def change_from_input(change: ChangeIn) -> Change:
    return Change(
        kind=change.kind,
        guest_count=change.guest_count,
        budget_minor=change.budget_minor,
        reserve_minor=change.reserve_minor,
        event_date=change.event_date,
        item_units=change.item_units,
        quote_totals=change.quote_totals,
    )


def change_from_dict(payload: dict[str, Any]) -> Change:
    from datetime import date

    event_date = payload.get("event_date")
    return Change(
        kind=payload.get("kind", "proposal"),
        guest_count=payload.get("guest_count"),
        budget_minor=payload.get("budget_minor"),
        reserve_minor=payload.get("reserve_minor"),
        event_date=date.fromisoformat(event_date) if isinstance(event_date, str) else event_date,
        item_units=payload.get("item_units"),
    )


def _snapshot_summary(snapshot: Snapshot) -> dict[str, Any]:
    totals = compute_totals(snapshot)
    return {
        "guest_count": snapshot.guest_count,
        "budget_minor": snapshot.budget_minor,
        "reserve_minor": snapshot.reserve_minor,
        "event_date": snapshot.event_date.isoformat(),
        "committed_minor": totals.committed_minor,
        "spendable_minor": totals.spendable_minor,
        "remaining_budget_minor": totals.remaining_budget_minor,
        "remaining_spendable_minor": totals.remaining_spendable_minor,
        "spendable_shortfall_minor": totals.spendable_shortfall_minor,
        "item_units": {item.id: item.unit_amount_minor for item in snapshot.items},
        "task_dates": {task.id: task.due_date.isoformat() for task in snapshot.tasks},
        "ceremony_dates": {
            ceremony.id: ceremony.ceremony_date.isoformat() for ceremony in snapshot.ceremonies
        },
    }


def simulate_change(db: Session, event: Event, change: Change) -> dict[str, Any]:
    snapshot = build_snapshot(db, event)
    result = simulate(snapshot, change)
    payload = result.as_dict()
    payload["event_id"] = str(event.id)
    payload["base_version"] = event.version
    payload["baseline_hash"] = baseline_hash(snapshot)
    payload["vendor_impacts"] = [
        {
            "vendor_id": vendor_id,
            "before_minor": result.baseline.vendor_totals.get(vendor_id, 0),
            "after_minor": result.projected.vendor_totals.get(vendor_id, 0),
            "delta_minor": result.projected.vendor_totals.get(vendor_id, 0)
            - result.baseline.vendor_totals.get(vendor_id, 0),
        }
        for vendor_id in sorted(
            set(result.baseline.vendor_totals) | set(result.projected.vendor_totals)
        )
        if result.baseline.vendor_totals.get(vendor_id)
        != result.projected.vendor_totals.get(vendor_id)
    ]
    return payload


def create_proposal(
    db: Session,
    event: Event,
    change: Change,
    actor: uuid.UUID,
    *,
    expected_base_version: int | None = None,
    expected_baseline_hash: str | None = None,
) -> Proposal:
    del actor
    if change.quote_totals:
        raise Unprocessable(
            "quote_totals_simulation_only",
            "A proposal cannot carry quote_totals. Confirm a quote through the quote endpoint "
            "so the override is persisted with the quote.",
        )
    snapshot = build_snapshot(db, event)
    current_hash = baseline_hash(snapshot)
    if expected_base_version is not None and expected_base_version != event.version:
        raise Conflict(
            "baseline_changed",
            "The event changed after this preview. Simulate again before drafting.",
            {
                "expected_base_version": expected_base_version,
                "current_version": event.version,
                "expected_baseline_hash": expected_baseline_hash,
                "current_baseline_hash": current_hash,
            },
        )
    if expected_baseline_hash is not None and expected_baseline_hash != current_hash:
        raise Conflict(
            "baseline_changed",
            "The plan changed after this preview. Simulate again before drafting.",
            {
                "expected_base_version": expected_base_version,
                "current_version": event.version,
                "expected_baseline_hash": expected_baseline_hash,
                "current_baseline_hash": current_hash,
            },
        )
    try:
        result = simulate(snapshot, change)
    except InvalidChange as exc:
        raise Unprocessable("invalid_change", str(exc)) from None
    if not result.feasible:
        raise Unprocessable(
            "infeasible_proposal",
            "This change is not feasible, so it cannot become a proposal. "
            "Choose one of the computed alternatives instead.",
            {
                "spendable_shortfall_minor": result.projected.spendable_shortfall_minor,
                "remaining_budget_minor": result.projected.remaining_budget_minor,
                "conflicts": [conflict.as_dict() for conflict in result.conflicts],
                "alternatives": [alt.as_dict() for alt in result.alternatives],
            },
        )
    scenario = {
        "kind": change.kind,
        "guest_count": change.guest_count,
        "budget_minor": change.budget_minor,
        "reserve_minor": change.reserve_minor,
        "event_date": change.event_date.isoformat() if change.event_date else None,
        "item_units": change.item_units,
    }
    scenario = {key: value for key, value in scenario.items() if value is not None}

    for existing in db.scalars(
        select(Proposal).where(Proposal.event_id == event.id, Proposal.status == "draft")
    ).all():
        if (
            existing.scenario == scenario
            and existing.base_version == event.version
            and existing.impact.get("baseline_hash") == current_hash
        ):
            raise Conflict(
                "duplicate_proposal",
                "An identical proposal is already waiting for review.",
                {"proposal_id": str(existing.id)},
            )

    impact = result.projected.as_dict()
    impact["baseline_hash"] = current_hash
    proposal = Proposal(
        event_id=event.id,
        status="draft",
        base_version=event.version,
        scenario=scenario,
        impact=impact,
        alternatives=[alt.as_dict() for alt in result.alternatives],
    )
    db.add(proposal)
    db.commit()
    db.refresh(proposal)
    return proposal


def _load_locked_event(db: Session, user_id: uuid.UUID, event_id: uuid.UUID) -> Event:
    event = db.execute(
        select(Event).where(Event.id == event_id, Event.user_id == user_id).with_for_update()
    ).scalar_one_or_none()
    if event is None:
        raise NotFound("Event not found")
    return event


def approve_proposal(
    db: Session, user_id: uuid.UUID, event_id: uuid.UUID, proposal_id: uuid.UUID
) -> tuple[Proposal, Revision, bool]:
    """Atomically apply a proposal. Returns (proposal, revision, idempotent_replay)."""
    event = db.execute(
        select(Event).where(Event.id == event_id, Event.user_id == user_id).with_for_update()
    ).scalar_one_or_none()
    if event is None:
        raise NotFound("Event not found")

    proposal = db.get(Proposal, proposal_id)
    if proposal is None or proposal.event_id != event.id:
        raise NotFound("Proposal not found")

    if proposal.status == "approved":
        revision = db.get(Revision, proposal.revision_id) if proposal.revision_id else None
        if revision is None:  # pragma: no cover - invariant violation
            raise Conflict("inconsistent_proposal", "Approved proposal has no revision")
        return proposal, revision, True
    if proposal.status == "rejected":
        raise Conflict("proposal_rejected", "This proposal was rejected and cannot be approved")
    if proposal.base_version != event.version:
        raise Conflict(
            "version_conflict",
            "The event changed after this proposal was drafted. Simulate again.",
            {"expected_version": event.version, "proposal_base_version": proposal.base_version},
        )

    snapshot = build_snapshot(db, event)
    stored_hash = proposal.impact.get("baseline_hash")
    if not stored_hash:
        current_hash = baseline_hash(snapshot)
        raise Conflict(
            "baseline_changed",
            "This proposal predates baseline verification. "
            "Simulate again and review the new impact.",
            {
                "proposal_base_version": proposal.base_version,
                "current_version": event.version,
                "proposal_baseline_hash": None,
                "current_baseline_hash": current_hash,
            },
        )
    current_hash = baseline_hash(snapshot)
    if stored_hash != current_hash:
        raise Conflict(
            "baseline_changed",
            "The plan changed after this proposal was drafted, even though the "
            "event version is unchanged. Simulate again and review the new impact.",
            {
                "proposal_base_version": proposal.base_version,
                "current_version": event.version,
                "proposal_baseline_hash": stored_hash,
                "current_baseline_hash": current_hash,
            },
        )
    change = change_from_dict(proposal.scenario)
    try:
        result = simulate(snapshot, change)
    except InvalidChange as exc:
        raise Unprocessable("invalid_change", str(exc)) from None
    if not result.feasible:
        raise Unprocessable(
            "infeasible_proposal",
            "Recomputed constraints reject this proposal.",
            {
                "spendable_shortfall_minor": result.projected.spendable_shortfall_minor,
                "remaining_budget_minor": result.projected.remaining_budget_minor,
                "conflicts": [conflict.as_dict() for conflict in result.conflicts],
            },
        )

    before = _snapshot_summary(snapshot)
    projected, _, _, _ = project_snapshot(snapshot, change)
    after = _snapshot_summary(projected)

    event.guest_count = projected.guest_count
    event.budget_minor = projected.budget_minor
    event.reserve_minor = projected.reserve_minor
    event.event_date = projected.event_date
    event.version = event.version + 1

    for item_id, unit_amount in (change.item_units or {}).items():
        db.execute(
            update(BudgetItem)
            .where(BudgetItem.id == uuid.UUID(item_id), BudgetItem.event_id == event.id)
            .values(unit_amount_minor=unit_amount)
        )
    original_tasks = {task.id: task.due_date for task in snapshot.tasks}
    for task in projected.tasks:
        if original_tasks.get(task.id) != task.due_date:
            db.execute(
                update(TaskRow)
                .where(TaskRow.id == uuid.UUID(task.id), TaskRow.event_id == event.id)
                .values(due_date=task.due_date)
            )
    original_ceremonies = {
        ceremony.id: ceremony.ceremony_date for ceremony in snapshot.ceremonies
    }
    for ceremony in projected.ceremonies:
        if original_ceremonies.get(ceremony.id) != ceremony.ceremony_date:
            db.execute(
                update(CeremonyRow)
                .where(CeremonyRow.id == uuid.UUID(ceremony.id), CeremonyRow.event_id == event.id)
                .values(ceremony_date=ceremony.ceremony_date)
            )

    revision = Revision(
        event_id=event.id,
        proposal_id=proposal.id,
        version=event.version,
        before_json=before,
        after_json=after,
        actor_user_id=user_id,
        created_at=datetime.now(UTC),
    )
    db.add(revision)
    db.flush()

    proposal.status = "approved"
    proposal.decided_at = datetime.now(UTC)
    proposal.revision_id = revision.id
    db.commit()
    db.refresh(proposal)
    db.refresh(revision)
    return proposal, revision, False


def reject_proposal(
    db: Session, user_id: uuid.UUID, event_id: uuid.UUID, proposal_id: uuid.UUID, reason: str | None
) -> Proposal:
    event = db.execute(
        select(Event)
        .where(Event.id == event_id, Event.user_id == user_id)
        .with_for_update()
    ).scalar_one_or_none()
    if event is None:
        raise NotFound("Event not found")
    proposal = db.get(Proposal, proposal_id)
    if proposal is None or proposal.event_id != event.id:
        raise NotFound("Proposal not found")
    if proposal.status == "approved":
        raise Conflict("proposal_approved", "An approved proposal cannot be rejected")
    if proposal.status == "rejected":
        return proposal
    proposal.status = "rejected"
    proposal.decided_at = datetime.now(UTC)
    proposal.impact = {**proposal.impact, "rejection_reason": reason} if reason else proposal.impact
    db.commit()
    db.refresh(proposal)
    return proposal


def event_dto(event: Event) -> dict[str, Any]:
    return {
        "id": str(event.id),
        "name": event.name,
        "event_type": event.event_type,
        "city": event.city,
        "event_date": event.event_date.isoformat(),
        "guest_count": event.guest_count,
        "budget_minor": event.budget_minor,
        "reserve_minor": event.reserve_minor,
        "currency": event.currency,
        "status": event.status,
        "version": event.version,
        "created_at": event.created_at.isoformat() if event.created_at else None,
        "updated_at": event.updated_at.isoformat() if event.updated_at else None,
    }


def proposal_dto(proposal: Proposal) -> dict[str, Any]:
    return {
        "id": str(proposal.id),
        "status": proposal.status,
        "base_version": proposal.base_version,
        "baseline_hash": proposal.impact.get("baseline_hash"),
        "scenario": proposal.scenario,
        "impact": proposal.impact,
        "alternatives": proposal.alternatives,
        "created_at": proposal.created_at.isoformat(),
        "decided_at": proposal.decided_at.isoformat() if proposal.decided_at else None,
        "revision_id": str(proposal.revision_id) if proposal.revision_id else None,
    }


def revision_dto(revision: Revision) -> dict[str, Any]:
    return {
        "id": str(revision.id),
        "version": revision.version,
        "proposal_id": str(revision.proposal_id) if revision.proposal_id else None,
        "before_json": revision.before_json,
        "after_json": revision.after_json,
        "created_at": revision.created_at.isoformat(),
    }
