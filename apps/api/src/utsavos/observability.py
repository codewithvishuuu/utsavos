"""Request-ID correlation, log configuration and safe request logs."""

from __future__ import annotations

import logging
import re
import time
from contextvars import ContextVar

from starlette.requests import Request

request_id_var: ContextVar[str] = ContextVar("request_id", default="-")

# Correlation IDs are untrusted input. Keep them bounded and one-line so they
# cannot forge log records; an invalid value is replaced with a generated ID.
_REQUEST_ID_PATTERN = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$")
_LOG_FORMAT = (
    "%(asctime)s %(levelname)s %(name)s request_id=%(request_id)s %(message)s"
)


class _RequestIdFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        if not hasattr(record, "request_id"):
            record.request_id = request_id_var.get()
        return True


_request_id_filter = _RequestIdFilter()


def request_id_from_header(value: str | None) -> str | None:
    """Return a safe inbound correlation ID, or None when it must be replaced."""
    if value is None:
        return None
    candidate = value.strip()
    return candidate if _REQUEST_ID_PATTERN.fullmatch(candidate) else None


def configure_logging(level: str) -> None:
    """Apply LOG_LEVEL and install one app formatter when no handler exists."""
    level_name = (level or "INFO").upper()
    level_value = logging.getLevelNamesMapping().get(level_name, logging.INFO)
    root = logging.getLogger()
    root.setLevel(level_value)
    if not root.handlers:
        handler = logging.StreamHandler()
        handler.setFormatter(logging.Formatter(_LOG_FORMAT))
        root.addHandler(handler)
    for root_handler in root.handlers:
        if _request_id_filter not in root_handler.filters:
            root_handler.addFilter(_request_id_filter)
    # These libraries log full URLs at INFO, including query strings.
    for library in ("httpx", "httpcore"):
        logging.getLogger(library).setLevel(logging.WARNING)


def log_request_completed(
    request: Request, status: int, started: float, request_id: str | None = None
) -> None:
    """Log method, path, status and timing only; never headers, cookies or bodies."""
    elapsed_ms = max(0, int((time.monotonic() - started) * 1000))
    logging.getLogger("utsavos.request").info(
        "request.completed method=%s path=%s status=%d duration_ms=%d",
        request.method,
        request.url.path,
        status,
        elapsed_ms,
        extra={"request_id": request_id or request_id_var.get()},
    )
