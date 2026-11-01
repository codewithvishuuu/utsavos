"""In-process fixed-window rate limiter.

shortcut: one process only; a multi-worker deployment needs a shared store
(Redis or the database), upgrade when running more than one API worker.
"""

from __future__ import annotations

import threading
import time
from collections import defaultdict


class RateLimiter:
    def __init__(self, limit: int, window_seconds: int = 60) -> None:
        self.limit = limit
        self.window = window_seconds
        self._hits: dict[str, list[float]] = defaultdict(list)
        self._lock = threading.Lock()

    def allow(self, key: str) -> bool:
        now = time.monotonic()
        cutoff = now - self.window
        with self._lock:
            hits = [stamp for stamp in self._hits[key] if stamp > cutoff]
            if len(hits) >= self.limit:
                self._hits[key] = hits
                return False
            hits.append(now)
            self._hits[key] = hits
            if len(self._hits) > 10_000:
                self._hits = defaultdict(
                    list,
                    {k: v for k, v in self._hits.items() if v and v[-1] > cutoff},
                )
            return True

    def reset(self) -> None:
        with self._lock:
            self._hits.clear()
