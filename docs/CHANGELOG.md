# Changelog

## Unreleased — P2 Batch D (2026-11-01)

### Added

- Static asset cache policy: the SPA `index.html` (and every SPA route fallback) is served `Cache-Control: no-cache`; Vite's content-hashed `/assets/*` bundles are `public, max-age=31536000, immutable`; unhashed public files get `max-age=3600`. Missing static assets (any path with a file extension) return `404` instead of masquerading as the SPA HTML with `200`. `.woff2` gets its correct MIME type; gzip is applied to responses ≥ 1 KiB when the client accepts it.
- Pending idempotency keys and payload fingerprints are mirrored to `sessionStorage`, scoped per authenticated session and per event/action, reused after reload or navigation, cleared after confirmed success or an `idempotency_conflict`, pruned after the 24-hour replay window, and defensively ignored when storage is malformed or unavailable. Only hashed fingerprints (64-bit digests) and random UUID keys are stored — never payloads, contacts, notes or tokens.

## Unreleased — P2 Batch C (2026-10-28)

### Added

- Bounded database waits: pool acquisition timeout (`DB_POOL_TIMEOUT_SECONDS`, default 5 s) plus server-side `statement_timeout` (`DB_STATEMENT_TIMEOUT_MS`, default 15 s) and `lock_timeout` (`DB_LOCK_TIMEOUT_MS`, default 5 s) on every pooled connection. A saturated pool returns `503 service_unavailable` after the pool timeout — no hang, no internals in the response.

### Changed

- AI endpoints (`explain`, `preferences`, `directions`) release their pooled database connection before awaiting the external provider, so provider latency no longer holds a connection or transaction open. Reads happen first; the session reopens lazily. Providers were already async (httpx `AsyncClient` for Ollama, `asyncio.to_thread` for Gemini), so no synchronous HTTP call blocks the event loop.

## Unreleased — P2 Batch B (2026-10-28)

### Added

- `/readyz` readiness is real: it verifies connectivity, that every application table exists, and that `alembic_version` is at the head revision derived from the alembic versions directory. Failure reasons are fixed non-sensitive strings (`schema not migrated`, `migrations out of date`). `/healthz` stays liveness-only and never touches the database.
- PostgreSQL verified TLS in production: `DATABASE_URL` must carry `?sslmode=verify-full&sslrootcert=<CA or system>` or startup and `/readyz` fail closed (`database TLS not verified` via `pg_stat_ssl`). Development and test configurations are unchanged.
- Login throttling is now two independent windows: `LOGIN_RATE_LIMIT_PER_IP` (default 30/min) stops password spraying across accounts from one address, and `LOGIN_RATE_LIMIT_PER_ACCOUNT` (default 5/min) stops brute force from rotating IPs. The account key is the normalised email and never appears in logs or responses. Still per process (single worker).

## Unreleased — P2 Batch A (2026-10-26)

### Added

- Request-ID correlation: sanitized inbound `X-Request-ID`, one generated id per request, `request_id=...` in the default log format, and method/path/status/duration completion logs that exclude query strings, headers, cookies and bodies. HTTP client libraries are held at `WARNING` to keep outbound URLs out of `INFO` logs.
- `LOG_LEVEL` now configures application log verbosity.
- `AI_LOCAL_ALLOW_REMOTE` and startup validation for `OLLAMA_BASE_URL`: loopback/private/link-local is local; a public endpoint refuses startup unless explicitly opted in.

### Changed

- Unhandled production `500` responses now run the same security-header and `no-store` path as normal API responses and log the matching request id.
- The AI status payload reports whether the Ollama endpoint is remote; the workspace label and disclosure follow it. Remote Ollama is fact-sheet only and never receives private notes.
- The production image disables uvicorn access logs; application completion logs carry the method, path, status and duration without query strings.
- Playwright now waits on `/readyz` instead of `/healthz`, so the first database connection is established before tests and the Windows `localhost` IPv6 fallback cannot consume a test's assertion timeout.
- Dashboard and event-page logout keep the authenticated workspace visible with a retryable error when revocation fails, and navigate only after a confirmed `204`.

### Fixed

- A production `500` no longer drops `X-Request-ID`, CSP, HSTS, `no-store` or `nosniff`.
- Invalid or oversized inbound request ids can no longer flow into headers, error bodies or logs; valid ones are correlation-only.
- A failed logout no longer masquerades as success or sends the user to `/login`.
- A public remote Ollama endpoint is no longer silently treated as local, and private notes are blocked from every remote endpoint.

### Verification

- Backend: 131 pytest tests passed, 1 warning; ruff clean; mypy clean across 35 source files.
- Frontend: 11 files, 43 Vitest tests passed; `tsc --noEmit` and the production build passed (66 modules; 452.57 kB JS / 126.80 kB gzip; 47.21 kB CSS / 8.77 kB gzip).
- Browser: 57 Playwright tests passed across Chromium 153.0.8010.12, Firefox 155.0 and WebKit 26.6, including axe with zero serious or critical violations. The final run used the standard `pnpm test:e2e` path against the production build; Playwright waits on `/readyz` so the first database connection is warm.
- Not verified in this batch: staging TLS/proxy behavior, live Ollama/Gemini, remote CI, load/soak and coverage percentage. No deployment was performed.

## Unreleased — H8 idempotency and cross-browser verification (2026-10-26)

### Added

- Database-backed idempotency for event creation and the ceremony, budget-item, guest, task, vendor and quote creates. A same-key retry replays the original response; a changed payload returns `409 idempotency_conflict`; records are user/event scoped and expire after 24 hours.
- Frontend key lifecycle: retain the key on network/unknown outcomes, discard it after success or conflict, and block rapid duplicate submits.
- `0002_idempotency` migration and `idempotency_records` model.
- Safe PostgreSQL backup/restore runbook with integrity, isolated-restore and recovery steps.
- Cross-browser Playwright coverage in Chromium, Firefox and WebKit.

### Changed

- The supported create endpoints accept `Idempotency-Key`; development CORS also allows that header.
- The production Compose path was exercised with `APP_ENV=production` and explicit strong secrets; local-only results are recorded separately from staging.
- Event-workspace tests emulate reduced motion to avoid a Firefox smooth-scroll click race. This is a test normalization, not an application behavior change.

### Fixed

- A lost create response can be retried without creating a duplicate; a reused key with a different body is rejected instead of applying a second mutation.
- The intermittent Firefox rejection-dialog failure was addressed by removing the test's smooth-scroll/click race; no lost application state was observed. Several WebKit failures were test-harness issues (CSP-injected styles, screenshot size, focus and skip-link behavior).
- The old binary-redirection backup guidance was replaced with container-local dumps, SHA-256 verification and a throwaway restore target.

### Verification

- Backend: 124 pytest tests passed, 1 warning; ruff clean; mypy clean across 33 source files.
- Frontend: 11 files, 40 Vitest tests passed; `tsc --noEmit` and the production build passed (66 modules; 451.62 kB JS / 126.59 kB gzip; 47.03 kB CSS / 8.75 kB gzip).
- Browser: 57 Playwright tests passed across Chromium 153.0.8010.12, Firefox 155.0 and WebKit 26.6, including axe with zero serious or critical violations. The event-workspace suite also passed 5× repeated in Firefox (45/45).
- Local production-style Compose: healthy `db`/`api`, `0002_idempotency`, production config refusals, HSTS and secure `__Host-` cookies, auth/CSRF/logout/session rotation, no-store API headers, loopback-only ports, ready/recovery, live idempotency replay/conflict, and AI-off status.
- Isolated backup/restore: matching SHA-256, 15 tables, matching row counts, migration `0002_idempotency`, and `/readyz` 200.
- Not verified: staging/TLS/real proxy behavior, browser Secure-cookie flow, live Ollama boundary, live Gemini (no key), remote CI (no commit/remote/auth), load/soak, coverage percentage.

## Unreleased — P0 H6/H7 (2026-10-26)

The verification counts in this section are the H6/H7 gate; the final combined run is recorded above.

### Added

- Simulation responses expose `ceremony_changes` for every ceremony moved by a date change.
- Revision summaries record `event_date`, `task_dates` and `ceremony_dates`, so date approvals are auditable.
- A saved-but-not-refreshed state shows the successful save, the refresh failure, and a **Retry refresh** action that never repeats the mutation.

### Changed

- Date approval now persists the same projected snapshot that simulation shows: UI-created tasks carry `offset_days`, and every ceremony shifts by the same day delta so relative spacing is preserved.
- `baseline_hash` includes ceremonies, so adding a ceremony after drafting correctly makes the proposal stale.
- `PATCH /events/{id}` rejects direct `event_date` changes with `422 event_date_requires_proposal`, matching the guest-count guard and preventing dependent rows from falling out of sync.

### Fixed

- Date simulation previously left UI-created tasks and all ceremonies in place.
- Approval previously used `apply_change` directly, so a previewed task-date projection was not persisted.
- A save followed by a failed plan refresh no longer looks like a failed save, and rapid duplicate form submits are blocked in the browser.
- Stale plan responses can no longer overwrite a newer load.

### Verification

- Backend: 110 pytest tests passed; ruff and mypy clean.
- Frontend: 36 Vitest tests passed; TypeScript and production build passed.
- Browser: 18 Playwright Chromium tests passed, including H6 date approval and H7 refresh-failure retry.
- Local Compose: config, image build, database migration, healthy `db`/`api`, SPA/API serving and API `no-store` observed.
- No schema migration was needed; all new API and revision fields are additive.
- Staging/TLS/HSTS-at-a-host and the live Ollama privacy boundary were not verified; see `DEPLOYMENT_SMOKE_TEST.md`.

## Unreleased — production hardening P1 (2026-10-25)

### Added

- Deployment smoke-test checklist covering Compose startup, production environment validation, HTTPS/HSTS, secure cookies/logout, database connectivity, trusted proxies, API caching and the Ollama privacy boundary.
- Same-origin destination preservation through sign-in and sign-up, with external and protocol-relative redirects rejected.
- In-app not-found screen for unknown SPA routes; `/api/*` unknown routes still return the JSON 404 envelope.
- Paginated event, proposal and revision lists with totals; the event workspace exposes older proposals and revisions instead of silently dropping them.
- Mobile workspace drawer now behaves as a labelled modal dialog with initial focus, Tab trapping, body scroll lock and focus restoration.

### Changed

- `GET /events`, `GET /events/{id}/proposals` and `GET /events/{id}/revisions` accept `limit`/`offset` and return `items`, `total`, `limit` and `offset`. The plan snapshot reports `proposal_total` and `revision_total`.
- Every `/api/` response now sends `Cache-Control: no-store` and `Pragma: no-cache`.

### Fixed

- API and validation errors are focused and scrolled into view when their form or action is off-screen.
- The mobile drawer no longer leaves keyboard focus behind the overlay or the page scrollable.

### Verification

- Backend: 107 pytest tests passed; ruff and mypy clean.
- Frontend: 32 Vitest tests passed; TypeScript and production build passed.
- Browser: 17 Playwright Chromium tests passed, including drawer focus, off-screen errors, history load-more and SPA/API 404 separation.
- `docker compose config --quiet` passed with placeholder secrets. No live Docker/TLS/Ollama smoke test was run.

## 0.1.0 — 2026-10-21

Initial implementation.

### Added

- FastAPI + SQLAlchemy 2.x + Alembic API on PostgreSQL 16
- React 19 + Vite + TypeScript + Tailwind functional shell
- Argon2id auth, opaque sessions with rotation, CSRF, rate limits, account deletion
- Owner-scoped events, ceremonies, budget items, guests, vendors, quotes, tasks, dependencies
- Deterministic planning engine in integer paise
- Explicit budget semantics: total budget, reserve, spendable, projected spend, remaining total budget, remaining spendable and spendable shortfall
- No-write simulation with exact impact lines and four computed alternatives
- Proposal drafting, feasibility gate, atomic approval, rejection, idempotent replay
- Immutable revisions and versioned JSON export
- Guest-count guard requiring the proposal path
- Public read-only demo with a versioned synthetic fixture and golden test
- Functional forms for ceremonies, guests, vendors, quotes, budget items, tasks and dependencies
- Optional Ollama `gemma4:e2b` and Gemini providers with consent, grounding and deterministic fallback
- Public landing page at `/` with the existing brand icon and favicon, responsive editorial layout, original SVG botanical art, a clearly labelled illustrative flagship preview, and working links to sign-in and the public demo
- Real-PostgreSQL test suite, component tests, Playwright browser E2E, live HTTP smoke script, live AI check script
- Multi-stage Docker image, compose stack, CI workflow
- Documentation set under `docs/`

### Changed

- `/` now renders the public landing page; `/login` remains the sign-in screen, and the existing `/events`, `/events/:id` and `/demo` routes keep the application shell.
- Totals now expose `remaining_budget_minor`, `remaining_spendable_minor` and `spendable_shortfall_minor`. The old `remaining_minor` and `shortfall_minor` names were removed so the reserve-adjusted shortfall cannot be mistaken for the total-budget position.
- The event screen now shows the six budget figures separately and labels the simulation result as a projected budget summary.

### Fixed during release verification

- The event screen no longer scrolls horizontally at 375px: proposal scenarios render as readable text instead of raw JSON, and five-field forms collapse below the desktop breakpoint so tablet selects are not truncated.
- A failed event load now shows its error and a link back instead of an endless "Loading" state.
- `POST /proposals` rejects `quote_totals` with `422 quote_totals_simulation_only`; previously the simulation used the override but the stored scenario dropped it, so the approved revision could differ from the proposal impact.
- Approval now fingerprints the planning snapshot. A budget-item, confirmed-quote, task or dependency edit after a proposal is drafted returns `409 baseline_changed` instead of silently applying the change to a newer baseline. Budget-item, quote, task and dependency writes take the event row lock, so they serialize with approval.
- Rejection now locks the event row like approval, serializing approve/reject races.
- Added a strict Content-Security-Policy for the SPA and API: same-origin scripts, styles, fonts and connections, no inline script/style or `eval`. Swagger UI is exempt outside production because it loads CDN and inline assets; production disables it.
- The Docker image pins one uvicorn worker and deployment docs state the scaling restriction: auth/demo rate limits are in-process until a shared store exists.
- Approval and rejection notices are announced with `role="status"`; alternative draft buttons have unique accessible names.
- `scripts/live_ai_check.py` no longer crashes on Windows consoles that cannot encode the rupee sign.

### Verified

- 91 backend tests passed; ruff and mypy clean
- 15 frontend component/unit tests passed; TypeScript build passed
- 5 Playwright browser tests passed in Chromium: the core loop, keyboard focus, public plus signed-in axe/responsive audits, and landing navigation/brand/reduced-motion checks; the strict CSP produced no `securitypolicyviolation`. The three pre-existing accessibility/responsive tests also passed against the production container; the landing page was not re-run there.
- axe 4.14.0: zero serious or critical violations across the audited screens and viewports: landing at 1440x900, 768x1024 and 375x812; login at 1440x900 and 768x1024; demo before/after simulation at 1440x900 and 375x812; dashboard, planning studio and impact ledger at 1440x900; event detail at 768x1024 and 375x812
- 31-check live HTTP smoke passed against the source server and again against the production Docker image
- Docker image rebuilt and served SPA + API against PostgreSQL; `/api/docs` disabled in production
- Live Ollama explain: cold 24.9 s, warm 3.4 s, grounded output
- Live fallback checks: missing Gemini key and an unreachable Ollama endpoint both returned the deterministic explanation with the exact six budget figures

### Known gaps

- Live Gemini unverified (no key)
- Browser E2E is not wired into CI
- No public deployment
- Dashboard and Studio visual design deferred
- Landing reference preview assets were unavailable, so the implementation follows the embedded brief rather than a pixel-level reference
- In-process rate limiter
- No MFA, password reset or email verification
- PDF/OCR, uploads, vendor research, RSVP, payments and multi-user collaboration not implemented
