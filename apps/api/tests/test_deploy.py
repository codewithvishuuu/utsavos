"""Unit tests for the Render container-start URL derivation."""

import pytest

from utsavos.deploy import _external_hosts, external_database_url


def test_appends_external_region_host_and_tls_params() -> None:
    internal = "postgresql://utsavos:s-trong-pass-2024@utsavos-pg-abc123-a:5432/utsavos"
    url = external_database_url(internal, "singapore")
    assert url == (
        "postgresql+psycopg://utsavos:s-trong-pass-2024"
        "@utsavos-pg-abc123-a.singapore-postgres.render.com:5432/utsavos"
        "?sslmode=verify-full&sslrootcert=system"
    )


def test_replaces_internal_tls_params_and_handles_portless_host() -> None:
    internal = "postgresql://utsavos:s-trong-pass-2024@utsavos-pg-abc123-a/utsavos?sslmode=require"
    url = external_database_url(internal, "oregon")
    assert url == (
        "postgresql+psycopg://utsavos:s-trong-pass-2024"
        "@utsavos-pg-abc123-a.oregon-postgres.render.com/utsavos"
        "?sslmode=verify-full&sslrootcert=system"
    )


def test_qualified_hostname_is_left_alone() -> None:
    internal = "postgresql://utsavos:s-trong-pass-2024@dpg-x-a.singapore-postgres.render.com/utsavos"
    url = external_database_url(internal, "singapore")
    assert "dpg-x-a.singapore-postgres.render.com" in url
    assert url.endswith("?sslmode=verify-full&sslrootcert=system")


def test_non_postgres_url_is_rejected() -> None:
    with pytest.raises(ValueError, match="PostgreSQL"):
        external_database_url("sqlite:///db.sqlite3", "singapore")


def test_external_hosts_covers_both_internal_conventions() -> None:
    assert _external_hosts("dpg-x-a", "oregon") == [
        "dpg-x-a.oregon-postgres.render.com",
        "dpg-x.oregon-postgres.render.com",
    ]
    assert _external_hosts("dpg-x", "oregon") == [
        "dpg-x-a.oregon-postgres.render.com",
        "dpg-x.oregon-postgres.render.com",
    ]
    assert _external_hosts("dpg-x-a.oregon-postgres.render.com", "oregon") == [
        "dpg-x-a.oregon-postgres.render.com"
    ]
