# UtsavOS

Adaptive event planning for real constraints: change one thing, see the exact impact, compare feasible alternatives, and approve a revision before anything is written.

Deterministic engine owns money, dates, feasibility and state. AI only explains and suggests; it never computes authoritative totals or mutates data.

## Stack

- React 19 + Vite + TypeScript (strict) + Tailwind
- FastAPI + Pydantic v2 + SQLAlchemy 2.x + Alembic + PostgreSQL 16
- Optional local AI through Ollama (`gemma4:e2b`), optional Gemini with explicit consent

## Quickstart

```powershell
Copy-Item .env.example .env
# edit .env: set POSTGRES_PASSWORD and APP_SECRET_KEY
docker compose up -d db
cd apps/api
python -m venv .venv
.\.venv\Scripts\pip install -e ".[dev]"
Copy-Item ../../.env.example .env
# edit apps/api/.env with the same PostgreSQL password
.\.venv\Scripts\python -m alembic upgrade head
.\.venv\Scripts\python -m uvicorn utsavos.main:app --reload --app-dir src

cd ../web
pnpm install
pnpm dev
```

Open http://localhost:5173. The landing page is at `/`; sign-in is at `/login`. The public demo is at `/demo`; it needs no account and no AI.

Single-origin local run:

```powershell
Copy-Item .env.example .env
# edit .env: set APP_SECRET_KEY and POSTGRES_PASSWORD (both required)
docker compose up -d --build
docker compose run --rm api alembic upgrade head
```

Compose defaults to `APP_ENV=development` because it serves plain HTTP on localhost.
Generate secrets with `python -c "import secrets; print(secrets.token_urlsafe(48))"`.
For a public HTTPS deployment set `APP_ENV=production` and terminate TLS at a proxy;
production rejects insecure cookies and weak database passwords. See
[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) and the
[deployment smoke-test checklist](docs/DEPLOYMENT_SMOKE_TEST.md).

Open http://localhost:8000.

## Tests

```powershell
cd apps/api; .\.venv\Scripts\python -m pytest -q
cd apps/web; pnpm test; pnpm build
python scripts/live_smoke.py
```

## Documentation

Start at [docs/index.md](docs/index.md). Current status, verified behaviour, and every deferred item are recorded there.
