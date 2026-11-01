"""Budget engine: exact paise arithmetic and invariants."""

from __future__ import annotations

from hypothesis import given, settings
from hypothesis import strategies as st

from utsavos.demo.service import fixture_snapshot
from utsavos.domain.planning import (
    Change,
    Item,
    Snapshot,
    apply_change,
    compute_totals,
    item_amount,
)


def test_fixture_baseline_is_exact() -> None:
    totals = compute_totals(fixture_snapshot())
    assert totals.committed_minor == 146_560_000
    assert totals.fixed_minor == 76_000_000
    assert totals.per_guest_minor == 70_560_000
    assert totals.budget_minor == 180_000_000
    assert totals.reserve_minor == 18_000_000
    assert totals.spendable_minor == 162_000_000
    assert totals.remaining_budget_minor == 33_440_000
    assert totals.remaining_spendable_minor == 15_440_000
    assert totals.spendable_shortfall_minor == 0
    assert totals.per_guest_average_minor == 392_000
    assert totals.over_budget is False


def test_flagship_projection_distinguishes_total_and_spendable() -> None:
    """The 80,800 shortfall is against spendable, not the 18,00,000 total budget."""
    snapshot = fixture_snapshot()
    totals = compute_totals(apply_change(snapshot, Change(kind="guest_count", guest_count=240)))
    assert totals.budget_minor == 180_000_000
    assert totals.reserve_minor == 18_000_000
    assert totals.spendable_minor == 162_000_000
    assert totals.committed_minor == 170_080_000
    assert totals.remaining_budget_minor == 9_920_000
    assert totals.remaining_spendable_minor == -8_080_000
    assert totals.spendable_shortfall_minor == 8_080_000
    assert totals.over_budget is True
    # The reserve is untouched, so 99,200 rupees of total budget still exists.
    assert totals.remaining_budget_minor == totals.reserve_minor - totals.spendable_shortfall_minor


def test_category_and_vendor_totals_reconcile() -> None:
    totals = compute_totals(fixture_snapshot())
    assert sum(totals.category_totals.values()) == totals.committed_minor
    assert sum(totals.vendor_totals.values()) == 42_000_000 + 68_400_000


def test_fixture_task_dates_match_offsets() -> None:
    snapshot = fixture_snapshot()
    for task in snapshot.tasks:
        if task.offset_days is not None:
            from datetime import timedelta

            expected = snapshot.event_date + timedelta(days=task.offset_days)
            assert task.due_date == expected, task.id


def test_per_guest_cost_scales_linearly() -> None:
    snapshot = fixture_snapshot()
    at_180 = compute_totals(snapshot)
    at_240 = compute_totals(apply_change(snapshot, Change(kind="guest_count", guest_count=240)))
    assert at_240.committed_minor - at_180.committed_minor == 60 * 392_000


def test_over_total_budget_and_exact_spendable_boundaries() -> None:
    over = Snapshot(
        event_id="x",
        name="x",
        guest_count=10,
        budget_minor=10_000_000,
        reserve_minor=2_000_000,
        event_date=__import__("datetime").date(2027, 2, 14),
        items=(Item(id="f", label="f", category="A", basis="fixed", unit_amount_minor=12_000_000),),
    )
    totals = compute_totals(over)
    assert totals.spendable_minor == 8_000_000
    assert totals.remaining_budget_minor == -2_000_000
    assert totals.remaining_spendable_minor == -4_000_000
    assert totals.spendable_shortfall_minor == 4_000_000
    assert totals.over_budget is True

    exact = Snapshot(
        event_id="x",
        name="x",
        guest_count=10,
        budget_minor=10_000_000,
        reserve_minor=0,
        event_date=__import__("datetime").date(2027, 2, 14),
        items=(Item(id="f", label="f", category="A", basis="fixed", unit_amount_minor=10_000_000),),
    )
    exact_totals = compute_totals(exact)
    assert exact_totals.remaining_budget_minor == 0
    assert exact_totals.remaining_spendable_minor == 0
    assert exact_totals.spendable_shortfall_minor == 0
    assert exact_totals.over_budget is False


def test_zero_guests_keeps_fixed_costs() -> None:
    snapshot = fixture_snapshot()
    totals = compute_totals(apply_change(snapshot, Change(kind="guest_count", guest_count=0)))
    assert totals.per_guest_minor == 0
    assert totals.committed_minor == 76_000_000
    assert totals.per_guest_average_minor == 0


def test_confirmed_quote_overrides_estimate() -> None:
    snapshot = fixture_snapshot()
    changed = apply_change(
        snapshot,
        Change(kind="quote", quote_totals={"catering": 60_000_000}),
    )
    totals = compute_totals(changed)
    assert totals.vendor_totals["vendor-catering"] == 60_000_000
    assert totals.committed_minor == 146_560_000 - 68_400_000 + 60_000_000


@settings(max_examples=80, deadline=None)
@given(
    guests=st.integers(min_value=0, max_value=5_000),
    fixed=st.integers(min_value=0, max_value=10**9),
    unit=st.integers(min_value=0, max_value=10**7),
)
def test_totals_always_reconcile(guests: int, fixed: int, unit: int) -> None:
    snapshot = Snapshot(
        event_id="x",
        name="x",
        guest_count=guests,
        budget_minor=10**12,
        reserve_minor=0,
        event_date=__import__("datetime").date(2027, 2, 14),
        items=(
            Item(id="f", label="f", category="A", basis="fixed", unit_amount_minor=fixed),
            Item(id="p", label="p", category="B", basis="per_guest", unit_amount_minor=unit),
        ),
    )
    totals = compute_totals(snapshot)
    assert totals.committed_minor == totals.fixed_minor + totals.per_guest_minor
    assert totals.committed_minor == sum(totals.category_totals.values())
    assert totals.committed_minor >= 0
    assert totals.remaining_spendable_minor == totals.spendable_minor - totals.committed_minor
    assert totals.remaining_budget_minor == totals.budget_minor - totals.committed_minor
    assert totals.spendable_shortfall_minor == max(
        0, totals.committed_minor - totals.spendable_minor
    )
    assert totals.committed_minor == item_amount(snapshot.items[0], guests) + item_amount(
        snapshot.items[1], guests
    )


@given(
    low=st.integers(min_value=0, max_value=2_000),
    extra=st.integers(min_value=0, max_value=2_000),
    unit=st.integers(min_value=0, max_value=10**7),
)
def test_more_guests_never_lowers_cost(low: int, extra: int, unit: int) -> None:
    snapshot = Snapshot(
        event_id="x",
        name="x",
        guest_count=low,
        budget_minor=10**12,
        reserve_minor=0,
        event_date=__import__("datetime").date(2027, 2, 14),
        items=(Item(id="p", label="p", category="B", basis="per_guest", unit_amount_minor=unit),),
    )
    higher = apply_change(snapshot, Change(kind="guest_count", guest_count=low + extra))
    assert compute_totals(higher).committed_minor >= compute_totals(snapshot).committed_minor
