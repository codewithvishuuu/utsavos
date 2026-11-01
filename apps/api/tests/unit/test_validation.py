"""AI output validation: strict schemas and number grounding."""

from __future__ import annotations

import pytest

from utsavos.ai.validation import (
    AIOutputInvalid,
    DirectionList,
    ImpactExplanation,
    collect_allowed_numbers,
    grounded,
    numeric_tokens,
    parse_json,
    validate,
)


def test_number_tokens_strip_indian_grouping() -> None:
    assert numeric_tokens("₹18,00,000 and 8,080") == {"1800000", "8080"}


def test_grounding_accepts_only_fact_sheet_numbers() -> None:
    allowed = collect_allowed_numbers({"committed": 170_080_000, "display": "₹17,00,800"})
    assert grounded("Committed cost is ₹17,00,800.", allowed)
    assert not grounded("Committed cost is ₹9,99,999.", allowed)
    assert not grounded("This adds 12 new vendors.", allowed)


def test_json_fences_are_tolerated_but_garbage_is_not() -> None:
    assert parse_json('```json\n{"a": 1}\n```') == {"a": 1}
    with pytest.raises(AIOutputInvalid):
        parse_json("not json")


def test_extra_fields_are_rejected() -> None:
    with pytest.raises(AIOutputInvalid):
        validate(ImpactExplanation, '{"summary": "ok", "total": 5}')


def test_length_limits_are_enforced() -> None:
    with pytest.raises(AIOutputInvalid):
        validate(ImpactExplanation, '{"summary": "' + "x" * 601 + '"}')


def test_direction_list_requires_items() -> None:
    with pytest.raises(AIOutputInvalid):
        validate(DirectionList, '{"items": []}')
