"""P2-09: static asset caching, compression and 404 behavior for the SPA."""

from __future__ import annotations

from pathlib import Path

import pytest
from fastapi.testclient import TestClient

DIST: dict[str, str | bytes] = {
    "index.html": "<!doctype html><html><body>SPA</body></html>",
    "assets/index-abc123.js": "console.log('" + "x" * 2000 + "')",  # > gzip minimum
    "assets/index-abc123.css": "body{color:'#000'}",
    "fonts/demo.woff2": "wOF2fake",
    "img/logo.svg": "<svg/>",
}


@pytest.fixture
def client(tmp_path: Path, monkeypatch) -> TestClient:
    web_dist = tmp_path / "dist"
    for name, content in DIST.items():
        target = web_dist / name
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(content)  # type: ignore[arg-type]

    import utsavos.main as main_module
    from utsavos.config import Settings

    monkeypatch.setattr(
        main_module,
        "get_settings",
        lambda: Settings(app_env="test", web_dist_dir=str(web_dist)),
    )
    with TestClient(main_module.create_app()) as test_client:
        yield test_client


def test_index_html_is_no_cache(client) -> None:
    for path in ("/", "/login", "/events", "/demo"):
        response = client.get(path)
        assert response.status_code == 200
        assert response.headers["Cache-Control"] == "no-cache"


def test_hashed_assets_are_immutable(client) -> None:
    for path in ("/assets/index-abc123.js", "/assets/index-abc123.css"):
        response = client.get(path)
        assert response.status_code == 200
        assert response.headers["Cache-Control"] == "public, max-age=31536000, immutable"


def test_unhashed_public_assets_get_a_short_lifetime(client) -> None:
    response = client.get("/fonts/demo.woff2")
    assert response.status_code == 200
    assert response.headers["Cache-Control"] == "public, max-age=3600"
    assert response.headers["Content-Type"] == "font/woff2"


def test_static_asset_types_keep_their_mime(client) -> None:
    script = client.get("/assets/index-abc123.js")
    assert script.headers["Content-Type"] in {"text/javascript", "application/javascript"}
    assert script.text.startswith("console.log")
    image = client.get("/img/logo.svg")
    assert image.headers["Content-Type"] == "image/svg+xml"


def test_missing_static_assets_return_404_not_html(client) -> None:
    for path in (
        "/assets/index-MISSING.js",
        "/assets/index-MISSING.css",
        "/img/nope.png",
        "/fonts/nope.woff2",
    ):
        response = client.get(path)
        assert response.status_code == 404, path
        assert "SPA" not in response.text


def test_spa_routes_still_fall_back_to_index_html(client) -> None:
    response = client.get("/events/0b6a4b2e-1f2c-4a5d-8e9f-0a1b2c3d4e5f")
    assert response.status_code == 200
    assert "SPA" in response.text
    assert response.headers["Cache-Control"] == "no-cache"


def test_api_routes_are_never_intercepted(client) -> None:
    response = client.get("/api/v1/not-a-real-route")
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "not_found"
    assert response.headers["Content-Type"].startswith("application/json")
    assert response.headers["Cache-Control"] == "no-store"
    health = client.get("/healthz")
    assert health.status_code == 200


def test_supported_responses_are_gzipped(client) -> None:
    response = client.get(
        "/assets/index-abc123.js", headers={"Accept-Encoding": "gzip"}
    )
    assert response.status_code == 200
    assert response.headers.get("Content-Encoding") == "gzip"
    assert response.text.startswith("console.log")  # transparently decompressed

    small = client.get("/img/logo.svg", headers={"Accept-Encoding": "gzip"})
    assert small.headers.get("Content-Encoding") != "gzip"  # below minimum_size
