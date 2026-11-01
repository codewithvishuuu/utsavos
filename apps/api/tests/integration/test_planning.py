"""Simulation, proposals, approval, rejection, revisions, and concurrency."""

from __future__ import annotations

import threading
import uuid

from sqlalchemy import func, select
from tests.support import (
    add_task,
    create_event,
    headers,
    seed_standard_items,
    signup,
)

from utsavos.db import get_session_factory
from utsavos.models import Proposal, Revision
from utsavos.services import planning_service
from utsavos.services.errors import ServiceError

FLAGSHIP = {"kind": "guest_count", "guest_count": 240}


def _seed(client) -> tuple[str, dict]:
    signup(client, f"plan-{uuid.uuid4().hex[:10]}@example.com")
    event = create_event(client)
    seed_standard_items(client, event["id"])
    return event["id"], event


def _counts(event_id: str) -> dict[str, int]:
    with get_session_factory()() as db:
        return {
            "proposals": int(
                db.scalar(
                    select(func.count())
                    .select_from(Proposal)
                    .where(Proposal.event_id == uuid.UUID(event_id))
                )
                or 0
            ),
            "revisions": int(
                db.scalar(
                    select(func.count())
                    .select_from(Revision)
                    .where(Revision.event_id == uuid.UUID(event_id))
                )
                or 0
            ),
        }


def test_simulation_is_exact_and_writes_nothing(client) -> None:
    event_id, event = _seed(client)
    before_plan = client.get(f"/api/v1/events/{event_id}/plan").json()
    before_counts = _counts(event_id)

    response = client.post(
        f"/api/v1/events/{event_id}/simulate", json=FLAGSHIP, headers=headers(client)
    )
    assert response.status_code == 200, response.text
    result = response.json()
    assert result["baseline"]["committed_minor"] == 146_560_000
    assert result["projected"]["committed_minor"] == 170_080_000
    assert result["projected"]["remaining_budget_minor"] == 9_920_000
    assert result["projected"]["remaining_spendable_minor"] == -8_080_000
    assert result["projected"]["spendable_shortfall_minor"] == 8_080_000
    assert result["feasible"] is False
    assert [alt["id"] for alt in result["alternatives"]] == [
        "release_reserve",
        "trim_per_guest",
        "reduce_guests",
        "increase_budget",
    ]

    after_plan = client.get(f"/api/v1/events/{event_id}/plan").json()
    assert after_plan["event"]["version"] == before_plan["event"]["version"]
    assert after_plan["event"]["guest_count"] == 180
    assert after_plan["totals"] == before_plan["totals"]
    assert _counts(event_id) == before_counts
    assert event["version"] == 1


def test_infeasible_change_cannot_become_a_proposal(client) -> None:
    event_id, _ = _seed(client)
    response = client.post(
        f"/api/v1/events/{event_id}/proposals",
        json={"change": FLAGSHIP},
        headers=headers(client),
    )
    assert response.status_code == 422
    error = response.json()["error"]
    assert error["code"] == "infeasible_proposal"
    assert error["details"]["spendable_shortfall_minor"] == 8_080_000
    assert error["details"]["remaining_budget_minor"] == 9_920_000
    assert len(error["details"]["alternatives"]) == 4


def test_alternative_can_be_approved_and_survives_refresh(client) -> None:
    event_id, _ = _seed(client)
    simulation = client.post(
        f"/api/v1/events/{event_id}/simulate", json=FLAGSHIP, headers=headers(client)
    ).json()
    alternative = next(
        alt for alt in simulation["alternatives"] if alt["id"] == "increase_budget"
    )
    change = {"kind": "guest_count", **alternative["changes"]}

    proposal = client.post(
        f"/api/v1/events/{event_id}/proposals",
        json={"change": change},
        headers=headers(client),
    )
    assert proposal.status_code == 201, proposal.text
    proposal_id = proposal.json()["id"]

    approved = client.post(
        f"/api/v1/events/{event_id}/proposals/{proposal_id}/approve",
        headers=headers(client),
    )
    assert approved.status_code == 200, approved.text
    body = approved.json()
    assert body["idempotent_replay"] is False
    assert body["revision"]["version"] == 2

    plan = client.get(f"/api/v1/events/{event_id}/plan").json()
    assert plan["event"]["guest_count"] == 240
    assert plan["event"]["budget_minor"] == 188_080_000
    assert plan["event"]["version"] == 2
    assert plan["totals"]["committed_minor"] == 170_080_000
    assert plan["totals"]["remaining_budget_minor"] == 18_000_000
    assert plan["totals"]["remaining_spendable_minor"] == 0
    assert plan["totals"]["spendable_shortfall_minor"] == 0
    assert len(plan["revisions"]) == 1
    assert plan["revisions"][0]["before_json"]["guest_count"] == 180
    assert plan["revisions"][0]["after_json"]["guest_count"] == 240

    replay = client.post(
        f"/api/v1/events/{event_id}/proposals/{proposal_id}/approve",
        headers=headers(client),
    )
    assert replay.status_code == 200
    assert replay.json()["idempotent_replay"] is True
    assert replay.json()["revision"]["id"] == body["revision"]["id"]
    assert client.get(f"/api/v1/events/{event_id}").json()["event"]["version"] == 2


def test_date_approval_moves_ui_task_and_ceremony(client) -> None:
    event_id, _ = _seed(client)
    task = add_task(
        client,
        event_id,
        "Send invites",
        "2026-12-01",
        offset_days=-75,
    )
    ceremony = client.post(
        f"/api/v1/events/{event_id}/ceremonies",
        json={
            "name": "Mehndi",
            "ceremony_date": "2027-02-12",
            "guest_count": 40,
            "venue": "Home",
        },
        headers=headers(client),
    )
    assert ceremony.status_code == 201, ceremony.text
    ceremony_id = ceremony.json()["id"]

    simulation = client.post(
        f"/api/v1/events/{event_id}/simulate",
        json={"kind": "date", "event_date": "2027-02-21"},
        headers=headers(client),
    )
    assert simulation.status_code == 200, simulation.text
    preview = simulation.json()
    assert preview["task_changes"] == [
        {
            "task_id": task["id"],
            "title": "Send invites",
            "before": "2026-12-01",
            "after": "2026-12-08",
        }
    ]
    assert preview["ceremony_changes"] == [
        {
            "ceremony_id": ceremony_id,
            "name": "Mehndi",
            "before": "2027-02-12",
            "after": "2027-02-19",
        }
    ]

    proposal = client.post(
        f"/api/v1/events/{event_id}/proposals",
        json={"change": {"kind": "date", "event_date": "2027-02-21"}},
        headers=headers(client),
    )
    assert proposal.status_code == 201, proposal.text
    approved = client.post(
        f"/api/v1/events/{event_id}/proposals/{proposal.json()['id']}/approve",
        headers=headers(client),
    )
    assert approved.status_code == 200, approved.text

    plan = client.get(f"/api/v1/events/{event_id}/plan").json()
    assert plan["event"]["event_date"] == "2027-02-21"
    saved_task = next(item for item in plan["tasks"] if item["id"] == task["id"])
    assert saved_task["due_date"] == "2026-12-08"
    moved_ceremony = next(item for item in plan["ceremonies"] if item["id"] == ceremony_id)
    assert moved_ceremony["ceremony_date"] == "2027-02-19"

    revision = plan["revisions"][0]
    assert revision["before_json"]["event_date"] == "2027-02-14"
    assert revision["after_json"]["event_date"] == "2027-02-21"
    assert revision["before_json"]["ceremony_dates"][ceremony_id] == "2027-02-12"
    assert revision["after_json"]["ceremony_dates"][ceremony_id] == "2027-02-19"
    assert revision["before_json"]["task_dates"][task["id"]] == "2026-12-01"
    assert revision["after_json"]["task_dates"][task["id"]] == "2026-12-08"


def test_rejection_leaves_the_plan_unchanged(client) -> None:
    event_id, _ = _seed(client)
    before = client.get(f"/api/v1/events/{event_id}/plan").json()
    proposal = client.post(
        f"/api/v1/events/{event_id}/proposals",
        json={"change": {"kind": "guest_count", "guest_count": 200}},
        headers=headers(client),
    ).json()
    rejected = client.post(
        f"/api/v1/events/{event_id}/proposals/{proposal['id']}/reject",
        json={"reason": "Not now"},
        headers=headers(client),
    )
    assert rejected.status_code == 200
    assert rejected.json()["status"] == "rejected"

    after = client.get(f"/api/v1/events/{event_id}/plan").json()
    assert after["event"] == before["event"]
    assert after["totals"] == before["totals"]
    assert after["revisions"] == []

    approve = client.post(
        f"/api/v1/events/{event_id}/proposals/{proposal['id']}/approve",
        headers=headers(client),
    )
    assert approve.status_code == 409
    assert approve.json()["error"]["code"] == "proposal_rejected"


def test_quote_totals_cannot_become_a_proposal(client) -> None:
    """quote_totals are simulation-only; persisting them is the quote endpoint's job."""
    event_id, _ = _seed(client)
    items = client.get(f"/api/v1/events/{event_id}/plan").json()["items"]
    response = client.post(
        f"/api/v1/events/{event_id}/proposals",
        json={
            "change": {
                "kind": "quote",
                "quote_totals": {items[0]["id"]: 1_000_000},
            }
        },
        headers=headers(client),
    )
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "quote_totals_simulation_only"
    assert client.get(f"/api/v1/events/{event_id}/plan").json()["proposals"] == []


def test_stale_proposal_is_rejected(client) -> None:
    event_id, _ = _seed(client)
    proposal = client.post(
        f"/api/v1/events/{event_id}/proposals",
        json={"change": {"kind": "guest_count", "guest_count": 210}},
        headers=headers(client),
    ).json()

    bumped = client.patch(
        f"/api/v1/events/{event_id}",
        json={"name": "Renamed mid-flight", "expected_version": 1},
        headers=headers(client),
    )
    assert bumped.status_code == 200

    approve = client.post(
        f"/api/v1/events/{event_id}/proposals/{proposal['id']}/approve",
        headers=headers(client),
    )
    assert approve.status_code == 409
    assert approve.json()["error"]["code"] == "version_conflict"

    plan = client.get(f"/api/v1/events/{event_id}/plan").json()
    assert plan["event"]["guest_count"] == 180
    assert plan["revisions"] == []


def test_budget_item_edit_blocks_approval_until_resimulated(client) -> None:
    """A separate-row edit does not bump event.version, so approval fingerprints the snapshot."""
    event_id, _ = _seed(client)
    items = client.get(f"/api/v1/events/{event_id}/plan").json()["items"]
    catering = next(item for item in items if item["label"] == "Catering")

    proposal = client.post(
        f"/api/v1/events/{event_id}/proposals",
        json={"change": {"kind": "guest_count", "guest_count": 200}},
        headers=headers(client),
    )
    assert proposal.status_code == 201, proposal.text
    proposal_id = proposal.json()["id"]

    edited = client.patch(
        f"/api/v1/events/{event_id}/budget-items/{catering['id']}",
        json={"unit_amount_minor": 400_000},
        headers=headers(client),
    )
    assert edited.status_code == 200, edited.text

    approve = client.post(
        f"/api/v1/events/{event_id}/proposals/{proposal_id}/approve",
        headers=headers(client),
    )
    assert approve.status_code == 409
    error = approve.json()["error"]
    assert error["code"] == "baseline_changed"
    assert error["details"]["proposal_base_version"] == 1
    assert error["details"]["current_version"] == 1
    assert error["details"]["proposal_baseline_hash"]
    assert error["details"]["current_baseline_hash"]
    assert (
        error["details"]["proposal_baseline_hash"]
        != error["details"]["current_baseline_hash"]
    )

    stale_plan = client.get(f"/api/v1/events/{event_id}/plan").json()
    assert stale_plan["event"]["guest_count"] == 180
    assert stale_plan["event"]["version"] == 1
    assert stale_plan["revisions"] == []
    assert (
        next(item for item in stale_plan["items"] if item["id"] == catering["id"])[
            "unit_amount_minor"
        ]
        == 400_000
    )

    fresh = client.post(
        f"/api/v1/events/{event_id}/simulate",
        json={"kind": "guest_count", "guest_count": 200},
        headers=headers(client),
    ).json()
    assert fresh["baseline"]["committed_minor"] == 150_160_000
    assert fresh["projected"]["committed_minor"] == 158_400_000
    assert fresh["feasible"] is True

    fresh_proposal = client.post(
        f"/api/v1/events/{event_id}/proposals",
        json={"change": {"kind": "guest_count", "guest_count": 200}},
        headers=headers(client),
    )
    assert fresh_proposal.status_code == 201, fresh_proposal.text
    approved = client.post(
        f"/api/v1/events/{event_id}/proposals/{fresh_proposal.json()['id']}/approve",
        headers=headers(client),
    )
    assert approved.status_code == 200, approved.text
    assert approved.json()["revision"]["version"] == 2

    final = client.get(f"/api/v1/events/{event_id}/plan").json()
    assert final["event"]["guest_count"] == 200
    assert final["event"]["version"] == 2
    assert final["totals"]["committed_minor"] == 158_400_000
    assert final["totals"]["remaining_spendable_minor"] == 3_600_000
    assert final["totals"]["remaining_budget_minor"] == 21_600_000
    assert final["revisions"][0]["after_json"]["item_units"][catering["id"]] == 400_000


def test_proposal_without_baseline_hash_cannot_be_approved(client) -> None:
    """Fail closed for drafts created before baseline verification existed."""
    event_id, _ = _seed(client)
    proposal = client.post(
        f"/api/v1/events/{event_id}/proposals",
        json={"change": {"kind": "guest_count", "guest_count": 200}},
        headers=headers(client),
    ).json()

    with get_session_factory()() as db:
        row = db.get(Proposal, uuid.UUID(proposal["id"]))
        assert row is not None
        row.impact = {
            key: value for key, value in row.impact.items() if key != "baseline_hash"
        }
        db.commit()

    approve = client.post(
        f"/api/v1/events/{event_id}/proposals/{proposal['id']}/approve",
        headers=headers(client),
    )
    assert approve.status_code == 409
    assert approve.json()["error"]["code"] == "baseline_changed"
    assert client.get(f"/api/v1/events/{event_id}/plan").json()["revisions"] == []


def test_budget_edit_and_approval_serialize(client, owner) -> None:
    """Both writes take the event row lock; either order is valid, a torn state is not."""
    from fastapi.testclient import TestClient
    from tests.support import login

    from utsavos.main import app

    event = create_event(client)
    items = seed_standard_items(client, event["id"])
    catering_id = items["catering"]["id"]
    proposal = client.post(
        f"/api/v1/events/{event['id']}/proposals",
        json={"change": {"kind": "guest_count", "guest_count": 200}},
        headers=headers(client),
    ).json()

    barrier = threading.Barrier(2)
    results: list[tuple[str, int, dict]] = []
    results_lock = threading.Lock()

    def record(kind: str, response) -> None:
        with results_lock:
            results.append((kind, response.status_code, response.json()))

    def approve_worker() -> None:
        with TestClient(app) as worker:
            login(worker, owner["email"])
            barrier.wait(timeout=10)
            record(
                "approve",
                worker.post(
                    f"/api/v1/events/{event['id']}/proposals/{proposal['id']}/approve",
                    headers=headers(worker),
                ),
            )

    def edit_worker() -> None:
        with TestClient(app) as worker:
            login(worker, owner["email"])
            barrier.wait(timeout=10)
            record(
                "edit",
                worker.patch(
                    f"/api/v1/events/{event['id']}/budget-items/{catering_id}",
                    json={"unit_amount_minor": 400_000},
                    headers=headers(worker),
                ),
            )

    threads = [threading.Thread(target=approve_worker), threading.Thread(target=edit_worker)]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join(timeout=30)

    assert len(results) == 2, results
    by_kind = {kind: (status, body) for kind, status, body in results}
    assert by_kind["edit"][0] == 200
    approve_status, approve_body = by_kind["approve"]

    plan = client.get(f"/api/v1/events/{event['id']}/plan").json()
    current_item = next(item for item in plan["items"] if item["id"] == catering_id)
    assert current_item["unit_amount_minor"] == 400_000

    if approve_status == 200:
        assert plan["event"]["guest_count"] == 200
        assert plan["event"]["version"] == 2
        assert len(plan["revisions"]) == 1
        # Approval used the old baseline; the edit landed after it.
        assert plan["revisions"][0]["after_json"]["item_units"][catering_id] == 380_000
    else:
        assert approve_status == 409, approve_body
        assert approve_body["error"]["code"] == "baseline_changed"
        assert plan["event"]["guest_count"] == 180
        assert plan["event"]["version"] == 1
        assert plan["revisions"] == []


def test_two_approvals_race_without_lost_update(client, owner) -> None:
    event = create_event(client)
    seed_standard_items(client, event["id"])
    proposal = client.post(
        f"/api/v1/events/{event['id']}/proposals",
        json={"change": {"kind": "guest_count", "guest_count": 200}},
        headers=headers(client),
    ).json()
    user_id = uuid.UUID(owner["user"]["id"])
    event_uuid = uuid.UUID(event["id"])
    proposal_uuid = uuid.UUID(proposal["id"])
    barrier = threading.Barrier(2)
    results: list[object] = []

    def worker() -> None:
        with get_session_factory()() as db:
            barrier.wait(timeout=10)
            try:
                _, revision, replay = planning_service.approve_proposal(
                    db, user_id, event_uuid, proposal_uuid
                )
                results.append((replay, revision.version))
            except ServiceError as exc:
                results.append(exc.code)
            finally:
                db.rollback()

    threads = [threading.Thread(target=worker) for _ in range(2)]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join(timeout=30)

    assert len(results) == 2
    replays = [value for value in results if isinstance(value, tuple)]
    assert len(replays) == 2, results
    assert sorted(replay for replay, _ in replays) == [False, True]
    assert {version for _, version in replays} == {2}

    plan = client.get(f"/api/v1/events/{event['id']}/plan").json()
    assert plan["event"]["version"] == 2
    assert plan["event"]["guest_count"] == 200
    assert len(plan["revisions"]) == 1

def test_plan_and_simulation_expose_baseline_fingerprint(client) -> None:
    event_id, _ = _seed(client)
    plan = client.get(f"/api/v1/events/{event_id}/plan").json()
    assert len(plan["baseline_hash"]) == 64
    simulation = client.post(
        f"/api/v1/events/{event_id}/simulate",
        json={"kind": "guest_count", "guest_count": 200},
        headers=headers(client),
    ).json()
    assert simulation["base_version"] == plan["event"]["version"]
    assert simulation["baseline_hash"] == plan["baseline_hash"]

    items = plan["items"]
    catering = next(item for item in items if item["label"] == "Catering")
    edited = client.patch(
        f"/api/v1/events/{event_id}/budget-items/{catering['id']}",
        json={"unit_amount_minor": 400_000},
        headers=headers(client),
    )
    assert edited.status_code == 200
    changed = client.get(f"/api/v1/events/{event_id}/plan").json()
    assert changed["event"]["version"] == plan["event"]["version"]
    assert changed["baseline_hash"] != plan["baseline_hash"]


def test_stale_preview_cannot_create_a_proposal(client) -> None:
    event_id, _ = _seed(client)
    preview = client.post(
        f"/api/v1/events/{event_id}/simulate",
        json={"kind": "guest_count", "guest_count": 200},
        headers=headers(client),
    ).json()
    items = client.get(f"/api/v1/events/{event_id}/plan").json()["items"]
    catering = next(item for item in items if item["label"] == "Catering")
    assert (
        client.patch(
            f"/api/v1/events/{event_id}/budget-items/{catering['id']}",
            json={"unit_amount_minor": 400_000},
            headers=headers(client),
        ).status_code
        == 200
    )

    response = client.post(
        f"/api/v1/events/{event_id}/proposals",
        json={
            "change": {"kind": "guest_count", "guest_count": 200},
            "expected_base_version": preview["base_version"],
            "expected_baseline_hash": preview["baseline_hash"],
        },
        headers=headers(client),
    )
    assert response.status_code == 409
    error = response.json()["error"]
    assert error["code"] == "baseline_changed"
    assert error["details"]["expected_baseline_hash"] == preview["baseline_hash"]
    assert error["details"]["current_baseline_hash"] != preview["baseline_hash"]
    assert _counts(event_id)["proposals"] == 0


def test_duplicate_draft_is_rejected_until_the_first_is_closed(client) -> None:
    event_id, _ = _seed(client)
    payload = {"change": {"kind": "guest_count", "guest_count": 200}}
    first = client.post(
        f"/api/v1/events/{event_id}/proposals", json=payload, headers=headers(client)
    )
    assert first.status_code == 201, first.text
    duplicate = client.post(
        f"/api/v1/events/{event_id}/proposals", json=payload, headers=headers(client)
    )
    assert duplicate.status_code == 409
    assert duplicate.json()["error"]["code"] == "duplicate_proposal"
    assert _counts(event_id)["proposals"] == 1

    rejected = client.post(
        f"/api/v1/events/{event_id}/proposals/{first.json()['id']}/reject",
        json={"reason": "Redraft"},
        headers=headers(client),
    )
    assert rejected.status_code == 200
    again = client.post(
        f"/api/v1/events/{event_id}/proposals", json=payload, headers=headers(client)
    )
    assert again.status_code == 201, again.text


def test_history_endpoints_report_totals_and_accept_offsets(client) -> None:
    event_id, _ = _seed(client)
    first = client.post(
        f"/api/v1/events/{event_id}/proposals",
        json={"change": {"kind": "guest_count", "guest_count": 200}},
        headers=headers(client),
    )
    assert first.status_code == 201, first.text
    second = client.post(
        f"/api/v1/events/{event_id}/proposals",
        json={"change": {"kind": "guest_count", "guest_count": 210}},
        headers=headers(client),
    )
    assert second.status_code == 201, second.text

    approved = client.post(
        f"/api/v1/events/{event_id}/proposals/{first.json()['id']}/approve",
        headers=headers(client),
    )
    assert approved.status_code == 200, approved.text

    plan = client.get(f"/api/v1/events/{event_id}/plan").json()
    assert plan["proposal_total"] == 2
    assert plan["revision_total"] == 1

    proposals = client.get(
        f"/api/v1/events/{event_id}/proposals", params={"limit": 1, "offset": 1}
    )
    assert proposals.status_code == 200
    assert proposals.json()["total"] == 2
    assert proposals.json()["offset"] == 1
    assert len(proposals.json()["items"]) == 1

    revisions = client.get(
        f"/api/v1/events/{event_id}/revisions", params={"limit": 1, "offset": 0}
    )
    assert revisions.status_code == 200
    assert revisions.json()["total"] == 1
    assert len(revisions.json()["items"]) == 1


def test_invalid_simulation_returns_422_not_500(client) -> None:
    event_id, _ = _seed(client)
    response = client.post(
        f"/api/v1/events/{event_id}/simulate",
        json={"kind": "budget", "reserve_minor": 200_000_000},
        headers=headers(client),
    )
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "invalid_change"


def test_ai_routes_map_invalid_change_to_422(client) -> None:
    event_id, _ = _seed(client)
    for path in ("ai/explain", "ai/directions"):
        response = client.post(
            f"/api/v1/events/{event_id}/{path}",
            json={"change": {"kind": "budget", "reserve_minor": 200_000_000}},
            headers=headers(client),
        )
        assert response.status_code == 422, (path, response.text)
        assert response.json()["error"]["code"] == "invalid_change"
