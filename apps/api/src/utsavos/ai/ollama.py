"""Ollama provider for the local `gemma4:e2b` model.

Measured on the development machine (8 GB RAM, no discrete GPU): cold load about
14 s, warm generation 20-32 tok/s at 4k context. `think` must be False or the
model spends the output budget on reasoning and returns empty content.
"""

from __future__ import annotations

import logging
from typing import Any

import httpx

from ..config import Settings
from .base import Prompt, ProviderUnavailable

logger = logging.getLogger("utsavos.ai.ollama")


class OllamaProvider:
    name = "ollama"

    def __init__(self, settings: Settings) -> None:
        self.base_url = settings.ollama_base_url.rstrip("/")
        self.model = settings.ollama_model
        self.timeout = settings.ai_timeout_seconds

    async def available(self) -> bool:
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                response = await client.get(f"{self.base_url}/api/tags")
                response.raise_for_status()
                names = {model["name"] for model in response.json().get("models", [])}
        except Exception:
            return False
        return self.model in names or any(
            name.split(":")[0] == self.model.split(":")[0] for name in names
        )

    async def generate(self, prompt: Prompt) -> str:
        payload: dict[str, Any] = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": prompt.system},
                {"role": "user", "content": prompt.user},
            ],
            "stream": False,
            "think": False,
            "format": prompt.schema,
            "keep_alive": "5m",
            "options": {
                "num_ctx": 4096,
                "num_predict": min(prompt.max_output_tokens, 300),
                "temperature": 0.1,
            },
        }
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.post(f"{self.base_url}/api/chat", json=payload)
                response.raise_for_status()
                data = response.json()
        except Exception as exc:  # network, timeout, HTTP error, bad JSON
            logger.warning("ollama request failed: %s", type(exc).__name__)
            raise ProviderUnavailable("ollama unavailable") from exc

        if "error" in data:
            logger.warning("ollama returned an error: %s", str(data["error"])[:120])
            raise ProviderUnavailable("ollama error")
        content = (data.get("message") or {}).get("content") or ""
        if not content.strip():
            raise ProviderUnavailable("ollama returned empty content (check think=false)")
        return content


def build(settings: Settings) -> OllamaProvider:
    return OllamaProvider(settings)
