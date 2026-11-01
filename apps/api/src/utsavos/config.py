"""Configuration loaded from environment variables, validated at startup."""

from __future__ import annotations

import socket
from functools import lru_cache
from ipaddress import ip_address, ip_network
from urllib.parse import ParseResult, parse_qs, urlparse

from pydantic import PrivateAttr, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

DEV_SECRET = "dev-only-insecure-secret-change-me"  # noqa: S105 - rejected in production
WEAK_DB_PASSWORDS = {"utsavos_dev", "postgres", "password", "changeme", "change-me"}


def _is_local_ai_host(host: str) -> bool:
    host = host.strip().lower().rstrip(".")
    if host == "localhost":
        return True
    try:
        addresses = {
            ip_address(str(info[4][0]).split("%", 1)[0])
            for info in socket.getaddrinfo(host, None, type=socket.SOCK_STREAM)
        }
    except (OSError, ValueError):
        return False
    if not addresses:
        return False
    return all(
        (address.is_loopback or address.is_private or address.is_link_local)
        and not address.is_unspecified
        and not address.is_multicast
        for address in addresses
    )


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_env: str = "development"
    app_name: str = "UtsavOS"
    api_prefix: str = "/api/v1"

    database_url: str = "postgresql+psycopg://localhost:5432/utsavos"
    db_pool_size: int = 5
    db_pool_max_overflow: int = 5
    db_pool_timeout_seconds: int = 5
    db_statement_timeout_ms: int = 15_000
    db_lock_timeout_ms: int = 5_000

    app_secret_key: str = DEV_SECRET
    session_ttl_seconds: int = 14 * 24 * 60 * 60
    session_cookie_name: str = "utsavos_session"
    session_cookie_secure: bool | None = None
    csrf_cookie_name: str = "utsavos_csrf"
    cors_origins: str = "http://localhost:5173"

    ollama_base_url: str = "http://localhost:11434"
    ollama_model: str = "gemma4:e2b"
    ai_local_enabled: bool = True
    ai_local_allow_remote: bool = False
    ai_timeout_seconds: int = 120

    gemini_api_key: str | None = None
    gemini_model: str = "gemini-3.8-flash"
    cloud_ai_enabled: bool = False

    log_level: str = "INFO"
    demo_rate_limit_per_minute: int = 30
    auth_rate_limit_per_minute: int = 10
    login_rate_limit_per_ip: int = 30
    login_rate_limit_per_account: int = 5
    max_request_bytes: int = 64 * 1024
    trusted_proxy_ips: str = ""
    hsts_max_age_seconds: int = 31_536_000
    web_dist_dir: str | None = None

    _ollama_endpoint_local: bool | None = PrivateAttr(default=None)

    @field_validator("app_env")
    @classmethod
    def _known_env(cls, value: str) -> str:
        value = value.lower()
        if value not in {"development", "test", "production"}:
            raise ValueError("APP_ENV must be development, test, or production")
        return value

    @property
    def is_production(self) -> bool:
        return self.app_env == "production"

    @property
    def secure_cookies(self) -> bool:
        if self.session_cookie_secure is not None:
            return self.session_cookie_secure
        return self.is_production

    @property
    def cookie_name(self) -> str:
        # __Host- requires Secure, Path=/ and no Domain; only valid over HTTPS.
        return (
            f"__Host-{self.session_cookie_name}"
            if self.secure_cookies
            else self.session_cookie_name
        )

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    @property
    def trusted_proxy_set(self) -> set[str]:
        return {entry.strip() for entry in self.trusted_proxy_ips.split(",") if entry.strip()}

    def _ollama_endpoint(self) -> ParseResult:
        parsed = urlparse(self.ollama_base_url)
        if parsed.scheme not in {"http", "https"}:
            raise RuntimeError("OLLAMA_BASE_URL must use http or https")
        if not parsed.hostname:
            raise RuntimeError("OLLAMA_BASE_URL must include a host")
        if parsed.username or parsed.password:
            raise RuntimeError("OLLAMA_BASE_URL must not include credentials")
        if parsed.query or parsed.fragment:
            raise RuntimeError("OLLAMA_BASE_URL must not include a query or fragment")
        try:
            port = parsed.port
        except ValueError:
            raise RuntimeError("OLLAMA_BASE_URL has an invalid port") from None
        if port is not None and not 1 <= port <= 65535:
            raise RuntimeError("OLLAMA_BASE_URL has an invalid port")
        return parsed

    @property
    def ollama_endpoint_is_local(self) -> bool:
        if self._ollama_endpoint_local is None:
            parsed = self._ollama_endpoint()
            self._ollama_endpoint_local = _is_local_ai_host(parsed.hostname or "")
        return self._ollama_endpoint_local

    def validate_runtime(self) -> None:
        if self.ai_local_enabled and not self.ollama_endpoint_is_local:
            if not self.ai_local_allow_remote:
                raise RuntimeError(
                    "OLLAMA_BASE_URL must resolve to a loopback, private or link-local address; "
                    "set AI_LOCAL_ALLOW_REMOTE=true only for a trusted remote endpoint. "
                    "Private notes are never sent to a remote endpoint."
                )
        if not self.is_production:
            return
        if self.app_secret_key == DEV_SECRET or len(self.app_secret_key) < 32:
            raise RuntimeError("APP_SECRET_KEY must be set to at least 32 characters in production")
        if self.session_cookie_secure is False:
            raise RuntimeError(
                "SESSION_COOKIE_SECURE must be true or unset in production; "
                "plain-HTTP deployments must use APP_ENV=development"
            )
        parsed_database = urlparse(self.database_url)
        if parsed_database.scheme not in {"postgresql", "postgresql+psycopg"}:
            raise RuntimeError(
                "DATABASE_URL must use PostgreSQL with the psycopg driver; "
                "SQLite and other databases are not supported"
            )
        password = parsed_database.password
        if (
            not password
            or len(password) < 16
            or password.lower() in WEAK_DB_PASSWORDS
        ):
            raise RuntimeError(
                "DATABASE_URL must include a strong database password "
                "(16+ characters, not a default) in production"
            )
        params = parse_qs(parsed_database.query)
        if params.get("sslmode") != ["verify-full"]:
            raise RuntimeError(
                "DATABASE_URL must use sslmode=verify-full in production; "
                "unverified or plaintext connections to the database are rejected"
            )
        if not params.get("sslrootcert"):
            raise RuntimeError(
                "DATABASE_URL must set sslrootcert to the database CA certificate "
                "(or 'system') in production so verified TLS has a trust root"
            )
        if "*" in self.cors_origin_list:
            raise RuntimeError("Wildcard CORS is not allowed in production")
        for entry in self.trusted_proxy_set:
            try:
                network = ip_network(entry, strict=False)
            except ValueError:
                raise RuntimeError(
                    "TRUSTED_PROXY_IPS must contain only IP addresses or CIDR ranges"
                ) from None
            if network.prefixlen == 0:
                raise RuntimeError(
                    "TRUSTED_PROXY_IPS cannot trust every address in production"
                )
        if self.cloud_ai_enabled and not self.gemini_api_key:
            raise RuntimeError("CLOUD_AI_ENABLED requires GEMINI_API_KEY")


@lru_cache
def get_settings() -> Settings:
    return Settings()
