# Production deployment runbook

## Architecture (target)

One **Render Web Service** (~usavos) built from the repo-root `Dockerfile` serves
both the FastAPI backend and the built SPA on the **same origin**, backed by
**Render Managed PostgreSQL**. Same-origin is deliberate: the app's session
cookies are `__Host-`-prefixed + `SameSite=Lax` and CSRF is a same-origin
double-submit, so no CORS or cross-origin cookie changes are needed (and the
frontend at `utsavos-nu.vercel.app` proxies `/api/v1/*` to the Render service,
keeping every browser request first-party).

| Resource | Service | Cost |
| --- | --- | --- |
| API + SPA | Render Web Service (`runtime: docker`, `plan: free`, singapore) | $0 (sleeps after 15 min idle; ~30–60 s cold start) |
| Database | Render Postgres `utsavos-pg` (`plan: free`, singapore, v16) | $0 — **expires 30 days after creation** (14-day grace) |
| Frontend | Vercel (existing) proxies `/api/v1`, `/healthz`, `/readyz` to Render | $0 |

Always-on upgrade path: web `0.5c-512mb` ($7/mo) + Postgres `0.1c-256mb`
(~$7/mo); ~$13–14/mo total.

## Verified-TLS database requirement

Production startup (`config.validate_runtime`) **rejects** a `DATABASE_URL`
without `sslmode=verify-full` and `sslrootcert`. The Render database *internal*
URL only supports self-signed TLS, so the app uses the **external** URL:

1. Take the database's **External Database URL** from the Render dashboard.
2. Replace scheme `postgresql://` with `postgresql+psycopg://`.
3. Replace `?sslmode=require` with `?sslmode=verify-full&sslrootcert=system`
   if the Render certificate chains to a public CA (verify first — see below)
   or `?sslmode=verify-full&sslrootcert=/app/deploy/render-db-ca.pem` once the
   CA bundle file is committed (public certificate, safe to commit).

Verification command (run before choosing, from any machine with `psql` or
Python `psycopg`):

```
openssl s_client -connect <host>:5432 -starttls postgres -brief
```

If the chain verifies against the system store, `sslrootcert=system` works.
`/readyz` fails closed ("database TLS not verified") unless TLS is live and
verified, in production.

## Notes and known limitations

- **Migrations**: `alembic upgrade head` runs as part of the container command
  (idempotent, single instance). A Release/pre-deploy step can replace it once
  on a paid plan.
- **Rate limiting per IP**: Render does not publish inbound proxy ranges, so
  `TRUSTED_PROXY_IPS` stays empty; the per-IP limiters key the proxy address
  (shared bucket). Per-account login limits remain exact. Single worker keeps
  the in-process limiters meaningful; scale out only with a shared store first.
- **AI**: `AI_LOCAL_ENABLED=false`, `CLOUD_AI_ENABLED=false` — the API reports
  AI endpoints as unavailable and returns deterministic fallbacks. Gemini is
  enabled by setting `CLOUD_AI_ENABLED=true` + `GEMINI_API_KEY` (secrets never
  reach the frontend; consent rules unchanged). Private Ollama stays local-only
  by design and is not available in the Render deployment.
- **Database access restriction**: Blueprints default to `0.0.0.0/0` external
  access. After the first deploy, restrict the database allow list to the web
  service's outbound IPs (`RENDER_OUTBOUND_IPS`) in the dashboard.
- **Free tier**: the web service sleeps after 15 idle minutes (first request
  after sleep waits ~30–60 s) and Render may restart it at any time; the free
  database expires 30 days after creation. Never put data in free-tier
  databases that you cannot afford to lose; set up the paid upgrade or a
  `pg_dump` export before the expiry date.
