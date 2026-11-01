"""Event CRUD, ownership, budget items, guests, tasks, vendors, quotes, export."""

from __future__ import annotations

import uuid

from tests.support import (
    add_item,
    add_task,
    create_event,
    headers,
    seed_standard_items,
    signup,
)


def test_event_lifecycle_and_versions(client) -> None:
    signup(client, f"ev-{uuid.uuid4().hex[:10]}@example.com")
    event = create_event(client)
    assert event["version"] == 1
    event_id = event["id"]

    listed = client.get("/api/v1/events").json()["items"]
    assert [item["id"] for item in listed] == [event_id]

    updated = client.patch(
        f"/api/v1/events/{event_id}",
        json={"name": "Renamed", "expected_version": 1},
        headers=headers(client),
    )
    assert updated.status_code == 200
    assert updated.json()["name"] == "Renamed"
    assert updated.json()["version"] == 2

    stale = client.patch(
        f"/api/v1/events/{event_id}",
        json={"name": "Stale", "expected_version": 1},
        headers=headers(client),
    )
    assert stale.status_code == 409
    assert stale.json()["error"]["code"] == "version_conflict"


def test_event_date_cannot_bypass_proposal(client) -> None:
    signup(client, f"ev-{uuid.uuid4().hex[:10]}@example.com")
    event = create_event(client)

    response = client.patch(
        f"/api/v1/events/{event['id']}",
        json={"event_date": "2027-02-21", "expected_version": event["version"]},
        headers=headers(client),
    )
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "event_date_requires_proposal"
    plan = client.get(f"/api/v1/events/{event['id']}/plan").json()
    assert plan["event"]["event_date"] == "2027-02-14"
    assert plan["event"]["version"] == event["version"]


def test_event_list_is_paginated_without_hiding_the_total(client) -> None:
    signup(client, f"ev-{uuid.uuid4().hex[:10]}@example.com")
    for index in range(3):
        create_event(client, name=f"Celebration {index}")

    first = client.get("/api/v1/events", params={"limit": 2, "offset": 0})
    assert first.status_code == 200
    first_body = first.json()
    assert first_body["total"] == 3
    assert first_body["limit"] == 2
    assert first_body["offset"] == 0
    assert len(first_body["items"]) == 2

    second = client.get("/api/v1/events", params={"limit": 2, "offset": 2})
    assert second.status_code == 200
    second_body = second.json()
    assert second_body["total"] == 3
    assert len(second_body["items"]) == 1
    assert {item["id"] for item in first_body["items"]}.isdisjoint(
        {item["id"] for item in second_body["items"]}
    )
    assert client.get("/api/v1/events", params={"offset": 1_000_001}).status_code == 422


def test_guest_count_cannot_bypass_simulation(client) -> None:
    signup(client, f"ev-{uuid.uuid4().hex[:10]}@example.com")
    event = create_event(client)
    response = client.patch(
        f"/api/v1/events/{event['id']}",
        json={"guest_count": 300, "expected_version": 1},
        headers=headers(client),
    )
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "guest_count_requires_proposal"


def test_reserve_cannot_exceed_budget(client) -> None:
    signup(client, f"ev-{uuid.uuid4().hex[:10]}@example.com")
    event = create_event(client)
    response = client.patch(
        f"/api/v1/events/{event['id']}",
        json={"budget_minor": 10_000_000, "expected_version": 1},
        headers=headers(client),
    )
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "invalid_reserve"


def test_budget_items_drive_plan_totals(client) -> None:
    signup(client, f"ev-{uuid.uuid4().hex[:10]}@example.com")
    event = create_event(client)
    seed_standard_items(client, event["id"])
    plan = client.get(f"/api/v1/events/{event['id']}/plan").json()
    assert plan["totals"]["committed_minor"] == 146_560_000
    assert plan["totals"]["spendable_minor"] == 162_000_000
    assert plan["totals"]["remaining_budget_minor"] == 33_440_000
    assert plan["totals"]["remaining_spendable_minor"] == 15_440_000
    assert len(plan["items"]) == 7

    item = next(entry for entry in plan["items"] if entry["label"] == "Venue")
    patched = client.patch(
        f"/api/v1/events/{event['id']}/budget-items/{item['id']}",
        json={"unit_amount_minor": 1_000},
        headers=headers(client),
    )
    assert patched.status_code == 200
    assert client.get(f"/api/v1/events/{event['id']}/plan").json()["totals"][
        "committed_minor"
    ] == 146_560_000 - item["unit_amount_minor"] + 1_000


def test_plan_exposes_setup_resources(client) -> None:
    signup(client, f"ev-{uuid.uuid4().hex[:10]}@example.com")
    event = create_event(client)
    venue = add_item(client, event["id"], "Venue", 42_000_000, category="Venue")

    ceremony = client.post(
        f"/api/v1/events/{event['id']}/ceremonies",
        json={
            "name": "Mehndi",
            "ceremony_date": "2027-02-12",
            "guest_count": 40,
            "venue": "Home",
        },
        headers=headers(client),
    )
    assert ceremony.status_code == 201

    guest = client.post(
        f"/api/v1/events/{event['id']}/guests",
        json={"full_name": "Meera", "party_size": 2, "dietary_tags": "vegetarian"},
        headers=headers(client),
    )
    assert guest.status_code == 201

    vendor = client.post(
        f"/api/v1/events/{event['id']}/vendors",
        json={"name": "Taj Falaknuma", "category": "Venue"},
        headers=headers(client),
    )
    assert vendor.status_code == 201
    quote = client.post(
        f"/api/v1/events/{event['id']}/vendors/{vendor.json()['id']}/quotes",
        json={
            "amount_minor": 39_000_000,
            "budget_item_id": venue["id"],
            "status": "quoted",
        },
        headers=headers(client),
    )
    assert quote.status_code == 201

    first = add_task(client, event["id"], "Send invites", "2026-12-01")
    second = add_task(client, event["id"], "Confirm headcount", "2027-01-01")
    dependency = client.post(
        f"/api/v1/events/{event['id']}/task-dependencies",
        json={"predecessor_id": first["id"], "successor_id": second["id"]},
        headers=headers(client),
    )
    assert dependency.status_code == 201

    plan = client.get(f"/api/v1/events/{event['id']}/plan").json()
    assert [entry["name"] for entry in plan["ceremonies"]] == ["Mehndi"]
    assert [entry["full_name"] for entry in plan["guests"]] == ["Meera"]
    assert [entry["name"] for entry in plan["vendors"]] == ["Taj Falaknuma"]
    assert [entry["status"] for entry in plan["quotes"]] == ["quoted"]
    assert len(plan["tasks"]) == 2
    assert plan["dependencies"] == [
        {"predecessor_id": first["id"], "successor_id": second["id"]}
    ]


def test_plan_uses_confirmed_quotes_only(client) -> None:
    signup(client, f"ev-{uuid.uuid4().hex[:10]}@example.com")
    event = create_event(client)
    venue = add_item(client, event["id"], "Venue", 42_000_000, category="Venue")
    vendor = client.post(
        f"/api/v1/events/{event['id']}/vendors",
        json={"name": "Taj Falaknuma", "category": "Venue"},
        headers=headers(client),
    ).json()

    quoted = client.post(
        f"/api/v1/events/{event['id']}/vendors/{vendor['id']}/quotes",
        json={
            "amount_minor": 39_000_000,
            "budget_item_id": venue["id"],
            "status": "quoted",
        },
        headers=headers(client),
    )
    assert quoted.status_code == 201
    assert quoted.json()["applied_to_budget"] is False
    assert (
        client.get(f"/api/v1/events/{event['id']}/plan").json()["totals"]["committed_minor"]
        == 42_000_000
    )

    confirmed = client.post(
        f"/api/v1/events/{event['id']}/vendors/{vendor['id']}/quotes",
        json={
            "amount_minor": 39_000_000,
            "budget_item_id": venue["id"],
            "status": "confirmed",
        },
        headers=headers(client),
    )
    assert confirmed.json()["applied_to_budget"] is True
    assert (
        client.get(f"/api/v1/events/{event['id']}/plan").json()["totals"]["committed_minor"]
        == 39_000_000
    )


def test_guests_are_owner_scoped(client) -> None:
    from fastapi.testclient import TestClient

    from utsavos.main import app

    signup(client, f"ev-{uuid.uuid4().hex[:10]}@example.com")
    event = create_event(client)
    created = client.post(
        f"/api/v1/events/{event['id']}/guests",
        json={"full_name": "Meera", "party_size": 2, "dietary_tags": "vegetarian"},
        headers=headers(client),
    )
    assert created.status_code == 201
    assert len(client.get(f"/api/v1/events/{event['id']}/guests").json()["items"]) == 1

    with TestClient(app) as intruder:
        signup(intruder, f"ev-{uuid.uuid4().hex[:10]}@example.com")
        assert intruder.get(f"/api/v1/events/{event['id']}").status_code == 404
        assert (
            intruder.get(f"/api/v1/events/{event['id']}/guests").status_code == 404
        )
        assert (
            intruder.get(f"/api/v1/events/{event['id']}/plan").status_code == 404
        )


def test_tasks_and_dependency_cycle(client) -> None:
    signup(client, f"ev-{uuid.uuid4().hex[:10]}@example.com")
    event = create_event(client)
    first = add_task(client, event["id"], "Send invites", "2026-12-01")
    second = add_task(client, event["id"], "Confirm headcount", "2027-01-01")

    ok = client.post(
        f"/api/v1/events/{event['id']}/task-dependencies",
        json={"predecessor_id": first["id"], "successor_id": second["id"]},
        headers=headers(client),
    )
    assert ok.status_code == 201

    duplicate = client.post(
        f"/api/v1/events/{event['id']}/task-dependencies",
        json={"predecessor_id": first["id"], "successor_id": second["id"]},
        headers=headers(client),
    )
    assert duplicate.status_code == 409
    assert duplicate.json()["error"]["code"] == "dependency_exists"

    cycle = client.post(
        f"/api/v1/events/{event['id']}/task-dependencies",
        json={"predecessor_id": second["id"], "successor_id": first["id"]},
        headers=headers(client),
    )
    assert cycle.status_code == 422
    assert cycle.json()["error"]["code"] == "dependency_cycle"


def test_delete_event_removes_it(client) -> None:
    signup(client, f"ev-{uuid.uuid4().hex[:10]}@example.com")
    event = create_event(client)
    assert (
        client.delete(f"/api/v1/events/{event['id']}", headers=headers(client)).status_code
        == 204
    )
    assert client.get(f"/api/v1/events/{event['id']}").status_code == 404


def test_export_is_owner_only_and_typed(client) -> None:
    signup(client, f"ev-{uuid.uuid4().hex[:10]}@example.com")
    event = create_event(client)
    add_item(client, event["id"], "Venue", 1_000_000)
    response = client.get(f"/api/v1/events/{event['id']}/export")
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("application/json")
    assert "attachment" in response.headers["content-disposition"]
    body = response.json()
    assert body["format"] == "utsavos.plan.v1"
    assert body["items"][0]["unit_amount_minor"] == 1_000_000
    assert "password" not in response.text.lower()


def test_sql_injection_text_is_stored_literally(client) -> None:
    signup(client, f"ev-{uuid.uuid4().hex[:10]}@example.com")
    payload = "Robert'); DROP TABLE events;--"
    event = create_event(client, name=payload)
    assert (
        client.get(f"/api/v1/events/{event['id']}").json()["event"]["name"] == payload
    )
    assert client.get("/api/v1/events").status_code == 200

def test_dates_outside_the_supported_range_return_422(client) -> None:
    signup(client, f"ev-{uuid.uuid4().hex[:10]}@example.com")
    event = create_event(client)

    bad_event = client.patch(
        f"/api/v1/events/{event['id']}",
        json={"event_date": "9999-12-31", "expected_version": event["version"]},
        headers=headers(client),
    )
    assert bad_event.status_code == 422

    bad_task = client.post(
        f"/api/v1/events/{event['id']}/tasks",
        json={"title": "Too far", "due_date": "9999-12-31"},
        headers=headers(client),
    )
    assert bad_task.status_code == 422

    bad_ceremony = client.post(
        f"/api/v1/events/{event['id']}/ceremonies",
        json={"name": "Too far", "ceremony_date": "9999-12-31"},
        headers=headers(client),
    )
    assert bad_ceremony.status_code == 422
