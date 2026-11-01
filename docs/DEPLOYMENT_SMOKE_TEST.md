# Deployment smoke-test checklist

Run this against a staging deployment before calling a release live. Record the
date, image digest, operator and command output for every item. Do not mark a
box from memory or from a different image.

Use a staging host and a test account. Never run the destructive checks against
production data.

## Local evidence collected (2026-10-26) — not staging

No staging host, domain, certificate or managed database was available. The evidence
below is local only. It does **not** tick any staging box, and it is not a substitute
for running this checklist against the release image at the real hostname.

- `docker compose config --quiet` passed; missing required secrets fail interpolation.
- The API image built from source. Local image ID
  `sha256:b9af10f4aef63595cbad46ac60c0b540a4d9edb2e2c2ffd1ae1f1c1f0cf88049`;
  SPA bundle `index-D603vT35.js` (451.62 kB, 126.59 kB gzip).
- A production-style Compose project (`APP_ENV=production`, fresh volume, strong
  explicit secrets) reached healthy `db` and `api`; both ports were loopback-only.
  `alembic upgrade head` applied `0001_initial` and `0002_idempotency`; a second run
  was a no-op.
- `/healthz` and `/readyz` returned 200. Stopping `db` produced 503
  `{"status":"not_ready","database":false,"reason":"OperationalError"}`; restarting
  `db` recovered to 200 without restarting the API. `docker compose restart api`
  returned to healthy.
- Production runtime validation (the check startup runs) refused a short secret, SQLite,
  a weak/default database password, `SESSION_COOKIE_SECURE=false`, and
  `TRUSTED_PROXY_IPS=0.0.0.0/0`. A valid production config reported
  `APP_ENV=production` and `__Host-utsavos_session`.
- Production responses carried HSTS, CSP and the other security headers.
  `/api/docs` and `/api/openapi.json` returned 404. Signup set
  `__Host-utsavos_session` with `Secure`, `HttpOnly`, `SameSite=Lax`, `Path=/` and no
  `Domain`; `utsavos_csrf` was readable. Every tested `/api/` response had
  `Cache-Control: no-store` and `Pragma: no-cache`.
- On a development-profile loopback HTTP run (a Secure cookie cannot be exercised by
  a normal browser over plain HTTP): signup/login worked, logout returned 204 and
  cleared cookies, an old session returned 401 after login rotation, a write without
  CSRF returned `403 csrf_failed`, and spoofed `X-Forwarded-For` was ignored by the
  rate limiter (ten 401s, then 429).
- Live event creation with the same `Idempotency-Key` replayed the original response
  with `Idempotency-Replayed: true`; the same key with a changed body returned
  `409 idempotency_conflict`. Development CORS allowed the configured origin and
  `Idempotency-Key`, and rejected an unknown origin.
- The API ran as one process. Port `11434` was not published and no Ollama service was
  present; authenticated `/api/v1/ai/status` reported local and cloud AI off.
- API logs were scanned for the generated database password, app secret and test email;
  none appeared. Guest contact details were not exercised in this local run.
- An isolated backup/restore passed: 125,778-byte custom dump, matching SHA-256,
  restored into a throwaway PostgreSQL 16 container with matching 15-table row counts
  and `0002_idempotency`; a scratch API returned `/readyz` 200. See
  [runbooks/BACKUP_RESTORE.md](runbooks/BACKUP_RESTORE.md).
- The 57-test Playwright run (19 tests in each of Chromium, Firefox and WebKit)
  passed against the source API and real PostgreSQL. It did not run against the
  Compose image; the image was smoke-tested separately.

Still unverified or blocked: real TLS and certificate validation; HTTP→HTTPS redirect
at a public hostname; HSTS received over a real HTTPS connection; browser Secure-cookie
behavior; the actual reverse-proxy hop and real-client rate limiting; session expiry
and browser Back cache in a staged browser; CDN/proxy caching; a staging database
backup/restore; and the live Ollama privacy/network boundary. The live Gemini call is
blocked by the missing API key. Do not report this section as a staging pass.

## 0. Release inputs

- [ ] Image digest and frontend build hash recorded.
- [ ] `.env` (or secret-manager equivalent) sets `APP_ENV=production`.
- [ ] `APP_SECRET_KEY` is 32+ random characters and is not the development placeholder.
- [ ] `POSTGRES_PASSWORD` / `DATABASE_URL` uses a 16+ character, non-default password.
- [ ] `SESSION_COOKIE_SECURE` is `true` or unset.
- [ ] `TRUSTED_PROXY_IPS` contains only the reverse-proxy addresses/CIDRs.
- [ ] `AI_LOCAL_ENABLED=false`, `CLOUD_AI_ENABLED=false` for the public demo.
- [ ] `CORS_ORIGINS` is empty or the exact public origin; no wildcard.
- [ ] Migrations are planned as a release step (`alembic upgrade head`), not on API startup.

## 1. Docker Compose startup

- [ ] `docker compose config --quiet` succeeds with the release environment.
- [ ] `docker compose up -d --build` completes; `docker compose ps` shows `db` healthy and `api` running/healthy.
- [ ] `docker compose logs api` contains no traceback, missing-variable error or secret value.
- [ ] `docker compose run --rm api alembic upgrade head` succeeds once and is idempotent on a second run.
- [ ] `docker compose restart api` returns to healthy without manual intervention.
- [ ] A stopped `db` makes `/readyz` fail; restarting it recovers without restarting the API.

## 2. Production environment validation

- [ ] `APP_ENV=production` is actually present inside the container:
  `docker compose exec api python -c "from utsavos.config import get_settings; print(get_settings().app_env)"`.
- [ ] The API refuses to start with `APP_SECRET_KEY=short` in production.
- [ ] The API refuses to start with the development secret or a 15-character database password.
- [ ] The API refuses `SESSION_COOKIE_SECURE=false` in production.
- [ ] Swagger and OpenAPI routes (`/api/docs`, `/api/openapi.json`) return 404 in production.
- [ ] `/healthz` returns 200; `/readyz` returns 200 with `"database": true`.

## 3. HTTPS and HSTS

- [ ] Plain HTTP at the public hostname redirects to HTTPS with a permanent redirect.
- [ ] The TLS certificate chain is valid for the public hostname and does not expire during the release window.
- [ ] `curl -sSI https://<host>/healthz` includes
  `Strict-Transport-Security: max-age=31536000; includeSubDomains`.
- [ ] The reverse proxy also sends HSTS (the app sends it in production; the proxy is the outer boundary).
- [ ] No mixed-content or certificate warning appears in the browser console on `/`, `/login`, `/demo` and an event page.
- [ ] The API is not reachable over plain HTTP from the public network.

## 4. Secure session cookies and logout

- [ ] Signup/login sets `__Host-utsavos_session` with `Secure`, `HttpOnly`, `SameSite=Lax`, `Path=/`, and no `Domain`.
- [ ] The CSRF cookie `utsavos_csrf` is readable by the app; the session cookie is not readable by JavaScript.
- [ ] Reloading an authenticated event page keeps the session.
- [ ] Logout clears `__Host-utsavos_session` (expired/empty value) and `GET /api/v1/auth/me` then returns 401.
- [ ] Browser back after logout cannot render private event data from cache.
- [ ] Session expiry is enforced; an expired session returns 401 and redirects to login.
- [ ] CSRF is required for authenticated writes: a logout/POST without `X-CSRF-Token` returns 403.

## 5. Database connectivity

- [ ] `/readyz` reports ready and the database name/user match the intended environment.
- [ ] Running the API against a database one migration behind head makes `/readyz` return 503 `migrations out of date` until `alembic upgrade head` runs; `alembic_version` missing returns `schema not migrated`.
- [ ] In production, `DATABASE_URL` without `sslmode=verify-full` + `sslrootcert` refuses to start, and `/readyz` on a non-TLS connection reports `database TLS not verified`.
- [ ] The PostgreSQL port is not publicly reachable; Compose binds it to `127.0.0.1` only.
- [ ] A migration smoke test passes on a copy of the staging schema.
- [ ] Create, read, update and delete a test event through the UI/API.
- [ ] Approval creates a revision and increments the event version exactly once.
- [ ] Database backups run; restore into an isolated database succeeds.
- [ ] Application logs do not contain database passwords, session tokens or guest contact details.

## 6. Trusted proxy configuration

- [ ] The public request path is client → TLS proxy → API; the API port is not exposed directly.
- [ ] `TRUSTED_PROXY_IPS` lists only the proxy IPs/CIDRs, never `0.0.0.0/0` or a public wildcard.
- [ ] Spoofed `X-Forwarded-For` sent directly to the API is ignored (socket peer is not trusted).
- [ ] Through the proxy, the real client address is used for auth/demo rate limits.
- [ ] Rate-limit rejection returns `429 rate_limited` and does not leak another client's identity.
- [ ] Request IDs from `X-Request-ID` are present in API responses and logs.
- [ ] Exactly one API worker/replica is running, or a shared rate-limit store has been added and tested.

## 7. API cache boundary

- [ ] Authenticated responses include `Cache-Control: no-store` and `Pragma: no-cache`
  (for example `/api/v1/auth/me`, `/api/v1/events/{id}/plan`).
- [ ] Logout followed by browser Back does not show an authenticated API response.
- [ ] Static SPA assets are cacheable; API responses are not.
- [ ] A shared proxy/CDN does not cache `/api/` responses.

## 8. Local Ollama privacy boundary

- [ ] For the public demo, `/api/v1/ai/status` reports local AI off and cloud AI off.
- [ ] The browser cannot reach Ollama: port `11434` is not exposed publicly and there is no browser→Ollama route.
- [ ] The API container reaches Ollama only through the documented host gateway when local AI is deliberately enabled.
- [ ] In a local-AI-enabled environment, a private guest note is **not** present in the outbound Ollama request.
- [ ] A cloud-only or remote-Ollama notes request fails closed with `422 notes_not_sent_to_cloud`, not a silent send.
- [ ] A public `OLLAMA_BASE_URL` is rejected at startup unless `AI_LOCAL_ALLOW_REMOTE=true`; with opt-in, `/ai/status` says the endpoint is remote and that private notes are never sent to it.
- [ ] Cloud AI remains off unless a key and per-user consent exist; no local failure falls back to cloud.
- [ ] With Ollama stopped, explain returns deterministic text and simulation totals are unchanged.

## 9. Final pass

- [ ] `/`, `/login`, `/demo`, `/events`, an event workspace and an unknown SPA route load correctly.
- [ ] An unknown `/api/...` route returns the JSON 404 envelope, not the SPA shell.
- [ ] The public demo works without an account and contains only synthetic data.
- [ ] An axe pass at 1440/768/375 widths reports no serious or critical violations.
- [ ] The release note lists what changed, what was not tested, and the rollback image.

## Rollback trigger

Roll back on leaked secrets, missing HSTS, insecure/wrong cookies, a failing readiness
check, an exposed database or Ollama port, a redirected HTTP→HTTPS loop, or any
private data appearing in public responses or AI prompts.
