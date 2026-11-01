"""Events, ceremonies, budget items, guests, tasks, vendors, and quotes."""

from __future__ import annotations

from datetime import date, timedelta

from fastapi import APIRouter, Depends, Header, Query, Response, status
from fastapi.responses import JSONResponse
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..db import get_db
from ..domain.planning import Dependency, Task, detect_cycle
from ..models import (
    BudgetItem,
    Ceremony,
    Event,
    Guest,
    Quote,
    TaskDependency,
    User,
    Vendor,
)
from ..models import (
    Task as TaskRow,
)
from ..schemas import (
    BudgetItemIn,
    BudgetItemPatch,
    CeremonyIn,
    DependencyIn,
    EventCreate,
    EventUpdate,
    GuestIn,
    QuoteIn,
    TaskIn,
    TaskPatch,
    VendorIn,
)
from ..services import planning_service as planning
from .common import owned_event, parse_uuid
from .deps import csrf_guard, get_current_user
from .errors import api_error
from .idempotency import run_idempotent

router = APIRouter(
    prefix="/events", tags=["events"], dependencies=[Depends(csrf_guard)]
)


def _event_detail(db: Session, event: Event) -> dict:
    items = db.scalars(
        select(BudgetItem)
        .where(BudgetItem.event_id == event.id)
        .order_by(BudgetItem.category, BudgetItem.label)
    ).all()
    tasks = db.scalars(
        select(TaskRow).where(TaskRow.event_id == event.id).order_by(TaskRow.due_date)
    ).all()
    vendors = db.scalars(
        select(Vendor).where(Vendor.event_id == event.id).order_by(Vendor.category, Vendor.name)
    ).all()
    quotes = db.scalars(
        select(Quote).where(Quote.event_id == event.id).order_by(Quote.created_at.desc())
    ).all()
    ceremonies = db.scalars(
        select(Ceremony).where(Ceremony.event_id == event.id).order_by(Ceremony.ceremony_date)
    ).all()
    return {
        "event": planning.event_dto(event),
        "ceremonies": [
            {
                "id": str(c.id),
                "name": c.name,
                "ceremony_date": c.ceremony_date.isoformat(),
                "guest_count": c.guest_count,
                "venue": c.venue,
            }
            for c in ceremonies
        ],
        "items": [
            {
                "id": str(i.id),
                "category": i.category,
                "label": i.label,
                "basis": i.basis,
                "unit_amount_minor": i.unit_amount_minor,
                "quantity": i.quantity,
                "vendor_id": str(i.vendor_id) if i.vendor_id else None,
                "quote_override_minor": i.quote_override_minor,
                "is_optional": i.is_optional,
            }
            for i in items
        ],
        "tasks": [
            {
                "id": str(t.id),
                "title": t.title,
                "status": t.status,
                "due_date": t.due_date.isoformat(),
                "offset_days": t.offset_days,
                "is_locked": t.is_locked,
            }
            for t in tasks
        ],
        "vendors": [
            {
                "id": str(v.id),
                "name": v.name,
                "category": v.category,
                "contact_name": v.contact_name,
                "email": v.email,
                "phone": v.phone,
                "status": v.status,
            }
            for v in vendors
        ],
        "quotes": [
            {
                "id": str(q.id),
                "vendor_id": str(q.vendor_id),
                "budget_item_id": str(q.budget_item_id) if q.budget_item_id else None,
                "amount_minor": q.amount_minor,
                "inclusions": q.inclusions,
                "exclusions": q.exclusions,
                "status": q.status,
                "valid_until": q.valid_until.isoformat() if q.valid_until else None,
            }
            for q in quotes
        ],
        "totals": planning.compute_totals(planning.build_snapshot(db, event)).as_dict(),
    }


@router.get("")
def list_events(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0, le=1_000_000),
) -> dict:
    total = db.scalar(
        select(func.count()).select_from(Event).where(Event.user_id == user.id)
    ) or 0
    events = db.scalars(
        select(Event)
        .where(Event.user_id == user.id)
        .order_by(Event.created_at.desc(), Event.id)
        .offset(offset)
        .limit(limit)
    ).all()
    return {
        "items": [planning.event_dto(event) for event in events],
        "total": int(total),
        "limit": limit,
        "offset": offset,
    }


@router.post("", status_code=status.HTTP_201_CREATED)
def create_event(
    payload: EventCreate,
    idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> JSONResponse:
    def action() -> dict:
        event = Event(
            user_id=user.id,
            name=payload.name,
            event_type=payload.event_type,
            city=payload.city,
            event_date=payload.event_date,
            guest_count=payload.guest_count,
            budget_minor=payload.budget_minor,
            reserve_minor=payload.reserve_minor,
            currency=payload.currency,
            version=1,
        )
        db.add(event)
        db.flush()
        db.refresh(event)
        return planning.event_dto(event)

    return run_idempotent(
        db=db,
        user_id=user.id,
        event_id=None,
        endpoint="events.create",
        key=idempotency_key,
        payload=payload,
        action=action,
    )


@router.get("/{event_id}")
def get_event(
    event_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    event = owned_event(db, user, parse_uuid(event_id))
    return _event_detail(db, event)


@router.patch("/{event_id}")
def update_event(
    event_id: str,
    payload: EventUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    event = owned_event(db, user, parse_uuid(event_id), lock=True)
    if payload.guest_count is not None and payload.guest_count != event.guest_count:
        raise api_error(
            422,
            "guest_count_requires_proposal",
            "Change the guest count through simulation and an approved proposal, "
            "so the impact is reviewed before it is persisted.",
        )
    if payload.event_date is not None and payload.event_date != event.event_date:
        raise api_error(
            422,
            "event_date_requires_proposal",
            "Change the event date through simulation and an approved proposal, "
            "so task and ceremony dates move together.",
        )
    if event.version != payload.expected_version:
        raise api_error(
            409,
            "version_conflict",
            "This event changed since you loaded it. Refresh and try again.",
            {"expected_version": event.version},
        )

    if payload.name is not None:
        event.name = payload.name
    if payload.event_type is not None:
        event.event_type = payload.event_type
    if payload.city is not None:
        event.city = payload.city
    if payload.event_date is not None:
        event.event_date = payload.event_date
    if payload.budget_minor is not None:
        event.budget_minor = payload.budget_minor
    if payload.reserve_minor is not None:
        event.reserve_minor = payload.reserve_minor

    if event.reserve_minor > event.budget_minor:
        db.rollback()
        raise api_error(422, "invalid_reserve", "Reserve cannot exceed the budget")

    event.version = event.version + 1
    db.commit()
    db.refresh(event)
    return planning.event_dto(event)


@router.delete("/{event_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_event(
    event_id: str,
    response: Response,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> None:
    event = owned_event(db, user, parse_uuid(event_id))
    db.delete(event)
    db.commit()
    response.status_code = status.HTTP_204_NO_CONTENT


@router.post("/{event_id}/ceremonies", status_code=status.HTTP_201_CREATED)
def add_ceremony(
    event_id: str,
    payload: CeremonyIn,
    idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> JSONResponse:
    event = owned_event(db, user, parse_uuid(event_id), lock=True)

    def action() -> dict:
        ceremony = Ceremony(
            event_id=event.id,
            name=payload.name,
            ceremony_date=payload.ceremony_date,
            guest_count=payload.guest_count,
            venue=payload.venue,
        )
        db.add(ceremony)
        db.flush()
        db.refresh(ceremony)
        return {
            "id": str(ceremony.id),
            "name": ceremony.name,
            "ceremony_date": ceremony.ceremony_date.isoformat(),
            "guest_count": ceremony.guest_count,
            "venue": ceremony.venue,
        }

    return run_idempotent(
        db=db,
        user_id=user.id,
        event_id=event.id,
        endpoint="ceremonies.create",
        key=idempotency_key,
        payload=payload,
        action=action,
    )


@router.post("/{event_id}/budget-items", status_code=status.HTTP_201_CREATED)
def add_budget_item(
    event_id: str,
    payload: BudgetItemIn,
    idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> JSONResponse:
    event = owned_event(db, user, parse_uuid(event_id), lock=True)

    def action() -> dict:
        if payload.vendor_id is not None:
            vendor = db.scalar(
                select(Vendor).where(
                    Vendor.id == payload.vendor_id, Vendor.event_id == event.id
                )
            )
            if vendor is None:
                raise api_error(
                    422, "unknown_vendor", "Vendor does not belong to this event"
                )
        item = BudgetItem(
            event_id=event.id,
            category=payload.category,
            label=payload.label,
            basis=payload.basis,
            unit_amount_minor=payload.unit_amount_minor,
            quantity=payload.quantity,
            vendor_id=payload.vendor_id,
            is_optional=payload.is_optional,
        )
        db.add(item)
        db.flush()
        db.refresh(item)
        return {
            "id": str(item.id),
            "category": item.category,
            "label": item.label,
            "basis": item.basis,
            "unit_amount_minor": item.unit_amount_minor,
            "quantity": item.quantity,
            "vendor_id": str(item.vendor_id) if item.vendor_id else None,
            "quote_override_minor": item.quote_override_minor,
            "is_optional": item.is_optional,
        }

    return run_idempotent(
        db=db,
        user_id=user.id,
        event_id=event.id,
        endpoint="budget_items.create",
        key=idempotency_key,
        payload=payload,
        action=action,
    )


@router.patch("/{event_id}/budget-items/{item_id}")
def update_budget_item(
    event_id: str,
    item_id: str,
    payload: BudgetItemPatch,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    event = owned_event(db, user, parse_uuid(event_id), lock=True)
    item = db.scalar(
        select(BudgetItem).where(
            BudgetItem.id == parse_uuid(item_id, "budget item"),
            BudgetItem.event_id == event.id,
        )
    )
    if item is None:
        raise api_error(404, "not_found", "Budget item not found")
    if payload.unit_amount_minor is not None:
        item.unit_amount_minor = payload.unit_amount_minor
    if payload.quantity is not None:
        item.quantity = payload.quantity
    db.commit()
    db.refresh(item)
    return {
        "id": str(item.id),
        "unit_amount_minor": item.unit_amount_minor,
        "quantity": item.quantity,
    }


@router.get("/{event_id}/guests")
def list_guests(
    event_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    event = owned_event(db, user, parse_uuid(event_id))
    guests = db.scalars(
        select(Guest).where(Guest.event_id == event.id).order_by(Guest.full_name)
    ).all()
    return {
        "items": [
            {
                "id": str(g.id),
                "full_name": g.full_name,
                "party_size": g.party_size,
                "dietary_tags": g.dietary_tags,
                "accessibility_notes": g.accessibility_notes,
                "email": g.email,
                "phone": g.phone,
                "notes": g.notes,
            }
            for g in guests
        ]
    }


@router.post("/{event_id}/guests", status_code=status.HTTP_201_CREATED)
def add_guest(
    event_id: str,
    payload: GuestIn,
    idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> JSONResponse:
    event = owned_event(db, user, parse_uuid(event_id))

    def action() -> dict:
        guest = Guest(event_id=event.id, **payload.model_dump())
        db.add(guest)
        db.flush()
        db.refresh(guest)
        return {
            "id": str(guest.id),
            "full_name": guest.full_name,
            "party_size": guest.party_size,
        }

    return run_idempotent(
        db=db,
        user_id=user.id,
        event_id=event.id,
        endpoint="guests.create",
        key=idempotency_key,
        payload=payload,
        action=action,
    )


@router.post("/{event_id}/tasks", status_code=status.HTTP_201_CREATED)
def add_task(
    event_id: str,
    payload: TaskIn,
    idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> JSONResponse:
    event = owned_event(db, user, parse_uuid(event_id), lock=True)

    def action() -> dict:
        due_date = payload.due_date
        if payload.offset_days is not None:
            try:
                due_date = event.event_date + timedelta(days=payload.offset_days)
            except OverflowError:
                raise api_error(
                    422,
                    "date_out_of_range",
                    "The task date is outside the supported range",
                ) from None
        task = TaskRow(
            event_id=event.id,
            title=payload.title,
            status=payload.status,
            due_date=due_date,
            offset_days=payload.offset_days,
            is_locked=payload.is_locked,
        )
        db.add(task)
        db.flush()
        db.refresh(task)
        return {
            "id": str(task.id),
            "title": task.title,
            "status": task.status,
            "due_date": task.due_date.isoformat(),
            "offset_days": task.offset_days,
            "is_locked": task.is_locked,
        }

    return run_idempotent(
        db=db,
        user_id=user.id,
        event_id=event.id,
        endpoint="tasks.create",
        key=idempotency_key,
        payload=payload,
        action=action,
    )


@router.patch("/{event_id}/tasks/{task_id}")
def update_task(
    event_id: str,
    task_id: str,
    payload: TaskPatch,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    event = owned_event(db, user, parse_uuid(event_id), lock=True)
    task = db.scalar(
        select(TaskRow).where(
            TaskRow.id == parse_uuid(task_id, "task"), TaskRow.event_id == event.id
        )
    )
    if task is None:
        raise api_error(404, "not_found", "Task not found")
    if payload.status is not None:
        task.status = payload.status
    if payload.is_locked is not None:
        task.is_locked = payload.is_locked
    if payload.due_date is not None:
        task.due_date = payload.due_date
        task.offset_days = (payload.due_date - event.event_date).days
    db.commit()
    db.refresh(task)
    return {
        "id": str(task.id),
        "status": task.status,
        "due_date": task.due_date.isoformat(),
        "is_locked": task.is_locked,
    }


@router.post("/{event_id}/task-dependencies", status_code=status.HTTP_201_CREATED)
def add_dependency(
    event_id: str,
    payload: DependencyIn,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    event = owned_event(db, user, parse_uuid(event_id), lock=True)
    task_ids = {
        row.id
        for row in db.scalars(select(TaskRow).where(TaskRow.event_id == event.id)).all()
    }
    if payload.predecessor_id not in task_ids or payload.successor_id not in task_ids:
        raise api_error(422, "unknown_task", "Both tasks must belong to this event")
    existing = db.scalars(
        select(TaskDependency).where(
            TaskDependency.predecessor_id.in_(task_ids),
            TaskDependency.successor_id.in_(task_ids),
        )
    ).all()
    if any(
        d.predecessor_id == payload.predecessor_id
        and d.successor_id == payload.successor_id
        for d in existing
    ):
        raise api_error(409, "dependency_exists", "That dependency already exists")
    domain_tasks = tuple(
        Task(id=str(task_id), title="", status="todo", due_date=date.today())
        for task_id in task_ids
    )
    deps = tuple(
        Dependency(str(d.predecessor_id), str(d.successor_id)) for d in existing
    ) + (Dependency(str(payload.predecessor_id), str(payload.successor_id)),)
    cycle = detect_cycle(domain_tasks, deps)
    if cycle:
        raise api_error(422, "dependency_cycle", "That dependency would create a cycle")
    db.add(
        TaskDependency(
            predecessor_id=payload.predecessor_id, successor_id=payload.successor_id
        )
    )
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise api_error(409, "dependency_exists", "That dependency already exists") from None
    return {
        "predecessor_id": str(payload.predecessor_id),
        "successor_id": str(payload.successor_id),
    }


@router.post("/{event_id}/vendors", status_code=status.HTTP_201_CREATED)
def add_vendor(
    event_id: str,
    payload: VendorIn,
    idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> JSONResponse:
    event = owned_event(db, user, parse_uuid(event_id))

    def action() -> dict:
        vendor = Vendor(event_id=event.id, **payload.model_dump())
        db.add(vendor)
        db.flush()
        db.refresh(vendor)
        return {"id": str(vendor.id), "name": vendor.name, "category": vendor.category}

    return run_idempotent(
        db=db,
        user_id=user.id,
        event_id=event.id,
        endpoint="vendors.create",
        key=idempotency_key,
        payload=payload,
        action=action,
    )


@router.post("/{event_id}/vendors/{vendor_id}/quotes", status_code=status.HTTP_201_CREATED)
def add_quote(
    event_id: str,
    vendor_id: str,
    payload: QuoteIn,
    idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> JSONResponse:
    event = owned_event(db, user, parse_uuid(event_id), lock=True)
    vendor_uuid = parse_uuid(vendor_id, "vendor")

    def action() -> dict:
        vendor = db.scalar(
            select(Vendor).where(
                Vendor.id == vendor_uuid, Vendor.event_id == event.id
            )
        )
        if vendor is None:
            raise api_error(404, "not_found", "Vendor not found")
        item = None
        if payload.budget_item_id is not None:
            item = db.scalar(
                select(BudgetItem).where(
                    BudgetItem.id == payload.budget_item_id,
                    BudgetItem.event_id == event.id,
                )
            )
            if item is None:
                raise api_error(
                    422,
                    "unknown_budget_item",
                    "Budget item does not belong to this event",
                )
            if item.vendor_id not in (None, vendor.id):
                raise api_error(
                    422, "vendor_mismatch", "Budget item is linked to another vendor"
                )
        quote = Quote(event_id=event.id, vendor_id=vendor.id, **payload.model_dump())
        db.add(quote)
        if item is not None and payload.status == "confirmed":
            item.quote_override_minor = payload.amount_minor
        db.flush()
        db.refresh(quote)
        return {
            "id": str(quote.id),
            "vendor_id": str(quote.vendor_id),
            "budget_item_id": str(quote.budget_item_id) if quote.budget_item_id else None,
            "amount_minor": quote.amount_minor,
            "status": quote.status,
            "applied_to_budget": bool(item and payload.status == "confirmed"),
        }

    return run_idempotent(
        db=db,
        user_id=user.id,
        event_id=event.id,
        endpoint="quotes.create",
        key=idempotency_key,
        payload=payload,
        action=action,
        path_params={"vendor_id": str(vendor_uuid)},
    )


@router.get("/{event_id}/tasks")
def list_tasks(
    event_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    event = owned_event(db, user, parse_uuid(event_id))
    tasks = db.scalars(
        select(TaskRow).where(TaskRow.event_id == event.id).order_by(TaskRow.due_date)
    ).all()
    task_ids = [t.id for t in tasks]
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
    return {
        "items": [
            {
                "id": str(t.id),
                "title": t.title,
                "status": t.status,
                "due_date": t.due_date.isoformat(),
                "offset_days": t.offset_days,
                "is_locked": t.is_locked,
            }
            for t in tasks
        ],
        "dependencies": [
            {"predecessor_id": str(d.predecessor_id), "successor_id": str(d.successor_id)}
            for d in deps
        ],
    }
