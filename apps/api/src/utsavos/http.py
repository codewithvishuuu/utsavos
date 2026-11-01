"""HTTP response hardening shared by normal and error responses."""

from __future__ import annotations

from fastapi import Response

from .config import Settings

SECURITY_HEADERS = {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "no-referrer",
    "Permissions-Policy": "geolocation=(), microphone=(), camera=()",
}
# The SPA is same-origin with external Vite assets and no inline script/style.
CONTENT_SECURITY_POLICY = "; ".join(
    (
        "default-src 'self'",
        "base-uri 'self'",
        "object-src 'none'",
        "frame-ancestors 'none'",
        "frame-src 'none'",
        "script-src 'self'",
        "style-src 'self'",
        "img-src 'self' data:",
        "font-src 'self'",
        "connect-src 'self'",
        "form-action 'self'",
    )
)


def apply_security_headers(
    response: Response, request_id: str, path: str, settings: Settings
) -> None:
    response.headers["X-Request-ID"] = request_id
    for header, value in SECURITY_HEADERS.items():
        response.headers.setdefault(header, value)
    if settings.is_production:
        response.headers.setdefault(
            "Strict-Transport-Security",
            f"max-age={settings.hsts_max_age_seconds}; includeSubDomains",
        )
    # Swagger UI loads CDN and inline assets. It is dev-only, disabled in production.
    if settings.is_production or not path.startswith("/api/docs"):
        response.headers.setdefault("Content-Security-Policy", CONTENT_SECURITY_POLICY)
    if path.startswith("/api/"):
        # API responses can contain private event, account and AI data. Never reuse them.
        response.headers.setdefault("Cache-Control", "no-store")
        response.headers.setdefault("Pragma", "no-cache")
