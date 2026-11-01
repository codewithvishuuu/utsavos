"""Consistent JSON error envelope and exception handlers."""

from __future__ import annotations

import logging
import time
from typing import Any

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from sqlalchemy.exc import TimeoutError as SQLAlchemyTimeoutError
from starlette.exceptions import HTTPException as StarletteHTTPException

from ..config import get_settings
from ..domain.planning import InvalidChange
from ..http import apply_security_headers
from ..observability import log_request_completed
from ..services.errors import ServiceError

logger = logging.getLogger("utsavos.errors")


class APIException(Exception):
    def __init__(
        self,
        status: int,
        code: str,
        message: str,
        details: dict[str, Any] | None = None,
    ) -> None:
        self.status = status
        self.code = code
        self.message = message
        self.details = details or {}


def api_error(
    status: int, code: str, message: str, details: dict[str, Any] | None = None
) -> APIException:
    return APIException(status, code, message, details)


def _body(code: str, message: str, details: dict[str, Any] | None, request_id: str) -> dict:
    return {
        "error": {
            "code": code,
            "message": message,
            "details": details or {},
            "request_id": request_id,
        }
    }


def install_error_handlers(app: FastAPI) -> None:
    def request_id(request: Request) -> str:
        return getattr(request.state, "request_id", "unknown")

    @app.exception_handler(APIException)
    async def handle_api(request: Request, exc: APIException) -> JSONResponse:
        return JSONResponse(
            status_code=exc.status,
            content=_body(exc.code, exc.message, exc.details, request_id(request)),
        )

    @app.exception_handler(ServiceError)
    async def handle_service(request: Request, exc: ServiceError) -> JSONResponse:
        return JSONResponse(
            status_code=exc.status,
            content=_body(exc.code, exc.message, exc.details, request_id(request)),
        )

    @app.exception_handler(InvalidChange)
    async def handle_invalid_change(request: Request, exc: InvalidChange) -> JSONResponse:
        return JSONResponse(
            status_code=422,
            content=_body(
                "invalid_change", str(exc) or "Invalid change", None, request_id(request)
            ),
        )

    @app.exception_handler(RequestValidationError)
    async def handle_validation(request: Request, exc: RequestValidationError) -> JSONResponse:
        fields = [
            {"loc": ".".join(str(part) for part in error["loc"]), "msg": error["msg"]}
            for error in exc.errors()
        ]
        return JSONResponse(
            status_code=422,
            content=_body(
                "validation_error", "Request validation failed", {"fields": fields},
                request_id(request),
            ),
        )

    @app.exception_handler(StarletteHTTPException)
    async def handle_http(request: Request, exc: StarletteHTTPException) -> JSONResponse:
        code = "not_found" if exc.status_code == 404 else "http_error"
        return JSONResponse(
            status_code=exc.status_code,
            content=_body(code, str(exc.detail), None, request_id(request)),
        )

    @app.exception_handler(SQLAlchemyTimeoutError)
    async def handle_pool_timeout(
        request: Request, exc: SQLAlchemyTimeoutError
    ) -> JSONResponse:
        # Pool acquisition exceeded pool_timeout: bounded, controlled failure
        # without database internals. Headers and completion logs are applied
        # by the request middleware, unlike the unhandled-500 path.
        rid = request_id(request)
        logger.warning("database pool timeout", extra={"request_id": rid})
        return JSONResponse(
            status_code=503,
            content=_body(
                "service_unavailable", "The service is busy. Try again shortly.", None, rid
            ),
        )

    @app.exception_handler(Exception)
    async def handle_unexpected(request: Request, exc: Exception) -> JSONResponse:
        rid = request_id(request)
        logger.exception("unhandled error", extra={"request_id": rid})
        response = JSONResponse(
            status_code=500,
            content=_body(
                "internal_error",
                "Something went wrong on our side.",
                None,
                rid,
            ),
        )
        # This handler runs in ServerErrorMiddleware, outside the request
        # middleware, so it must harden its own response and log completion.
        settings = getattr(request.app.state, "settings", None) or get_settings()
        apply_security_headers(response, rid, request.url.path, settings)
        started = getattr(request.state, "started_at", time.monotonic())
        log_request_completed(request, 500, started, rid)
        return response
