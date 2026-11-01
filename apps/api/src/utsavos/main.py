"""FastAPI application factory: middleware, routers, health, SPA serving."""

from __future__ import annotations

import logging
import mimetypes
import time
import uuid
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from starlette.middleware.gzip import GZipMiddleware

from .api import ai, auth, demo, events, planning
from .api.errors import install_error_handlers
from .config import get_settings
from .db import check_database
from .demo.service import load_fixture
from .http import apply_security_headers
from .observability import (
    configure_logging,
    log_request_completed,
    request_id_from_header,
    request_id_var,
)

logger = logging.getLogger("utsavos")

WEB_DIST = Path(__file__).resolve().parents[3] / "web" / "dist"
API_PREFIX = "/api/v1"

# Python's mimetypes table has no entry for .woff2; the SPA serves real fonts.
mimetypes.add_type("font/woff2", ".woff2")

# Vite emits content-hashed filenames under assets/, safe to cache forever.
HASHED_ASSET_CACHE = "public, max-age=31536000, immutable"
# Unhashed public assets (fonts, images) get a short, revalidatable lifetime.
PUBLIC_ASSET_CACHE = "public, max-age=3600"


def _static_cache_policy(path: str) -> str:
    if path.startswith("assets/"):
        return HASHED_ASSET_CACHE
    return PUBLIC_ASSET_CACHE


@asynccontextmanager
async def lifespan(app: FastAPI):  # type: ignore[no-untyped-def]
    settings = get_settings()
    configure_logging(settings.log_level)
    settings.validate_runtime()
    fixture = load_fixture()  # fail fast if the demo fixture is invalid
    logger.info(
        "starting app env=%s demo_fixture=%s v%s",
        settings.app_env,
        fixture.id,
        fixture.version,
    )
    yield
    logger.info("shutting down")


def create_app() -> FastAPI:
    settings = get_settings()
    web_dist = Path(settings.web_dist_dir) if settings.web_dist_dir else WEB_DIST
    app = FastAPI(
        title="UtsavOS API",
        version="0.1.0",
        lifespan=lifespan,
        docs_url="/api/docs" if not settings.is_production else None,
        redoc_url=None,
        openapi_url="/api/openapi.json" if not settings.is_production else None,
    )
    app.state.settings = settings
    install_error_handlers(app)
    # gzip for JSON APIs and static assets when the client supports it
    app.add_middleware(GZipMiddleware, minimum_size=1024)

    if not settings.is_production:
        app.add_middleware(
            CORSMiddleware,
            allow_origins=settings.cors_origin_list,
            allow_credentials=True,
            allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
            allow_headers=["Content-Type", "X-CSRF-Token", "Idempotency-Key"],
            max_age=600,
        )

    @app.middleware("http")
    async def request_context(request: Request, call_next):  # type: ignore[no-untyped-def]
        inbound = request_id_from_header(request.headers.get("X-Request-ID"))
        request_id = inbound or uuid.uuid4().hex
        request.state.request_id = request_id
        request.state.started_at = time.monotonic()
        token = request_id_var.set(request_id)
        try:
            length = request.headers.get("content-length")
            if length and length.isdigit() and int(length) > settings.max_request_bytes:
                response = JSONResponse(
                    status_code=413,
                    content={
                        "error": {
                            "code": "payload_too_large",
                            "message": "Request body is too large",
                            "details": {},
                            "request_id": request_id,
                        }
                    },
                )
                apply_security_headers(response, request_id, request.url.path, settings)
                log_request_completed(
                    request, 413, request.state.started_at, request_id
                )
                return response
            response = await call_next(request)
            apply_security_headers(response, request_id, request.url.path, settings)
            log_request_completed(
                request, response.status_code, request.state.started_at, request_id
            )
            return response
        finally:
            request_id_var.reset(token)

    @app.get("/healthz", tags=["ops"])
    def healthz() -> dict:
        return {"status": "ok"}

    @app.get("/readyz", tags=["ops"])
    def readyz() -> JSONResponse:
        ok, reason = check_database()
        body = {"status": "ready" if ok else "not_ready", "database": ok}
        if reason:
            body["reason"] = reason
        return JSONResponse(status_code=200 if ok else 503, content=body)

    app.include_router(auth.router, prefix=API_PREFIX)
    app.include_router(events.router, prefix=API_PREFIX)
    app.include_router(planning.router, prefix=API_PREFIX)
    app.include_router(demo.router, prefix=API_PREFIX)
    app.include_router(ai.router, prefix=API_PREFIX)

    if (web_dist / "index.html").exists():

        @app.get("/{full_path:path}", include_in_schema=False)
        def spa(full_path: str) -> FileResponse:
            if full_path.startswith(("api/", "healthz", "readyz")):
                raise_error_404()
            candidate = (web_dist / full_path).resolve()
            if full_path and candidate.is_file() and web_dist in candidate.parents:
                response = FileResponse(candidate)
                # The catch-all also serves static files, so cache policy is set here.
                response.headers["Cache-Control"] = _static_cache_policy(full_path)
                return response
            # A path with a file extension is a static asset, never an SPA route:
            # a missing bundle must 404 instead of masquerading as HTML.
            if "." in Path(full_path).name:
                raise_error_404()
            response = FileResponse(web_dist / "index.html")
            # Always revalidate the HTML entry so new hashed bundles are picked up.
            response.headers["Cache-Control"] = "no-cache"
            return response

    return app


def raise_error_404() -> None:
    from fastapi import HTTPException

    raise HTTPException(status_code=404, detail="Not found")


app = create_app()
