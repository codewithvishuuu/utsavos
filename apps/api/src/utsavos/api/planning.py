"""Planning endpoints: plan snapshot, simulation, proposals, revisions, export."""

from __future__ import annotations

import json
import re
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import (
    Ceremony,
    Guest,
    Proposal,
    Quote,
    Revision,
    TaskDependency,
    User,
    Vendor,
)
from ..schemas import ChangeIn, ProposalIn, RejectIn
from ..services import planning_service as planning
from ..services.errors import Unprocessable
from .common import owned_event, parse_uuid
from .deps import csrf_guard, get_current_user

router = APIRouter(tags=["planning"], dependencies=[Depends(csrf_guard)])


@router.get("/events/{event_id}/plan")
def get_plan(
    event_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    event = owned_event(db, user, parse_uuid(event_id))
    snapshot = planning.build_snapshot(db, event)
    proposal_total = db.scalar(
        select(func.count()).select_from(Proposal).where(Proposal.event_id == event.id)
    ) or 0
    revision_total = db.scalar(
        select(func.count()).select_from(Revision).where(Revision.event_id == event.id)
    ) or 0
    proposals = db.scalars(
        select(Proposal)
        .where(Proposal.event_id == event.id)
        .order_by(Proposal.created_at.desc(), Proposal.id)
        .limit(20)
    ).all()
    revisions = db.scalars(
        select(Revision)
        .where(Revision.event_id == event.id)
        .order_by(Revision.version.desc())
        .limit(50)
    ).all()
    ceremonies = db.scalars(
        select(Ceremony)
        .where(Ceremony.event_id == event.id)
        .order_by(Ceremony.ceremony_date)
    ).all()
    vendors = db.scalars(
        select(Vendor).where(Vendor.event_id == event.id).order_by(Vendor.category, Vendor.name)
    ).all()
    quotes = db.scalars(
        select(Quote).where(Quote.event_id == event.id).order_by(Quote.created_at.desc())
    ).all()
    guests = db.scalars(
        select(Guest).where(Guest.event_id == event.id).order_by(Guest.full_name)
    ).all()
    task_ids = [task.id for task in snapshot.tasks]
    dependencies = (
        db.scalars(
            select(TaskDependency).where(
                TaskDependency.predecessor_id.in_(task_ids),
                TaskDependency.successor_id.in_(task_ids),
            )
        ).all()
        if task_ids
        else []
    )
    return {
        "event": planning.event_dto(event),
        "baseline_hash": planning.baseline_hash(snapshot),
        "totals": planning.compute_totals(snapshot).as_dict(),
        "ceremonies": [
            {
                "id": str(ceremony.id),
                "name": ceremony.name,
                "ceremony_date": ceremony.ceremony_date.isoformat(),
                "guest_count": ceremony.guest_count,
                "venue": ceremony.venue,
            }
            for ceremony in ceremonies
        ],
        "items": [
            {
                "id": item.id,
                "label": item.label,
                "category": item.category,
                "basis": item.basis,
                "unit_amount_minor": item.unit_amount_minor,
                "quantity": item.quantity,
                "vendor_id": item.vendor_id,
                "quote_minor": item.quote_minor,
                "is_optional": item.is_optional,
            }
            for item in snapshot.items
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
            for task in snapshot.tasks
        ],
        "dependencies": [
            {"predecessor_id": dep.predecessor_id, "successor_id": dep.successor_id}
            for dep in dependencies
        ],
        "vendors": [
            {
                "id": str(vendor.id),
                "name": vendor.name,
                "category": vendor.category,
                "contact_name": vendor.contact_name,
                "email": vendor.email,
                "phone": vendor.phone,
                "status": vendor.status,
            }
            for vendor in vendors
        ],
        "quotes": [
            {
                "id": str(quote.id),
                "vendor_id": str(quote.vendor_id),
                "budget_item_id": str(quote.budget_item_id) if quote.budget_item_id else None,
                "amount_minor": quote.amount_minor,
                "inclusions": quote.inclusions,
                "exclusions": quote.exclusions,
                "status": quote.status,
                "valid_until": quote.valid_until.isoformat() if quote.valid_until else None,
            }
            for quote in quotes
        ],
        "guests": [
            {
                "id": str(guest.id),
                "full_name": guest.full_name,
                "party_size": guest.party_size,
                "dietary_tags": guest.dietary_tags,
                "accessibility_notes": guest.accessibility_notes,
                "email": guest.email,
                "phone": guest.phone,
                "notes": guest.notes,
            }
            for guest in guests
        ],
        "proposals": [planning.proposal_dto(proposal) for proposal in proposals],
        "proposal_total": int(proposal_total),
        "revisions": [planning.revision_dto(revision) for revision in revisions],
        "revision_total": int(revision_total),
    }


@router.post("/events/{event_id}/simulate")
def simulate(
    event_id: str,
    payload: ChangeIn,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    event = owned_event(db, user, parse_uuid(event_id))
    return planning.simulate_change(db, event, planning.change_from_input(payload))


@router.post("/events/{event_id}/proposals", status_code=201)
def create_proposal(
    event_id: str,
    payload: ProposalIn,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    event = owned_event(db, user, parse_uuid(event_id))
    change = planning.change_from_input(payload.change)
    proposal = planning.create_proposal(
        db,
        event,
        change,
        user.id,
        expected_base_version=payload.expected_base_version,
        expected_baseline_hash=payload.expected_baseline_hash,
    )
    return planning.proposal_dto(proposal)


@router.get("/events/{event_id}/proposals")
def list_proposals(
    event_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0, le=1_000_000),
) -> dict:
    event = owned_event(db, user, parse_uuid(event_id))
    total = db.scalar(
        select(func.count()).select_from(Proposal).where(Proposal.event_id == event.id)
    ) or 0
    proposals = db.scalars(
        select(Proposal)
        .where(Proposal.event_id == event.id)
        .order_by(Proposal.created_at.desc(), Proposal.id)
        .offset(offset)
        .limit(limit)
    ).all()
    return {
        "items": [planning.proposal_dto(proposal) for proposal in proposals],
        "total": int(total),
        "limit": limit,
        "offset": offset,
    }


@router.post("/events/{event_id}/proposals/{proposal_id}/approve")
def approve(
    event_id: str,
    proposal_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    proposal, revision, replay = planning.approve_proposal(
        db, user.id, parse_uuid(event_id), parse_uuid(proposal_id, "proposal")
    )
    return {
        "proposal": planning.proposal_dto(proposal),
        "revision": planning.revision_dto(revision),
        "idempotent_replay": replay,
    }


@router.post("/events/{event_id}/proposals/{proposal_id}/reject")
def reject(
    event_id: str,
    proposal_id: str,
    payload: RejectIn,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    proposal = planning.reject_proposal(
        db, user.id, parse_uuid(event_id), parse_uuid(proposal_id, "proposal"), payload.reason
    )
    return planning.proposal_dto(proposal)


@router.get("/events/{event_id}/revisions")
def list_revisions(
    event_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0, le=1_000_000),
) -> dict:
    event = owned_event(db, user, parse_uuid(event_id))
    total = db.scalar(
        select(func.count()).select_from(Revision).where(Revision.event_id == event.id)
    ) or 0
    revisions = db.scalars(
        select(Revision)
        .where(Revision.event_id == event.id)
        .order_by(Revision.version.desc())
        .offset(offset)
        .limit(limit)
    ).all()
    return {
        "items": [planning.revision_dto(revision) for revision in revisions],
        "total": int(total),
        "limit": limit,
        "offset": offset,
    }


def _slug(name: str) -> str:
    cleaned = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
    return cleaned[:50] or "plan"


@router.get("/events/{event_id}/export")
def export_plan(
    event_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> Response:
    event = owned_event(db, user, parse_uuid(event_id))
    snapshot = planning.build_snapshot(db, event)
    revisions = db.scalars(
        select(Revision).where(Revision.event_id == event.id).order_by(Revision.version)
    ).all()
    payload = {
        "format": "utsavos.plan.v1",
        "exported_at": datetime.now(UTC).isoformat(),
        "event": planning.event_dto(event),
        "totals": planning.compute_totals(snapshot).as_dict(),
        "items": [
            {
                "id": item.id,
                "label": item.label,
                "category": item.category,
                "basis": item.basis,
                "unit_amount_minor": item.unit_amount_minor,
                "quantity": item.quantity,
                "quote_minor": item.quote_minor,
            }
            for item in snapshot.items
        ],
        "tasks": [
            {
                "id": task.id,
                "title": task.title,
                "status": task.status,
                "due_date": task.due_date.isoformat(),
                "offset_days": task.offset_days,
            }
            for task in snapshot.tasks
        ],
        "revisions": [planning.revision_dto(revision) for revision in revisions],
    }
    _validate_export(payload)
    body = json.dumps(payload, indent=2, default=str)
    filename = f"utsavos-{_slug(event.name)}-v{event.version}.json"
    return Response(
        content=body,
        media_type="application/json",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


def _validate_export(payload: dict) -> None:
    required = {"format", "exported_at", "event", "totals", "items", "tasks", "revisions"}
    if set(payload) != required:
        raise Unprocessable("export_invalid", "Export payload failed its own schema check")
    if not isinstance(payload["items"], list) or not isinstance(payload["tasks"], list):
        raise Unprocessable("export_invalid", "Export payload failed its own schema check")
    for item in payload["items"]:
        if not isinstance(item["unit_amount_minor"], int):
            raise Unprocessable("export_invalid", "Money must be an integer number of paise")
