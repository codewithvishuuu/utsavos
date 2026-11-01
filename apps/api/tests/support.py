"""Shared test helpers. Tests talk to the real FastAPI app and real PostgreSQL."""

from __future__ import annotations

from typing import Any

PASSWORD = "correct-horse-battery-staple"  # noqa: S105 - test fixture only


def signup(client, email: str, password: str = PASSWORD) -> dict[str, Any]:
    response = client.post(
        "/api/v1/auth/signup",
        json={"email": email, "password": password, "display_name": "Test Owner"},
    )
    assert response.status_code == 201, response.text
    return response.json()


def login(client, email: str, password: str = PASSWORD) -> None:
    response = client.post(
        "/api/v1/auth/login", json={"email": email, "password": password}
    )
    assert response.status_code == 200, response.text


def csrf(client) -> str:
    token = client.cookies.get("utsavos_csrf")
    assert token, "expected a CSRF cookie after signup/login"
    return token


def headers(client) -> dict[str, str]:
    return {"X-CSRF-Token": csrf(client)}


def create_event(client, **overrides: Any) -> dict[str, Any]:
    payload = {
        "name": "Ananya & Rohan wedding",
        "event_type": "wedding",
        "city": "Hyderabad",
        "event_date": "2027-02-14",
        "guest_count": 180,
        "budget_minor": 180_000_000,
        "reserve_minor": 18_000_000,
        "currency": "INR",
    }
    payload.update(overrides)
    response = client.post("/api/v1/events", json=payload, headers=headers(client))
    assert response.status_code == 201, response.text
    return response.json()


def add_item(
    client,
    event_id: str,
    label: str,
    amount_minor: int,
    basis: str = "fixed",
    category: str = "General",
    vendor_id: str | None = None,
) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "category": category,
        "label": label,
        "basis": basis,
        "unit_amount_minor": amount_minor,
        "quantity": 1,
    }
    if vendor_id:
        payload["vendor_id"] = vendor_id
    response = client.post(
        f"/api/v1/events/{event_id}/budget-items", json=payload, headers=headers(client)
    )
    assert response.status_code == 201, response.text
    return response.json()


def seed_standard_items(client, event_id: str) -> dict[str, dict[str, Any]]:
    return {
        "venue": add_item(client, event_id, "Venue", 42_000_000, category="Venue"),
        "catering": add_item(
            client, event_id, "Catering", 380_000, basis="per_guest", category="Catering"
        ),
        "decor": add_item(client, event_id, "Decor", 15_000_000, category="Decor"),
        "photography": add_item(client, event_id, "Photos", 10_000_000, category="Photos"),
        "attire": add_item(client, event_id, "Attire", 6_000_000, category="Attire"),
        "invitations": add_item(
            client, event_id, "Invites", 12_000, basis="per_guest", category="Stationery"
        ),
        "misc": add_item(client, event_id, "Misc", 3_000_000, category="Other"),
    }


def add_task(
    client,
    event_id: str,
    title: str,
    due_date: str,
    offset_days: int | None = None,
    locked: bool = False,
    status: str = "todo",
) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "title": title,
        "due_date": due_date,
        "status": status,
        "is_locked": locked,
    }
    if offset_days is not None:
        payload["offset_days"] = offset_days
    response = client.post(
        f"/api/v1/events/{event_id}/tasks", json=payload, headers=headers(client)
    )
    assert response.status_code == 201, response.text
    return response.json()
