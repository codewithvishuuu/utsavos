"""P2-03: AI endpoints must not hold pooled DB connections during provider calls.

AI reads everything it needs first; the pooled connection is returned before the
external provider is awaited, so provider delays never consume pool capacity or
keep a transaction open.
"""

from __future__ import annotations

import asyncio
import json
import threading
import time
import uuid

from tests.support import create_event, headers, seed_standard_items, signup

from utsavos.ai import orchestration
from utsavos.ai.ollama import OllamaProvider
from utsavos.config import Settings
from utsavos.db import get_engine

FLAGSHIP = {"kind": "guest_count", "guest_count": 240}
VALID = json.dumps(
    {
        "summary": "Committed cost rises to ₹17,00,800 from ₹14,65,600.",
        "trade_offs": [],
    }
)


def _local_settings() -> Settings:
    return Settings(app_env="test", ai_local_enabled=True, cloud_ai_enabled=False)


def _seed(client) -> str:
    signup(client, f"life-{uuid.uuid4().hex[:10]}@example.com")
    event = create_event(client)
    seed_standard_items(client, event["id"])
    return event["id"]


def _explain(client, event_id: str):
    return client.post(
        f"/api/v1/events/{event_id}/ai/explain",
        json={"change": FLAGSHIP},
        headers=headers(client),
    )


def test_explain_releases_db_connection_during_provider_call(
    client, monkeypatch
) -> None:
    event_id = _seed(client)
    captured: dict[str, int] = {}

    async def delayed(self, prompt):  # noqa: ANN001
        captured["on_entry"] = get_engine().pool.checkedout()
        await asyncio.sleep(0.05)
        captured["after_delay"] = get_engine().pool.checkedout()
        return VALID

    monkeypatch.setattr(orchestration, "get_settings", _local_settings)
    monkeypatch.setattr(OllamaProvider, "generate", delayed)

    response = _explain(client, event_id)
    assert response.status_code == 200, response.text
    assert response.json()["provider"] == "ollama"
    # while the provider was pending, no pooled connection was checked out
    assert captured["on_entry"] == 0
    assert captured["after_delay"] == 0


def test_provider_delay_does_not_block_the_event_loop(client, monkeypatch) -> None:
    event_id = _seed(client)
    entered = threading.Event()
    outcome: list[int] = []

    async def slow_provider(self, prompt):  # noqa: ANN001
        entered.set()
        await asyncio.sleep(1.0)  # keeps the loop running; nothing else may stall
        return VALID

    monkeypatch.setattr(orchestration, "get_settings", _local_settings)
    monkeypatch.setattr(OllamaProvider, "generate", slow_provider)

    worker = threading.Thread(target=lambda: outcome.append(_explain(client, event_id).status_code))
    worker.start()
    assert entered.wait(5)
    start = time.monotonic()
    health = client.get("/healthz")
    elapsed = time.monotonic() - start
    worker.join(5)

    assert outcome == [200]
    assert health.status_code == 200
    # a blocked loop would only serve this after the provider finished
    assert elapsed < 0.5


def test_preferences_releases_connection_before_provider_call(
    client, monkeypatch
) -> None:
    event_id = _seed(client)
    captured: dict[str, int] = {}

    async def delayed(self, prompt):  # noqa: ANN001
        captured["on_entry"] = get_engine().pool.checkedout()
        await asyncio.sleep(0.05)
        return json.dumps(
            {
                "summary": "Reduce the guest count to 200.",
                "guest_count": 200,
                "priorities": ["cost"],
            }
        )

    monkeypatch.setattr(orchestration, "get_settings", _local_settings)
    monkeypatch.setattr(OllamaProvider, "generate", delayed)

    response = client.post(
        f"/api/v1/events/{event_id}/ai/preferences",
        json={"text": "Keep about 200 guests; stay near ₹18,00,000."},
        headers=headers(client),
    )
    assert response.status_code == 200, response.text
    assert response.json()["applied"] is False
    assert captured["on_entry"] == 0


def test_directions_release_connection_and_keep_deterministic_fallback(
    client, monkeypatch
) -> None:
    event_id = _seed(client)
    captured: dict[str, int] = {}

    async def delayed(self, prompt):  # noqa: ANN001
        from utsavos.ai.base import ProviderUnavailable

        captured["on_entry"] = get_engine().pool.checkedout()
        raise ProviderUnavailable("provider exploded")

    monkeypatch.setattr(orchestration, "get_settings", _local_settings)
    monkeypatch.setattr(OllamaProvider, "generate", delayed)

    response = client.post(
        f"/api/v1/events/{event_id}/ai/directions",
        json={"change": FLAGSHIP},
        headers=headers(client),
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["provider"] == "deterministic"  # fallback intact
    assert body["items"]
    assert captured["on_entry"] == 0
