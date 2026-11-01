"""Live Ollama check through the real application.

Creates a disposable account and flagship event, computes the guest-count
impact, then calls the AI explain endpoint twice (cold and warm). Prints the
provider, fallback reason, grounding flag and measured latency. This is
evidence collection, not a pass/fail test: a deterministic fallback is a valid
outcome, but it must be reported honestly.
"""

from __future__ import annotations

import json
import sys
import uuid

import httpx

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

BASE = (sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8000").rstrip("/")
API = f"{BASE}/api/v1"


def main() -> None:
    with httpx.Client(base_url=API, timeout=180) as client:
        email = f"ai-{uuid.uuid4().hex[:10]}@example.com"
        signup = client.post("/auth/signup", json={"email": email, "password": "live-ai-password-1"})
        signup.raise_for_status()
        headers = {"X-CSRF-Token": client.cookies.get("utsavos_csrf", "")}

        event = client.post(
            "/events",
            json={
                "name": "AI evidence event",
                "event_type": "wedding",
                "city": "Hyderabad",
                "event_date": "2027-02-14",
                "guest_count": 180,
                "budget_minor": 180_000_000,
                "reserve_minor": 18_000_000,
                "currency": "INR",
            },
            headers=headers,
        )
        event.raise_for_status()
        event_id = event.json()["id"]

        items = [
            ("Venue", "Venue", 42_000_000, "fixed"),
            ("Catering", "Catering", 380_000, "per_guest"),
            ("Decor", "Decor", 15_000_000, "fixed"),
            ("Photography", "Photography", 10_000_000, "fixed"),
            ("Attire", "Attire", 6_000_000, "fixed"),
            ("Invitations", "Stationery", 12_000, "per_guest"),
            ("Misc", "Other", 3_000_000, "fixed"),
        ]
        for label, category, amount, basis in items:
            created = client.post(
                f"/events/{event_id}/budget-items",
                json={
                    "category": category,
                    "label": label,
                    "basis": basis,
                    "unit_amount_minor": amount,
                    "quantity": 1,
                },
                headers=headers,
            )
            created.raise_for_status()

        simulation = client.post(
            f"/events/{event_id}/simulate",
            json={"kind": "guest_count", "guest_count": 240},
            headers=headers,
        )
        simulation.raise_for_status()

        status = client.get("/ai/status")
        status.raise_for_status()
        print("status:", json.dumps(status.json(), ensure_ascii=False))

        for attempt in ("cold", "warm"):
            response = client.post(
                f"/events/{event_id}/ai/explain",
                json={"change": {"kind": "guest_count", "guest_count": 240}},
                headers=headers,
            )
            print(f"{attempt} HTTP {response.status_code}")
            if response.status_code != 200:
                print(response.text)
                continue
            payload = response.json()
            print(
                json.dumps(
                    {
                        "provider": payload["provider"],
                        "fallback_reason": payload["fallback_reason"],
                        "grounded": payload["grounded"],
                        "latency_ms": payload["latency_ms"],
                        "explanation": payload["explanation"],
                        "trade_offs": payload["trade_offs"],
                    },
                    ensure_ascii=False,
                    indent=2,
                )
            )


if __name__ == "__main__":
    main()
