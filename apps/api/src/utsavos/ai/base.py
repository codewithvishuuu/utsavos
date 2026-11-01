"""Provider contract. AI is an optional explanation layer, never the planner."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Protocol


class ProviderUnavailable(Exception):
    """Provider is disabled, unreachable, misconfigured, or returned nothing usable."""


@dataclass(frozen=True)
class Prompt:
    task: str
    system: str
    user: str
    schema: dict[str, Any]
    max_output_tokens: int = 400


class Provider(Protocol):
    name: str

    async def available(self) -> bool: ...

    async def generate(self, prompt: Prompt) -> str: ...
