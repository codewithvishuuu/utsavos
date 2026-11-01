# Deployment

Three distinct deployments. Do not blur them.

## 1. Local development

| Component | Where |
| --- | --- |
| Frontend | Vite dev server, `http://localhost:5173` |
| API | uvicorn with reload, `http://localhost:8000` |
| Database | Docker PostgreSQL 16, `localhost:5432` |
| AI | Ollama on the host, `http://localhost:11434` |

```powershell
Copy-Item .env.example .env
# edit .env: set POSTGRES_PASSWORD (and APP_SECRET_KEY)
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

Vite proxies `/api` to `:8000`; CORS is enabled for `http://localhost:5173`. AI is optional; with Ollama unavailable, explain falls back to deterministic text.

## 2. Local single-origin (development profile)

The image builds the SPA and installs the API. One process serves both on `:8000`.

```powershell
Copy-Item .env.example .env
# edit .env: set APP_SECRET_KEY and POSTGRES_PASSWORD
docker compose up -d --build
docker compose run --rm api alembic upgrade head
```

Open `http://localhost:8000`.

Compose requires `APP_SECRET_KEY` and `POSTGRES_PASSWORD`; there are no default
credentials. It runs `APP_ENV=development` because it serves plain HTTP on localhost.
Production mode rejects insecure cookies and weak database passwords, so a public
deployment must set `APP_ENV=production` and terminate TLS at a proxy.

Compose defaults:

- `APP_ENV=development` (Swagger/CORS available, no HSTS)
- PostgreSQL bound to `127.0.0.1:5432` only
- `AI_LOCAL_ENABLED=false`, `CLOUD_AI_ENABLED=false` (public-hosted posture)
- PostgreSQL in the `db` service with the `pgdata` volume

Local production-profile checks (not staging) are recorded in
[DEPLOYMENT_SMOKE_TEST.md](DEPLOYMENT_SMOKE_TEST.md). They cover a fresh production
Compose volume, migration `0002_idempotency`, config refusals, HSTS and `__Host-`
cookies, auth/CSRF/logout, idempotency replay/conflict, readiness recovery and the
AI-off boundary. Backup and restore are in
[runbooks/BACKUP_RESTORE.md](runbooks/BACKUP_RESTORE.md).

To enable local AI in the container, Ollama must be reachable from the container:

```yaml
AI_LOCAL_ENABLED: "true"
OLLAMA_BASE_URL: http://host.docker.internal:11434
```

On Linux, use the host gateway address or run Ollama in a reachable network. `localhost` inside the container is the container itself.

Migrations are a separate release step. The API does not run them at startup.

## 3. Public hosted (not performed)

No public deployment was made. This is the required posture when one is made:

| Setting | Value |
| --- | --- |
| `APP_ENV` | `production` |
| `APP_SECRET_KEY` | 32+ random characters, stored in a secret manager |
| `DATABASE_URL` | managed PostgreSQL with TLS and a 16+ character password |
| `SESSION_COOKIE_SECURE` | `true` (or unset; production defaults to true) |
| Cookie name | `__Host-utsavos_session` automatically |
| `CORS_ORIGINS` | empty or the exact origin; wildcard rejected |
| `TRUSTED_PROXY_IPS` | proxy IPs/CIDRs; required for per-IP limits behind a proxy |
| `AI_LOCAL_ENABLED` | `false` |
| `CLOUD_AI_ENABLED` | `false` for the public demo |
| `WEB_DIST_DIR` | `/app/web/dist` in the image |
| `LOG_LEVEL` | `INFO`; application log verbosity |
| TLS / HSTS | TLS terminated at the proxy; the app sends HSTS in production |
| Workers | one, or add a shared rate-limit store first |

Hard rules for this mode:

- Visitors never talk to `localhost` for anything.
- The browser never talks to Ollama. There is no browser→Ollama bridge.
- Cloud AI stays off unless the operator explicitly enables it with a key and users consent.
- `__Host-` cookies require HTTPS; do not disable Secure.
- Run `alembic upgrade head` as a release step before starting the new image.
- Health checks: `/healthz` for liveness, `/readyz` for database readiness.
- The reverse proxy must preserve the client IP. Set `TRUSTED_PROXY_IPS` to the
  addresses the API actually sees; `X-Forwarded-For` is only read when the socket peer
  matches. With Docker publishing `127.0.0.1:8000`, the container normally sees the
  Docker bridge gateway, not the host proxy's loopback address. Either run the proxy
  in the same Docker network and trust its container address, or trust the gateway
  address and ensure only the proxy can reach the API. Verify this on staging.
- The API sends HSTS in production, but the proxy must also send it. No reverse-proxy
  configuration is included in this repository.

## Scaling constraint: one API process or replica

Auth and demo rate limits are in-process fixed windows (`security/rate_limit.py`).
The supported deployment is exactly one uvicorn worker and one API replica.
Adding workers or replicas multiplies the effective limits and makes them
inconsistent.

- The image pins `--workers 1`; Compose runs one `api` service.
- The image also uses `--no-access-log`: the app's `request.completed` lines carry method, path, status and duration without query strings. Add the flag when running uvicorn manually if query strings may contain sensitive values.
- Do not use `docker compose up --scale api=N`, `uvicorn --workers N`, or
  multiple pods behind a load balancer.
- Upgrade path: move the limiter to a shared store (Redis, or PostgreSQL with a
  dedicated table and cleanup), then scale. PostgreSQL is present, but a
  per-request shared limiter is a larger change than this MVP needs.
- If a reverse proxy is added, set `TRUSTED_PROXY_IPS` to its addresses;
  `X-Forwarded-For` is parsed only from trusted peers.

## Image details

- Multi-stage: `node:24-alpine` builds the SPA; `python:3.11-slim` installs the API package.
- Runs as a non-root `app` user.
- `HEALTHCHECK` calls `/healthz`.
- `WEB_DIST_DIR=/app/web/dist` points the SPA fallback at the copied build.
- `pip install .` uses `pyproject.toml` and includes `demo/fixture.json` as package data.

## Environment variables

| Variable | Default | Notes |
| --- | --- | --- |
| `APP_ENV` | `development` | `development`, `test`, `production` |
| `APP_SECRET_KEY` | dev placeholder | production requires 32+ chars, not the placeholder |
| `DATABASE_URL` | no credentials | PostgreSQL only; production requires a 16+ char password **and `?sslmode=verify-full&sslrootcert=<CA or system>`** — startup and `/readyz` fail closed without them |
| `DB_POOL_SIZE` / `DB_POOL_MAX_OVERFLOW` | 5 / 5 | connection pool |
| `SESSION_TTL_SECONDS` | 1209600 | 14 days |
| `SESSION_COOKIE_SECURE` | follows env | production rejects `false`; use development for plain HTTP |
| `CORS_ORIGINS` | `http://localhost:5173` | ignored in production |
| `TRUSTED_PROXY_IPS` | empty | comma-separated IPs/CIDRs allowed to set `X-Forwarded-For` |
| `HSTS_MAX_AGE_SECONDS` | 31536000 | sent only in production |
| `AI_LOCAL_ENABLED` | `true` | set false on public hosts |
| `OLLAMA_BASE_URL` / `OLLAMA_MODEL` | localhost / `gemma4:e2b` | endpoint must resolve privately |
| `AI_LOCAL_ALLOW_REMOTE` | `false` | explicit opt-in for a trusted remote Ollama; fact sheets only |
| `AI_TIMEOUT_SECONDS` | 120 | Gemini capped at 60 |
| `CLOUD_AI_ENABLED` | `false` | requires key and consent |
| `GEMINI_API_KEY` / `GEMINI_MODEL` | unset / `gemini-3.8-flash` | server-side only |
| `DEMO_RATE_LIMIT_PER_MINUTE` | 30 | per IP, per process |
| `AUTH_RATE_LIMIT_PER_MINUTE` | 10 | per IP (signup) |
| `LOGIN_RATE_LIMIT_PER_IP` | 30 | per IP, per process |
| `LOGIN_RATE_LIMIT_PER_ACCOUNT` | 5 | per normalised email, per process |
| `MAX_REQUEST_BYTES` | 65536 | |
| `WEB_DIST_DIR` | computed | set in the image |

## Rollback

1. Keep the previous image tag.
2. Roll back the image first.
3. Only run `alembic downgrade` if the schema change is understood and a backup exists. The initial migration's downgrade drops all tables.

## Operational checklist before calling a deployment live

Run the staged checks in [DEPLOYMENT_SMOKE_TEST.md](DEPLOYMENT_SMOKE_TEST.md) and record
the evidence. The summary below is not a substitute for that checklist.

- [ ] `APP_SECRET_KEY` is unique and stored outside the repository
- [ ] HTTPS is enforced; the app sends HSTS in production and the proxy also sets it
- [ ] `SESSION_COOKIE_SECURE` is true; cookies are `__Host-`
- [ ] `APP_ENV=production`
- [ ] AI flags are off for the public demo
- [ ] Migrations applied and recorded
- [ ] `/healthz` and `/readyz` monitored
- [ ] Backups configured and a restore tested using
      [runbooks/BACKUP_RESTORE.md](runbooks/BACKUP_RESTORE.md)
- [ ] Logs do not contain passwords, tokens, guest contacts or prompts with personal data
- [ ] Exactly one API worker/replica, or a shared rate-limit store is in place
- [ ] `idempotency_records` cleanup is scheduled or accepted as an operator task
- [ ] Demo disclaimer and synthetic-data labels visible
