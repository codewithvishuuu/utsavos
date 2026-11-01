# UtsavOS developer tasks. Activate apps/api/.venv and install pnpm first.
PY ?= python
COMPOSE ?= docker compose

.PHONY: help db-up db-down migrate api web test test-api test-web lint build selfhost smoke

help:
	@echo "db-up    start PostgreSQL only (local development)"
	@echo "migrate  apply Alembic migrations"
	@echo "api      run FastAPI with reload on :8000"
	@echo "web      run Vite on :5173"
	@echo "test     backend + frontend tests"
	@echo "lint     ruff + mypy"
	@echo "build    production frontend build"
	@echo "selfhost build and run the single-origin stack on :8000"
	@echo "smoke    live HTTP smoke test against :8000"

db-up:
	$(COMPOSE) up -d db

db-down:
	$(COMPOSE) down

migrate:
	cd apps/api && $(PY) -m alembic upgrade head

api:
	cd apps/api && $(PY) -m uvicorn utsavos.main:app --reload --app-dir src --port 8000

web:
	cd apps/web && pnpm dev

test: test-api test-web

test-api:
	cd apps/api && $(PY) -m pytest -q

test-web:
	cd apps/web && pnpm test

lint:
	cd apps/api && $(PY) -m ruff check . && $(PY) -m mypy

build:
	cd apps/web && pnpm build

selfhost:
	$(COMPOSE) up -d --build

smoke:
	$(PY) scripts/live_smoke.py
