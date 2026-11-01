"""Parsing, strict validation, and deterministic fallback for AI output."""

from __future__ import annotations

import json
import re
from typing import Any, Literal, TypeVar

from pydantic import BaseModel, ConfigDict, Field, ValidationError

_NUMBER = re.compile(r"\d[\d,]*")
ModelT = TypeVar("ModelT", bound=BaseModel)


class AIOutputInvalid(Exception):
    pass


class _Strict(BaseModel):
    model_config = ConfigDict(extra="forbid")


class ImpactExplanation(_Strict):
    summary: str = Field(min_length=1, max_length=600)
    trade_offs: list[str] = Field(default_factory=list, max_length=4)

    def __iter__(self):  # type: ignore[no-untyped-def]
        return iter(self.model_dump().items())


class PreferenceInterpretation(_Strict):
    summary: str = Field(min_length=1, max_length=400)
    guest_count: int | None = Field(default=None, ge=0, le=100_000)
    budget_minor: int | None = Field(default=None, ge=0, le=10**14)
    priorities: list[Literal["cost", "guests", "experience", "timeline", "venue"]] = Field(
        default_factory=list, max_length=4
    )


class Direction(_Strict):
    alternative_id: str = Field(min_length=1, max_length=80)
    reason: str = Field(min_length=1, max_length=300)


class DirectionList(_Strict):
    items: list[Direction] = Field(min_length=1, max_length=4)


def parse_json(text: str) -> dict[str, Any]:
    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```[a-zA-Z]*\s*", "", cleaned)
        cleaned = re.sub(r"\s*```$", "", cleaned)
    try:
        data = json.loads(cleaned)
    except json.JSONDecodeError as exc:
        raise AIOutputInvalid("output was not valid JSON") from exc
    if not isinstance(data, dict):
        raise AIOutputInvalid("output must be a JSON object")
    return data


def validate(model: type[ModelT], raw: str) -> ModelT:
    try:
        return model.model_validate(parse_json(raw))
    except ValidationError as exc:
        raise AIOutputInvalid("output failed schema validation") from exc


def numeric_tokens(text: str) -> set[str]:
    return {match.replace(",", "") for match in _NUMBER.findall(text)}


def collect_allowed_numbers(payload: Any) -> set[str]:
    tokens: set[str] = set()

    def walk(value: Any) -> None:
        if isinstance(value, bool):
            return
        if isinstance(value, int):
            tokens.add(str(value))
            return
        if isinstance(value, str):
            tokens.update(numeric_tokens(value))
            return
        if isinstance(value, dict):
            for item in value.values():
                walk(item)
            return
        if isinstance(value, (list, tuple)):
            for item in value:
                walk(item)

    walk(payload)
    return tokens


def grounded(text: str, allowed: set[str]) -> bool:
    """Reject prose that contains a number not present in the computed fact sheet."""
    return numeric_tokens(text).issubset(allowed)
