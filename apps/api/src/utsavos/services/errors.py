"""Service errors mapped to HTTP responses by the API layer."""

from __future__ import annotations

from typing import Any


class ServiceError(Exception):
    def __init__(
        self,
        status: int,
        code: str,
        message: str,
        details: dict[str, Any] | None = None,
    ) -> None:
        super().__init__(message)
        self.status = status
        self.code = code
        self.message = message
        self.details = details or {}


class NotFound(ServiceError):
    def __init__(self, message: str = "Not found") -> None:
        super().__init__(404, "not_found", message)


class Conflict(ServiceError):
    def __init__(self, code: str, message: str, details: dict[str, Any] | None = None) -> None:
        super().__init__(409, code, message, details)


class Unprocessable(ServiceError):
    def __init__(self, code: str, message: str, details: dict[str, Any] | None = None) -> None:
        super().__init__(422, code, message, details)
