"""Adaptive engine: flagship scenario, alternatives, timeline, cycles."""

from __future__ import annotations

from datetime import date, timedelta

import pytest

from utsavos.demo.service import fixture_snapshot, load_fixture, scenario_change
from utsavos.domain.planning import (
    Ceremony,
    Change,
    Dependency,
    InvalidChange,
    Item,
    Snapshot,
    Task,
    apply_change,
    compute_totals,
    detect_cycle,
    project_snapshot,
    project_timeline,
    simulate,
)


def test_flagship_guest_increase_is_exact() -> None:
    result = simulate(fixture_snapshot(), scenario_change())
    assert result.projected.guest_count == 240
    assert result.projected.committed_minor == 170_080_000
    assert result.projected.committed_minor - result.baseline.committed_minor == 23_520_000
    assert result.projected.remaining_budget_minor == 9_920_000
    assert result.projected.remaining_spendable_minor == -8_080_000
    assert result.projected.spendable_shortfall_minor == 8_080_000
    assert result.feasible is False

    deltas = {line.label: line.delta for line in result.lines}
    assert deltas["Catering per guest"] == 22_800_000
    assert deltas["Invitations per guest"] == 720_000
    assert deltas["Remaining total budget"] == -23_520_000
    assert deltas["Spendable shortfall"] == 8_080_000


def test_flagship_alternatives_are_real_and_feasible() -> None:
    snapshot = fixture_snapshot()
    result = simulate(snapshot, scenario_change())
    ids = [alt.id for alt in result.alternatives]
    assert ids == ["release_reserve", "trim_per_guest", "reduce_guests", "increase_budget"]

    for alt in result.alternatives:
        projected = apply_change(snapshot, Change(kind="items", **alt.changes))
        totals = compute_totals(projected)
        assert totals.committed_minor <= totals.spendable_minor, alt.id
        assert alt.feasible is True
        assert alt.committed_after_minor == totals.committed_minor

    by_id = {alt.id: alt for alt in result.alternatives}
    assert by_id["reduce_guests"].changes["guest_count"] == 219
    assert by_id["increase_budget"].changes["budget_minor"] == 188_080_000
    assert by_id["release_reserve"].changes["reserve_minor"] == 9_920_000
    assert by_id["increase_budget"].budget_after_minor == 188_080_000
    assert by_id["trim_per_guest"].cost_impact_minor < 0
    assert sum(by_id["trim_per_guest"].changes["item_units"].values()) == 358_332


def test_no_alternatives_are_invented() -> None:
    snapshot = Snapshot(
        event_id="x",
        name="fixed only",
        guest_count=10,
        budget_minor=1_000_000,
        reserve_minor=0,
        event_date=date(2027, 2, 14),
        items=(Item(id="v", label="Venue", category="Venue", basis="fixed",
                    unit_amount_minor=2_000_000),),
    )
    result = simulate(snapshot, Change(kind="budget", budget_minor=500_000))
    assert result.feasible is False
    assert [alt.id for alt in result.alternatives] == ["increase_budget"]
    assert any("Only 1 feasible alternative" in note for note in result.alternative_notes)


def test_feasible_change_reports_no_alternatives_needed() -> None:
    result = simulate(fixture_snapshot(), Change(kind="guest_count", guest_count=190))
    assert result.feasible is True
    assert result.alternatives == []
    assert "no alternatives are required" in result.alternative_notes[0]


def test_budget_cut_is_infeasible() -> None:
    snapshot = fixture_snapshot()
    result = simulate(snapshot, Change(kind="budget", budget_minor=120_000_000))
    assert result.feasible is False
    assert result.projected.spendable_shortfall_minor == 44_560_000


def test_rejected_change_shapes_raise() -> None:
    snapshot = fixture_snapshot()
    with pytest.raises(InvalidChange):
        simulate(snapshot, Change(kind="guest_count", guest_count=100_001))
    with pytest.raises(InvalidChange):
        simulate(snapshot, Change(kind="budget", budget_minor=1_000, reserve_minor=2_000))
    with pytest.raises(InvalidChange):
        simulate(snapshot, Change(kind="items", item_units={"nope": 1}))


def test_date_change_moves_only_eligible_tasks() -> None:
    snapshot = fixture_snapshot()
    later = snapshot.event_date + timedelta(days=30)
    result = simulate(snapshot, Change(kind="date", event_date=later))
    moved = {change.task_id for change in result.task_changes}
    assert "book-venue" not in moved  # completed tasks stay put
    assert "transport" not in moved  # locked task stays put
    assert "menu-tasting" in moved
    assert all(change.after > change.before for change in result.task_changes)


def test_date_projection_moves_ceremonies_and_ui_tasks() -> None:
    event_date = date(2027, 2, 14)
    snapshot = Snapshot(
        event_id="x",
        name="x",
        guest_count=10,
        budget_minor=10_000_000,
        reserve_minor=0,
        event_date=event_date,
        tasks=(
            Task(
                id="task-ui",
                title="Send invites",
                status="todo",
                due_date=date(2026, 12, 1),
                offset_days=-75,
            ),
        ),
        ceremonies=(Ceremony(id="ceremony-1", name="Mehndi", ceremony_date=date(2027, 2, 12)),),
    )

    projected, task_changes, conflicts, ceremony_changes = project_snapshot(
        snapshot, Change(kind="date", event_date=event_date + timedelta(days=7))
    )

    assert projected.event_date == date(2027, 2, 21)
    assert projected.tasks[0].due_date == date(2026, 12, 8)
    assert projected.ceremonies[0].ceremony_date == date(2027, 2, 19)
    assert task_changes[0].task_id == "task-ui"
    assert ceremony_changes[0].ceremony_id == "ceremony-1"
    assert conflicts == []


def test_timeline_conflict_is_reported() -> None:
    event_date = date(2027, 2, 14)
    snapshot = Snapshot(
        event_id="x",
        name="x",
        guest_count=10,
        budget_minor=10_000_000,
        reserve_minor=0,
        event_date=event_date,
        tasks=(
            Task(id="a", title="A", status="todo", due_date=date(2027, 1, 1), offset_days=-44),
            Task(id="b", title="B", status="todo", due_date=date(2027, 1, 5),
                 offset_days=None, is_locked=True),
        ),
        dependencies=(Dependency("a", "b"),),
    )
    tasks, moved, conflicts = project_timeline(snapshot, event_date + timedelta(days=10))
    assert moved and moved[0].task_id == "a"
    assert conflicts and conflicts[0].predecessor_id == "a"
    assert "cannot move" in conflicts[0].message


def test_cycle_detection() -> None:
    tasks = tuple(
        Task(id=name, title=name, status="todo", due_date=date(2027, 1, 1))
        for name in ("a", "b", "c")
    )
    assert detect_cycle(tasks, (Dependency("a", "b"), Dependency("b", "c"))) is None
    cycle = detect_cycle(
        tasks, (Dependency("a", "b"), Dependency("b", "c"), Dependency("c", "a"))
    )
    assert cycle is not None
    assert cycle[0] == cycle[-1]


def test_engine_is_pure() -> None:
    snapshot = fixture_snapshot()
    before = (
        snapshot.guest_count,
        snapshot.budget_minor,
        snapshot.reserve_minor,
        len(snapshot.tasks),
    )
    simulate(snapshot, scenario_change())
    after = (
        snapshot.guest_count,
        snapshot.budget_minor,
        snapshot.reserve_minor,
        len(snapshot.tasks),
    )
    assert before == after


def test_fixture_is_versioned_synthetic_data() -> None:
    fixture = load_fixture()
    assert fixture.version >= 1
    assert "Synthetic" in fixture.disclaimer

def test_timeline_overflow_is_an_invalid_change() -> None:
    snapshot = Snapshot(
        event_id="x",
        name="x",
        guest_count=10,
        budget_minor=10_000_000,
        reserve_minor=0,
        event_date=date(9999, 12, 25),
        tasks=(
            Task(
                id="a",
                title="A",
                status="todo",
                due_date=date(9999, 12, 26),
                offset_days=1,
            ),
        ),
    )
    with pytest.raises(InvalidChange, match="outside the supported range"):
        project_timeline(snapshot, date(9999, 12, 31))
