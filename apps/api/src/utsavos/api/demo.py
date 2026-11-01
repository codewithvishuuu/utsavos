"""Public, read-only demo. No authentication, no database, no AI, no writes."""

from __future__ import annotations

from fastapi import APIRouter, Request

from ..config import get_settings
from ..demo import service
from ..schemas import DemoIn
from ..security.rate_limit import RateLimiter
from .deps import client_ip
from .errors import api_error

router = APIRouter(prefix="/demo", tags=["demo"])

_limiter = RateLimiter(limit=get_settings().demo_rate_limit_per_minute)


def _limit(request: Request) -> None:
    key = client_ip(request)
    if not _limiter.allow(key):
        raise api_error(429, "rate_limited", "Demo rate limit reached. Try again shortly.")


@router.get("/fixture")
def fixture(request: Request) -> dict:
    _limit(request)
    return service.fixture_metadata()


@router.post("/simulate")
def simulate(payload: DemoIn, request: Request) -> dict:
    del payload  # only the allowlisted fixture scenario is accepted
    _limit(request)
    return service.run_scenario()
