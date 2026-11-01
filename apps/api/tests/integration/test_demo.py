"""Public demo: no auth, no AI, no writes, real engine, honest limits."""

from __future__ import annotations

import uuid

from sqlalchemy import func, select

from utsavos.db import get_session_factory
from utsavos.models import Event


def _event_count() -> int:
    with get_session_factory()() as db:
        return int(db.scalar(select(func.count()).select_from(Event)) or 0)


def test_demo_fixture_is_public_and_read_only(client) -> None:
    response = client.get("/api/v1/demo/fixture")
    assert response.status_code == 200
    body = response.json()
    assert body["read_only"] is True
    assert "Synthetic" in body["disclaimer"]
    assert body["persona"]["name"] == "Ananya"
    assert body["baseline"]["committed_minor"] == 146_560_000
    assert body["baseline"]["budget_minor"] == 180_000_000
    assert body["baseline"]["reserve_minor"] == 18_000_000
    assert body["baseline"]["spendable_minor"] == 162_000_000
    assert body["baseline"]["remaining_budget_minor"] == 33_440_000
    assert body["baseline"]["remaining_spendable_minor"] == 15_440_000


def test_demo_simulation_uses_the_real_engine(client) -> None:
    before = _event_count()
    response = client.post(
        "/api/v1/demo/simulate", json={"scenario": "guests_180_to_240"}
    )
    assert response.status_code == 200
    body = response.json()
    assert body["result"]["projected"]["committed_minor"] == 170_080_000
    assert body["result"]["projected"]["remaining_budget_minor"] == 9_920_000
    assert body["result"]["projected"]["remaining_spendable_minor"] == -8_080_000
    assert body["result"]["projected"]["spendable_shortfall_minor"] == 8_080_000
    assert len(body["result"]["alternatives"]) == 4
    assert body["result"]["feasible"] is False
    assert body["fixture"]["version"] == 1
    assert _event_count() == before


def test_demo_rejects_unknown_scenarios(client) -> None:
    response = client.post("/api/v1/demo/simulate", json={"scenario": "anything_else"})
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "validation_error"


def test_demo_is_rate_limited(client, monkeypatch) -> None:
    from utsavos.api.demo import _limiter

    monkeypatch.setattr(_limiter, "limit", 2)
    assert client.get("/api/v1/demo/fixture").status_code == 200
    assert client.get("/api/v1/demo/fixture").status_code == 200
    assert client.get("/api/v1/demo/fixture").status_code == 429


def test_demo_body_is_size_limited(client) -> None:
    huge = "x" * (70 * 1024)
    response = client.post(
        "/api/v1/demo/simulate", content=b'{"scenario":"' + huge.encode() + b'"}'
    )
    assert response.status_code == 413


def test_demo_does_not_accept_authentication_context(client) -> None:
    # There is no endpoint that maps a demo request onto a private event.
    response = client.post(
        "/api/v1/demo/simulate",
        json={"scenario": "guests_180_to_240", "event_id": str(uuid.uuid4())},
    )
    assert response.status_code == 422
