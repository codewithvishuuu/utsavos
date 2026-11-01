"""Container start script for Render: pin verified TLS, migrate, serve.

The Blueprint wires DATABASE_URL from `utsavos-pg`'s internal connection
string (no secret is ever entered manually or stored in Git). Internal
connections only support self-signed TLS, while production requires
`sslmode=verify-full`, so this module derives the external hostname and
upgrades the URL before serving. It fails closed (nonzero exit, deploy
fails visibly) when the URL is missing, no candidate hostname completes a
verified-TLS handshake, or the URL is not PostgreSQL. The upgraded URL never
leaves this container; failure logs only carry exception type names.
"""

from __future__ import annotations

import os
import sys
import time
from urllib.parse import ParseResult, quote, urlparse, urlunsplit

_REGION = "singapore"  # matches the utsavos-pg region pinned in render.yaml
_TLS_PARAMS = "sslmode=verify-full&sslrootcert=system"


def _external_hosts(host: str, region: str) -> list[str]:
    """External hostnames to try, documented primary-node pattern first.

    Render's external database host is `<database-id>-a.<region>-postgres
    .render.com`; the internal hostname is unqualified and may or may not
    carry the primary node's `-a` alias.
    """
    if "." in host:
        return [host]
    suffix = f".{region}-postgres.render.com"
    base = host[:-2] if host.endswith("-a") else host
    return [f"{base}-a{suffix}", f"{base}{suffix}"]


def _url(parsed: ParseResult, host: str, scheme: str = "postgresql+psycopg") -> str:
    username = quote(parsed.username or "", safe="")
    if parsed.password:
        username += f":{quote(parsed.password, safe='')}"
    netloc = f"{username}@{host}" if username else host
    if parsed.port is not None:
        netloc += f":{parsed.port}"
    return urlunsplit((scheme, netloc, parsed.path, _TLS_PARAMS, ""))


def external_database_url(internal_url: str, region: str) -> str:
    """Rebuild an internal Render Postgres URL as a verified-TLS external URL."""
    parsed = urlparse(internal_url)
    if parsed.scheme not in {"postgresql", "postgresql+psycopg"} or not parsed.hostname:
        raise ValueError("DATABASE_URL from Render must be a PostgreSQL URL")
    return _url(parsed, _external_hosts(parsed.hostname, region)[0])


def _connect_verified(probe_urls: list[str]) -> None:
    """Complete one verified-TLS handshake; raise when every candidate fails."""
    import psycopg

    last_error: type[Exception] | None = None
    for attempt in range(2):  # two passes tolerate a database still spinning up
        for probe in probe_urls:
            try:
                psycopg.connect(probe, connect_timeout=10).close()
                return
            except Exception as exc:  # noqa: BLE001 - only the type name is logged
                last_error = type(exc)
        if attempt == 0 and len(probe_urls) > 1:
            time.sleep(15)
    raise ConnectionError(f"no verified-TLS database connection ({last_error!r})")


def main() -> int:
    internal = os.environ.get("DATABASE_URL", "").strip()
    if not internal:
        print("utsavos.deploy: DATABASE_URL is not set", file=sys.stderr)
        return 1
    region = os.environ.get("DB_REGION", _REGION)
    parsed = urlparse(internal)
    if parsed.scheme not in {"postgresql", "postgresql+psycopg"} or not parsed.hostname:
        print("utsavos.deploy: DATABASE_URL from Render must be a PostgreSQL URL", file=sys.stderr)
        return 1
    hosts = _external_hosts(parsed.hostname, region)
    external = _url(parsed, hosts[0])
    # Probe with psycopg's bare scheme (SQLAlchemy's +psycopg suffix is removed).
    try:
        _connect_verified([_url(parsed, host, "postgresql") for host in hosts])
    except (ConnectionError, ValueError) as exc:
        print(f"utsavos.deploy: {exc}", file=sys.stderr)
        return 1
    # Migrations run before traffic; single worker keeps the limiters meaningful.
    port = os.environ.get("PORT", "8000")
    command = (
        "alembic upgrade head"
        " && exec uvicorn utsavos.main:app"
        f" --host 0.0.0.0 --port {port} --workers 1 --no-access-log"
    )
    os.environ["DATABASE_URL"] = external
    # Hand off inside the trusted container image (no user input in command).
    os.execvp("sh", ["sh", "-c", command])  # noqa: S606, S607 - trusted container hand-off
    return 0  # pragma: no cover - execvp does not return


if __name__ == "__main__":
    raise SystemExit(main())
