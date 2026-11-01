"""Live smoke test against a running UtsavOS server.

Usage:
    python scripts/live_smoke.py [base_url]

Exercises the flagship flow over HTTP exactly as the browser does: signup,
event creation, budget items, simulation, proposal, approval, persistence,
export, and the public demo. Exits non-zero on the first failed check.
"""

from __future__ import annotations

import sys
import uuid

import httpx

BASE = (sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8000").rstrip("/")
API = f"{BASE}/api/v1"
PASSWORD = "live-smoke-password-1"
checks = 0


def check(condition: bool, label: str) -> None:
    global checks
    if not condition:
        raise SystemExit(f"FAIL: {label}")
    checks += 1
    print(f"PASS: {label}")


def main() -> None:
    with httpx.Client(base_url=API, timeout=60) as client:
        email = f"live-{uuid.uuid4().hex[:10]}@example.com"
        response = client.post(
            "/auth/signup", json={"email": email, "password": PASSWORD}
        )
        check(response.status_code == 201, "signup")
        headers = {"X-CSRF-Token": client.cookies.get("utsavos_csrf", "")}
        check(bool(headers["X-CSRF-Token"]), "csrf cookie issued")

        event = client.post(
            "/events",
            json={
                "name": "Live smoke wedding",
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
        check(event.status_code == 201, "create event")
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
            check(created.status_code == 201, f"add budget item {label}")

        simulation = client.post(
            f"/events/{event_id}/simulate",
            json={"kind": "guest_count", "guest_count": 240},
            headers=headers,
        )
        check(simulation.status_code == 200, "simulate guest increase")
        result = simulation.json()
        check(result["projected"]["committed_minor"] == 170_080_000, "exact committed cost")
        check(
            result["projected"]["spendable_shortfall_minor"] == 8_080_000,
            "exact spendable shortfall",
        )
        check(
            result["projected"]["remaining_budget_minor"] == 9_920_000,
            "remaining total budget is not the spendable remainder",
        )
        check(len(result["alternatives"]) == 4, "four computed alternatives")

        alternative = next(
            alt for alt in result["alternatives"] if alt["id"] == "increase_budget"
        )
        change = {"kind": "guest_count", **alternative["changes"]}
        proposal = client.post(
            f"/events/{event_id}/proposals", json={"change": change}, headers=headers
        )
        check(proposal.status_code == 201, "draft proposal from alternative")
        proposal_id = proposal.json()["id"]

        plan_before = client.get(f"/events/{event_id}/plan").json()
        check(plan_before["event"]["guest_count"] == 180, "plan unchanged before approval")

        approved = client.post(
            f"/events/{event_id}/proposals/{proposal_id}/approve", headers=headers
        )
        check(approved.status_code == 200, "approve proposal")

        plan = client.get(f"/events/{event_id}/plan").json()
        check(plan["event"]["guest_count"] == 240, "guest count persisted")
        check(plan["event"]["version"] == 2, "version incremented once")
        check(len(plan["revisions"]) == 1, "revision recorded")
        check(
            plan["totals"]["remaining_spendable_minor"] == 0,
            "budget exactly covers plan",
        )
        check(
            plan["totals"]["remaining_budget_minor"] == 18_000_000,
            "reserve remains in the total budget",
        )

        replay = client.post(
            f"/events/{event_id}/proposals/{proposal_id}/approve", headers=headers
        )
        check(replay.json()["idempotent_replay"] is True, "approval is idempotent")

        export = client.get(f"/events/{event_id}/export")
        check(export.status_code == 200, "export plan")
        check(export.json()["format"] == "utsavos.plan.v1", "export schema tag")

        unauthorised = httpx.get(f"{API}/events/{event_id}/plan", timeout=30)
        check(unauthorised.status_code == 401, "unauthenticated access rejected")

    with httpx.Client(base_url=API, timeout=60) as demo:
        fixture = demo.get("/demo/fixture")
        check(fixture.status_code == 200, "public demo fixture")
        check("Synthetic" in fixture.json()["disclaimer"], "synthetic data disclosed")
        simulated = demo.post("/demo/simulate", json={"scenario": "guests_180_to_240"})
        check(simulated.status_code == 200, "public demo simulation")
        check(
            simulated.json()["result"]["projected"]["committed_minor"] == 170_080_000,
            "demo uses the same engine",
        )

    print(f"\n{checks} checks passed")


if __name__ == "__main__":
    main()
