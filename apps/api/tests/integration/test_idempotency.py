"""Mutation idempotency against real PostgreSQL transactions."""

from __future__ import annotations

import json
import time
import uuid
from concurrent.futures import ThreadPoolExecutor
from threading import Barrier

from sqlalchemy import func, select
from tests.support import add_task, create_event, headers, signup

from utsavos.api.idempotency import run_idempotent
from utsavos.models import Guest
from utsavos.schemas import GuestIn


def _post(client, path: str, payload: dict, key: str | None = None):
    request_headers = headers(client)
    if key is not None:
        request_headers["Idempotency-Key"] = key
    return client.post(path, json=payload, headers=request_headers)


def test_event_create_replays_same_key(client) -> None:
    signup(client, f"idem-event-{uuid.uuid4().hex[:10]}@example.com")
    key = f"event-{uuid.uuid4()}"
    payload = {
        "name": "Idempotent wedding",
        "event_type": "wedding",
        "city": "Hyderabad",
        "event_date": "2027-02-14",
        "guest_count": 100,
        "budget_minor": 50_000_000,
        "reserve_minor": 5_000_000,
        "currency": "INR",
    }

    first = _post(client, "/api/v1/events", payload, key)
    second = _post(client, "/api/v1/events", payload, key)

    assert first.status_code == 201, first.text
    assert second.status_code == 201, second.text
    assert second.headers["Idempotency-Replayed"] == "true"
    assert first.json()["id"] == second.json()["id"]
    events = client.get("/api/v1/events").json()
    assert events["total"] == 1
    assert [event["id"] for event in events["items"]] == [first.json()["id"]]


def test_prioritized_creates_replay_and_share_no_endpoint_scope(client) -> None:
    signup(client, f"idem-all-{uuid.uuid4().hex[:10]}@example.com")
    event = create_event(client)
    event_id = event["id"]
    key = f"shared-{uuid.uuid4()}"

    guest_payload = {"full_name": "Meera", "party_size": 2}
    first_guest = _post(client, f"/api/v1/events/{event_id}/guests", guest_payload, key)
    second_guest = _post(client, f"/api/v1/events/{event_id}/guests", guest_payload, key)
    assert first_guest.status_code == 201, first_guest.text
    assert second_guest.status_code == 201, second_guest.text
    assert second_guest.headers["Idempotency-Replayed"] == "true"
    assert first_guest.json()["id"] == second_guest.json()["id"]

    task_payload = {
        "title": "Book venue",
        "due_date": "2027-02-01",
        "status": "todo",
        "offset_days": -13,
        "is_locked": False,
    }
    first_task = _post(client, f"/api/v1/events/{event_id}/tasks", task_payload, key)
    second_task = _post(client, f"/api/v1/events/{event_id}/tasks", task_payload, key)
    assert first_task.status_code == 201, first_task.text
    assert second_task.headers["Idempotency-Replayed"] == "true"
    assert first_task.json()["id"] == second_task.json()["id"]

    ceremony_payload = {
        "name": "Mehndi",
        "ceremony_date": "2027-02-12",
        "guest_count": 80,
        "venue": "Home",
    }
    first_ceremony = _post(
        client, f"/api/v1/events/{event_id}/ceremonies", ceremony_payload, key
    )
    second_ceremony = _post(
        client, f"/api/v1/events/{event_id}/ceremonies", ceremony_payload, key
    )
    assert first_ceremony.status_code == 201, first_ceremony.text
    assert second_ceremony.headers["Idempotency-Replayed"] == "true"
    assert first_ceremony.json()["id"] == second_ceremony.json()["id"]

    vendor_payload = {"name": "Taj Falaknuma", "category": "Venue", "status": "considering"}
    first_vendor = _post(client, f"/api/v1/events/{event_id}/vendors", vendor_payload, key)
    second_vendor = _post(client, f"/api/v1/events/{event_id}/vendors", vendor_payload, key)
    assert first_vendor.status_code == 201, first_vendor.text
    assert second_vendor.headers["Idempotency-Replayed"] == "true"
    assert first_vendor.json()["id"] == second_vendor.json()["id"]

    item_payload = {
        "category": "Venue",
        "label": "Venue",
        "basis": "fixed",
        "unit_amount_minor": 42_000_000,
        "quantity": 1,
    }
    first_item = _post(
        client, f"/api/v1/events/{event_id}/budget-items", item_payload, key
    )
    second_item = _post(
        client, f"/api/v1/events/{event_id}/budget-items", item_payload, key
    )
    assert first_item.status_code == 201, first_item.text
    assert second_item.headers["Idempotency-Replayed"] == "true"
    assert first_item.json()["id"] == second_item.json()["id"]

    quote_payload = {"amount_minor": 42_000_000, "status": "quoted"}
    quote_path = f"/api/v1/events/{event_id}/vendors/{first_vendor.json()['id']}/quotes"
    first_quote = _post(client, quote_path, quote_payload, key)
    second_quote = _post(client, quote_path, quote_payload, key)
    assert first_quote.status_code == 201, first_quote.text
    assert second_quote.headers["Idempotency-Replayed"] == "true"
    assert first_quote.json()["id"] == second_quote.json()["id"]

    plan = client.get(f"/api/v1/events/{event_id}/plan").json()
    assert len(plan["guests"]) == 1
    assert len(plan["tasks"]) == 1
    assert len(plan["ceremonies"]) == 1
    assert len(plan["vendors"]) == 1
    assert len(plan["items"]) == 1
    assert len(plan["quotes"]) == 1


def test_same_key_with_different_payload_returns_conflict(client) -> None:
    signup(client, f"idem-conflict-{uuid.uuid4().hex[:10]}@example.com")
    event = create_event(client)
    key = f"conflict-{uuid.uuid4()}"
    path = f"/api/v1/events/{event['id']}/guests"

    first = _post(client, path, {"full_name": "Meera", "party_size": 1}, key)
    assert first.status_code == 201, first.text

    conflict = _post(client, path, {"full_name": "Mira", "party_size": 1}, key)
    assert conflict.status_code == 409, conflict.text
    assert conflict.json()["error"]["code"] == "idempotency_conflict"

    replay = _post(client, path, {"full_name": "Meera", "party_size": 1}, key)
    assert replay.status_code == 201
    assert replay.headers["Idempotency-Replayed"] == "true"
    assert replay.json()["id"] == first.json()["id"]

    plan = client.get(f"/api/v1/events/{event['id']}/plan").json()
    assert [guest["full_name"] for guest in plan["guests"]] == ["Meera"]


def test_key_scope_is_per_user_event_and_endpoint(client) -> None:
    key = f"scope-{uuid.uuid4()}"

    signup(client, f"idem-scope-a-{uuid.uuid4().hex[:10]}@example.com")
    event_a = create_event(client)
    guest_a = _post(
        client, f"/api/v1/events/{event_a['id']}/guests", {"full_name": "Meera"}, key
    )
    assert guest_a.status_code == 201, guest_a.text

    signup(client, f"idem-scope-b-{uuid.uuid4().hex[:10]}@example.com")
    event_b = create_event(client)
    guest_b = _post(
        client, f"/api/v1/events/{event_b['id']}/guests", {"full_name": "Meera"}, key
    )
    assert guest_b.status_code == 201, guest_b.text
    assert guest_b.json()["id"] != guest_a.json()["id"]

    event_c = create_event(client)
    guest_c = _post(
        client, f"/api/v1/events/{event_c['id']}/guests", {"full_name": "Meera"}, key
    )
    assert guest_c.status_code == 201, guest_c.text
    assert guest_c.json()["id"] != guest_b.json()["id"]

    task = _post(
        client,
        f"/api/v1/events/{event_b['id']}/tasks",
        {"title": "Book venue", "due_date": "2027-02-01"},
        key,
    )
    assert task.status_code == 201, task.text


def test_failed_mutation_leaves_no_completed_record(client) -> None:
    signup(client, f"idem-failed-{uuid.uuid4().hex[:10]}@example.com")
    event = create_event(client)
    path = f"/api/v1/events/{event['id']}/budget-items"
    key = f"failed-{uuid.uuid4()}"

    invalid = _post(
        client,
        path,
        {
            "category": "Venue",
            "label": "Venue",
            "unit_amount_minor": 42_000_000,
            "quantity": 1,
            "vendor_id": str(uuid.uuid4()),
        },
        key,
    )
    assert invalid.status_code == 422, invalid.text

    valid = _post(
        client,
        path,
        {
            "category": "Venue",
            "label": "Venue",
            "unit_amount_minor": 42_000_000,
            "quantity": 1,
        },
        key,
    )
    assert valid.status_code == 201, valid.text
    assert "Idempotency-Replayed" not in valid.headers


def test_missing_key_stays_non_idempotent_and_invalid_key_is_rejected(client) -> None:
    signup(client, f"idem-optional-{uuid.uuid4().hex[:10]}@example.com")
    event = create_event(client)
    path = f"/api/v1/events/{event['id']}/guests"

    assert _post(client, path, {"full_name": "Meera"}).status_code == 201
    assert _post(client, path, {"full_name": "Meera"}).status_code == 201

    invalid = _post(client, path, {"full_name": "Mira"}, "bad key")
    assert invalid.status_code == 422
    assert invalid.json()["error"]["code"] == "invalid_idempotency_key"

    plan = client.get(f"/api/v1/events/{event['id']}/plan").json()
    assert [guest["full_name"] for guest in plan["guests"]] == ["Meera", "Meera"]


def test_concurrent_requests_with_same_key_create_once(client) -> None:
    user = signup(client, f"idem-concurrent-{uuid.uuid4().hex[:10]}@example.com")
    event = create_event(client)
    user_id = uuid.UUID(user["id"])
    event_id = uuid.UUID(event["id"])
    key = f"concurrent-{uuid.uuid4()}"
    barrier = Barrier(2)

    from utsavos.db import get_session_factory

    session_factory = get_session_factory()

    def worker() -> tuple[int, dict]:
        payload = GuestIn(full_name="Concurrent guest", party_size=2)
        db = session_factory()
        try:
            barrier.wait()
            def action() -> dict:
                guest = Guest(event_id=event_id, **payload.model_dump())
                db.add(guest)
                db.flush()
                time.sleep(0.25)
                db.refresh(guest)
                return {
                    "id": str(guest.id),
                    "full_name": guest.full_name,
                    "party_size": guest.party_size,
                }

            response = run_idempotent(
                db=db,
                user_id=user_id,
                event_id=event_id,
                endpoint="guests.create",
                key=key,
                payload=payload,
                action=action,
            )
            return response.status_code, json.loads(response.body)
        finally:
            db.close()

    with ThreadPoolExecutor(max_workers=2) as pool:
        results = [future.result() for future in [pool.submit(worker), pool.submit(worker)]]

    assert [status for status, _ in results] == [201, 201]
    assert results[0][1]["id"] == results[1][1]["id"]
    with session_factory() as db:
        count = db.scalar(
            select(func.count()).select_from(Guest).where(Guest.event_id == event_id)
        )
    assert count == 1


def test_add_task_helper_still_uses_headers(client) -> None:
    # Keep the shared support helper exercised after the handler signature change.
    signup(client, f"idem-helper-{uuid.uuid4().hex[:10]}@example.com")
    event = create_event(client)
    task = add_task(client, event["id"], "Book venue", "2027-02-01")
    assert task["title"] == "Book venue"
