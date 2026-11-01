"""AI endpoints. Explanations only; no endpoint applies an AI result."""

from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..ai import orchestration
from ..db import get_db
from ..models import User
from ..schemas import ConsentIn, DirectionsIn, ExplainIn, PreferencesIn
from ..services import planning_service as planning
from .common import owned_event, parse_uuid
from .deps import csrf_guard, get_current_user

router = APIRouter(tags=["ai"], dependencies=[Depends(csrf_guard)])


@router.get("/ai/status")
def ai_status(
    db: Session = Depends(get_db), user: User = Depends(get_current_user)
) -> dict:
    return orchestration.status_payload(db, user)


@router.post("/ai/consent", status_code=201)
def grant_consent(
    payload: ConsentIn,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    record = orchestration.grant_consent(db, user, payload.policy_version)
    return {
        "provider": "gemini",
        "policy_version": record.policy_version,
        "granted_at": record.granted_at.isoformat(),
        "revoked": False,
    }


@router.delete("/ai/consent")
def revoke_consent(
    db: Session = Depends(get_db), user: User = Depends(get_current_user)
) -> dict:
    count = orchestration.revoke_consent(db, user.id)
    return {"revoked": count, "consent_granted": False}


@router.post("/events/{event_id}/ai/explain")
async def explain(
    event_id: str,
    payload: ExplainIn,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    event = owned_event(db, user, parse_uuid(event_id))
    change = planning.change_from_input(payload.change)
    return await orchestration.explain_impact(db, user, event, change)


@router.post("/events/{event_id}/ai/preferences")
async def preferences(
    event_id: str,
    payload: PreferencesIn,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    event = owned_event(db, user, parse_uuid(event_id))
    return await orchestration.interpret_preferences(db, user, event, payload.text)


@router.post("/events/{event_id}/ai/directions")
async def directions(
    event_id: str,
    payload: DirectionsIn,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    event = owned_event(db, user, parse_uuid(event_id))
    change = planning.change_from_input(payload.change)
    return await orchestration.propose_directions(db, user, event, change)
