"""Gemini provider. Server-side key only, finite timeout, no retry storms."""

from __future__ import annotations

import asyncio
import logging
from typing import Any

from ..config import Settings
from .base import Prompt, ProviderUnavailable

logger = logging.getLogger("utsavos.ai.gemini")


class GeminiProvider:
    name = "gemini"

    def __init__(self, settings: Settings) -> None:
        if not settings.gemini_api_key:
            raise ProviderUnavailable("gemini key not configured")
        self._api_key = settings.gemini_api_key
        self.model = settings.gemini_model
        self.timeout = min(settings.ai_timeout_seconds, 60)
        self._client: Any = None

    def _client_or_create(self) -> Any:
        if self._client is None:
            from google import genai

            self._client = genai.Client(api_key=self._api_key)
        return self._client

    async def available(self) -> bool:
        return True

    def _generate_sync(self, prompt: Prompt) -> str:
        from google.genai import types

        response = self._client_or_create().models.generate_content(
            model=self.model,
            contents=prompt.user,
            config=types.GenerateContentConfig(
                system_instruction=prompt.system,
                response_mime_type="application/json",
                response_schema=prompt.schema,
                temperature=0.1,
                max_output_tokens=min(prompt.max_output_tokens, 600),
            ),
        )
        text = getattr(response, "text", None)
        if not text:
            raise ProviderUnavailable("gemini returned no text (possibly a safety block)")
        return str(text)

    async def generate(self, prompt: Prompt) -> str:
        try:
            return await asyncio.wait_for(
                asyncio.to_thread(self._generate_sync, prompt), timeout=self.timeout
            )
        except ProviderUnavailable:
            raise
        except Exception as exc:
            logger.warning("gemini request failed: %s", type(exc).__name__)
            raise ProviderUnavailable("gemini unavailable") from exc


def build(settings: Settings) -> GeminiProvider:
    return GeminiProvider(settings)
