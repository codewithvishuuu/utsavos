# Operations runbook

## Start and stop

Local development database:

```powershell
docker compose up -d db
docker compose down          # keeps the pgdata volume
```

Single-origin stack (`.env` must contain a unique `APP_SECRET_KEY` of 32+ characters; Compose refuses the development placeholder):

```powershell
docker compose up -d --build
docker compose run --rm api alembic upgrade head
docker compose logs -f api
docker compose down
```

Host API:

```powershell
cd apps/api
$env:PYTHONPATH="src"
.\.venv\Scripts\python -m uvicorn utsavos.main:app --host 127.0.0.1 --port 8000
```

## Health checks

| Endpoint | Meaning |
| --- | --- |
| `GET /healthz` | Process is alive; does not touch the database |
| `GET /readyz` | Database connectivity, complete schema, migrations at head (and a TLS-verified connection in production); 503 with a fixed `reason` otherwise |

If `/healthz` is 200 but `/readyz` is 503, check PostgreSQL, `DATABASE_URL`, credentials and network access. A `migrations out of date` reason means `alembic upgrade head` has not run; `schema not migrated` means the database is missing the migration version or application tables.

## Migrations

```powershell
cd apps/api
.\.venv\Scripts\python -m alembic current
.\.venv\Scripts\python -m alembic upgrade head
```

In compose:

```powershell
docker compose run --rm api alembic upgrade head
```

Never run migrations automatically at container start in a multi-replica deployment; run them once as a release step.

## Logs

```powershell
docker compose logs -f api
docker compose logs -f db
```

Each response carries `X-Request-ID`; error bodies contain the same id. The default log format prints `request_id=...`; search logs for that id. `LOG_LEVEL` controls verbosity. Completion logs contain only method, path, status and duration — never query strings, headers, cookies or bodies. HTTP client libraries are held at `WARNING` so outbound URLs and query strings are not emitted at `INFO`. The production image disables uvicorn access logs; use `--no-access-log` when running uvicorn manually if query strings may contain sensitive values. AI logs include the task, provider and failure class, not prompt contents or personal data.

## Backup and restore

Use [BACKUP_RESTORE.md](BACKUP_RESTORE.md). It covers container-local custom-format
dumps, SHA-256 verification, an isolated throwaway restore, row-count and `/readyz`
checks, production recovery, retention and the known limits.

Do not use `docker compose exec db pg_dump ... > file` or `pg_restore --clean
--if-exists` against a live database. PowerShell binary redirection can corrupt the
archive, and `--clean` can destroy the target. No automated backup is configured in
this repository; that is a deployment responsibility.

## Idempotency retention

`idempotency_records` is written by create retries and has a 24-hour `expires_at`.
There is no in-app scheduler. During low traffic, delete rows whose expiry is safely in
the past:

```powershell
docker compose exec -T db psql -U utsavos -d utsavos `
  -c "delete from idempotency_records where expires_at < now() - interval '1 hour';"
```

The `expires_at` index supports this cleanup. Until a row is removed, a retry with the
same scoped key still replays; after removal, it can create a new mutation. Do not
delete rows for keys that may still be retried inside the retention window.

## Rotate `APP_SECRET_KEY`

1. Generate at least 32 random characters.
2. Update the secret in the deployment environment.
3. Restart the API.
4. Existing sessions remain valid because tokens are hashed independently, but existing CSRF cookies no longer match. Users must sign in again to receive a fresh CSRF token.
5. Verify login, a write request and logout.

## Ollama

```powershell
ollama list
ollama ps
```

The provider requires `gemma4:e2b` and `think=false`. A cold request can take tens of seconds; the live measurement was 45.3 s cold and 4.6 s warm. If the model returns empty content, confirm thinking is disabled. If AI is unavailable, explain and directions fall back to deterministic text; the app remains usable.

## Incident: database unavailable

1. `/readyz` returns 503 with a reason.
2. Check the container or managed database status.
3. Check `DATABASE_URL`, credentials and network.
4. Restore service; the app reconnects through the pool.
5. Do not restart the API repeatedly while the database is down; it will not fix connectivity.

## Incident: AI provider down

Expected and non-fatal. Explain/directions return `provider: deterministic` with a `fallback_reason`; preferences returns `503 ai_unavailable`. Do not disable the deterministic engine or attempt to compute totals manually. Record the provider and time.

## Incident: suspected account compromise

1. Ask the user to change the password (there is no self-service reset in this release; operator assistance is required).
2. Delete sessions for that user in the database if immediate revocation is needed.
3. Review `X-Request-ID` logs for the affected period.
4. If a secret may have leaked, rotate `APP_SECRET_KEY` and the Gemini key.

## Incident: suspected data exposure

1. Stop the affected deployment if exposure is ongoing.
2. Preserve logs and database state.
3. Identify the route and owner-scope failure.
4. Rotate secrets.
5. Notify according to the applicable policy. This repository has no built-in notification workflow.

## Rate limiting

Limits are per process and reset on restart. The image pins `--workers 1`; do not scale the API or add replicas until a shared store exists. If users report `429`, check whether a reverse proxy is collapsing client IPs.

## Account deletion support

`DELETE /auth/account` requires the password and is irreversible. There is no soft delete. Backups may retain the data until they expire; communicate that clearly if a user asks for erasure.
