# Testing and verification

## Principle

Tests run against a real FastAPI app and real PostgreSQL. SQLite is not used as a substitute. Anything that was not executed is marked unverified or blocked rather than described as passing.

## Backend

```powershell
cd apps/api
.\.venv\Scripts\python -m pytest -q
```

Requirements: PostgreSQL on `127.0.0.1:5432` with user `utsavos`, password `utsavos_dev`. Use the literal IPv4 address: Docker Desktop on Windows can leave `localhost` hanging on IPv6 before falling back. The suite creates `utsavos_test` and drops/recreates its tables once per session. The migration test creates `utsavos_migrate_test`.

Environment is forced in `tests/conftest.py`: `APP_ENV=test`, test database URL, test secret, both AI providers off.

### Result (2026-10-26)

```
131 passed, 1 warning
```

Ruff and mypy:

```powershell
.\.venv\Scripts\python -m ruff check .
.\.venv\Scripts\python -m mypy
```

Result: `All checks passed!`; `Success: no issues found in 35 source files`.

### What is covered

| Area | Examples |
| --- | --- |
| Money | integer paise, formatting, ceiling division, parsing edge cases |
| Engine | totals, per-guest and fixed bases, quote override, reserve, shortfall, zero/exact/over-total boundaries |
| Alternatives | release reserve, trim rates with paise correction, reduce guests, increase budget |
| Timeline | task offsets, UI-supplied `offset_days`, locked/done tasks, ceremony shifts, dependency conflicts |
| Cycles | direct and indirect cycle rejection |
| Auth | signup, login, rotation, logout, expiry, deletion, timing-equalisation path |
| AI connection lifecycle | explain/preferences/directions release the pooled connection before the provider call; a provider delay holds no connection and does not block the event loop; deterministic fallbacks and privacy gates intact |
| Static serving | `index.html` is `no-cache`; hashed assets are immutable; unhashed assets one hour with correct MIME; missing assets 404 without SPA HTML; gzip on ≥ 1 KiB; API routes keep `no-store` and JSON 404s |
| Idempotency persistence | pending key/fingerprint mirrored to `sessionStorage` per session+event+action; reused after simulated reload; new key on changed payload; cleared on success and `idempotency_conflict`; 24-hour expiry; safe on malformed/unavailable storage; only hashes and UUIDs stored |
| Security | CSRF failure, owner-scoped 404, session revocation, rate limits, login per-IP and per-account throttling (rotation and email-variant bypasses), production cookie/HSTS/TLS gates, trusted-proxy parsing |
| Events | CRUD, guest-count and event-date guards, reserve validation, setup resources, quote confirmation |
| Planning | no-write simulation, task and ceremony date projection, proposal creation, approval, rejection, stale version, baseline change, replay, `quote_totals` rejected at proposal creation |
| Concurrency | two simultaneous approvals → one mutation, one idempotent replay, version +1; budget-item edit vs approval → serialized, no torn revision |
| Idempotency | same-key replay returns the original body; different payload returns `409 idempotency_conflict`; malformed keys return 422; concurrent first requests serialize on the unique scope; failed mutations leave no replayable success; records are user/event scoped with a 24-hour expiry |
| Headers | CSP present and strict; Swagger dev-only exemption; oversized request keeps security headers; production `500` keeps CSP, HSTS, `no-store` and a matching request id in header, body and logs |
| Request context | 200/4xx/500 completion logs; sanitized inbound `X-Request-ID`; generated replacement for invalid values; no guest contacts, session tokens, secrets or query strings in request logs |
| Demo | isolation, fixture validation, golden flagship numbers, rate limit, body size |
| AI | consent, provider selection, no silent cloud fallback, schema rejection, number grounding, public Ollama rejection/opt-in, remote endpoint never receives private notes |
| Migrations | upgrade from empty database, schema present |
| Health | liveness never touches the database; readiness verifies connectivity, the expected schema, migration head, and a TLS-verified connection in production |
| Database TLS | production rejects `DATABASE_URL` without `sslmode=verify-full` and `sslrootcert` at startup; `/readyz` fails closed when the live connection is not TLS |
| Database timeouts | pool acquisition is bounded (`DB_POOL_TIMEOUT_SECONDS`); `statement_timeout`/`lock_timeout` cancel stuck statements and lock waits on real PostgreSQL; pool exhaustion returns `503 service_unavailable` without internals |

The flagship numbers are asserted, not assumed: committed `146560000`, projected `170080000`, spendable shortfall `8080000`, remaining total budget `9920000`, four alternatives, reduced guests `219`, increased budget `188080000`.

### Not covered by pytest

- Real Ollama or Gemini inside the pytest suite (providers are faked to keep tests deterministic). The live Ollama path is covered by the separate script below.
- A scheduled idempotency-record cleanup job. Expiry metadata is covered; cleanup is an operator task.
- Load, soak and fuzz testing beyond targeted Hypothesis cases.
- Coverage percentage was not measured; no figure is claimed.

## Frontend

```powershell
cd apps/web
pnpm test
pnpm typecheck
pnpm build
```

### Result (2026-10-26)

- 11 files, 43 Vitest tests passed.
- `ResourcePanels.test.tsx` contributes 11 tests: payloads for ceremonies, guests, vendors, quotes, tasks and dependencies; UI task `offset_days`; task/ceremony date-default synchronization; preserving a form on network failure; blocking a rapid duplicate submit; reusing the same key after a lost response; using a new key for the next submission; and clearing a conflicted key.
- `Dashboard.test.tsx` contributes 9 tests, including sign-out failure keeping the authenticated workspace visible with a retry, and navigation to `/login` only after a confirmed sign-out.
- `format.test.ts` contributes 5 tests, including event-relative day differences.
- `tsc --noEmit`: passed.
- Production build: 66 modules, `index-*.js` 452.57 kB (126.80 kB gzip), CSS 47.21 kB (8.77 kB gzip).

Component tests use Vitest with jsdom, React Testing Library and `@testing-library/jest-dom`.

## Browser E2E

```powershell
cd apps/web
pnpm test:e2e
```

`pnpm test:e2e` runs the production build, then Playwright starts the API with `uvicorn` against the local PostgreSQL database and waits for `/readyz` before driving Chromium, Firefox and WebKit. Waiting on readiness warms the first database connection, avoiding the Windows `localhost` IPv6 delay described above.

The suite has 19 tests in six spec files; each test runs once per project, for 57 executions. The main workflows are:

1. **Core loop.** Signs up, creates an event with the flagship budget and reserve, adds seven budget items, a ceremony, a guest, a vendor, a quote, two tasks and a dependency, simulates 180 → 240, checks the six distinct budget figures, drafts the `increase_budget` alternative, approves it, and verifies version 2 and the post-approval totals. It then simulates an event-date move, checks the moved task and ceremony previews, drafts and approves that proposal, and verifies the persisted dates and revision history. It also checks that the guest-list entry did not change the event headcount.
2. **Keyboard focus.** Tabs through the sign-in screen and fails if any focus stop has neither an outline nor a shadow.
3. **Public axe/responsive audit.** Audits the landing page at desktop, tablet and mobile widths, login at desktop and tablet, and the demo before and after simulation at desktop and mobile; asserts no horizontal overflow.
4. **Signed-in axe/responsive audit.** Audits the empty dashboard, planning studio and impact ledger, then re-audits the event screen at 768px and 375px and asserts no horizontal overflow.
5. **Landing navigation and assets.** Checks the title, description, `lang`, skip link, favicon and brand icon, CTA destinations, mobile menu keyboard behavior, reduced-motion handling, console errors, failed requests/responses and CSP violations.
6. **Event workspace states.** Covers section navigation, off-screen error focus, paginated history, rejection dialog behavior, stale-baseline blocking, simulation invalidation, and the H7 case where a guest save succeeds but the following plan refresh fails. That test asserts the saved-but-not-refreshed message, the cleared form, exactly one POST, and a successful **Retry refresh** that loads the guest without resubmitting.
7. **Idempotency retries.** Simulates a lost response against the real backend, retries with the same key, asserts one stored guest and a replayed response, and checks that a changed payload with the same key is rejected. This is an HTTP/browser test, not a mocked component test.
8. **Dashboard and routing states.** Covers pending/multiple/empty/error dashboards, the loading skeleton, and the SPA/API 404 split.

### Result (2026-10-26)

- Playwright 1.63.0; Chromium 153.0.8010.12, Firefox 155.0, WebKit 26.6.
- `57 passed`, including axe 4.14.0 with zero serious or critical violations.
- The run used the source API and real PostgreSQL, not the Compose image. The image’s startup, headers and HTTP flows were checked separately; see [DEPLOYMENT_SMOKE_TEST.md](DEPLOYMENT_SMOKE_TEST.md).
- The event-workspace suite emulates `prefers-reduced-motion: reduce`. This makes `scroll-behavior: smooth` instant and removes a Firefox race where Playwright could click while a control was still scrolling into view. It is a supported preference, not an app-only test branch.
- After that normalization, Firefox passed the event-workspace suite 5× repeated (45/45) and the final full run passed.
- WebKit-specific test notes: the app’s CSP is checked before Axe/screenshots inject styles; screenshot assertions are viewport-only because full-page images exceed WebKit’s 32767px limit; the injected test stylesheet CSP messages are filtered. WebKit does not focus buttons on click and its Tab navigation skips links, so those tests set focus through the trigger or link explicitly.

## Live HTTP smoke

```powershell
# with the API running on :8000
python scripts/live_smoke.py
```

This is a real client, not TestClient. It signs up, creates the flagship event and seven budget items, simulates 180 → 240, verifies exact paise, distinguishes the remaining total budget from the spendable shortfall, creates a proposal from `increase_budget`, confirms the plan is unchanged before approval, approves, verifies guest count/version/revision/budget coverage, replays approval, exports, checks unauthenticated access, and exercises the public demo.

### Result (2026-10-21)

```
31 checks passed
```

## Live AI check (Ollama)

```powershell
# with the API running on :8000 and Ollama serving gemma4:e2b
python scripts/live_ai_check.py
```

It creates a disposable account and event, computes the impact, then calls `/ai/explain` twice.

### Result (2026-10-21)

| Attempt | Provider | Fallback | Grounded | Latency |
| --- | --- | --- | --- | --- |
| Cold (model load) | `ollama` | none | true | 24,969 ms |
| Warm | `ollama` | none | true | 3,375 ms |

Output:

> The plan is over budget.
>
> - Release 80800 rupees of the contingency reserve
> - Renegotiate per-guest rates down by about 9%
> - Reduce the guest list to 219
> - Increase the budget by 80800 rupees

All four numbers exist in the computed fact sheet, so grounding passed. The prose is terse, but it is explanatory only; the authoritative figures remain in the deterministic result.

During development, the first live attempt failed validation because the model returned four trade-offs and the validator capped them at three. The schema and validator were aligned to four (the number of computed alternatives), and the live call then passed. That failure is recorded rather than erased.

### Live fallback checks

Two separate API instances were started to exercise failure paths through real HTTP:

| Condition | `provider` | `fallback_reason` | Result |
| --- | --- | --- | --- |
| `AI_LOCAL_ENABLED=false`, `CLOUD_AI_ENABLED=true`, no `GEMINI_API_KEY` | `deterministic` | `providers_disabled` | 200, grounded, exact six figures |
| `AI_LOCAL_ENABLED=true`, `OLLAMA_BASE_URL=http://127.0.0.1:9`, timeout 2 s | `deterministic` | `ProviderUnavailable` | 200, grounded, exact six figures |

The fallback text reported spend `₹17,00,800`, total budget `₹18,00,000`, reserve `₹1,80,000`, spendable `₹16,20,000`, spendable shortfall `₹80,800` and remaining total budget `₹99,200`. A provider outage did not affect simulation or stored state.

### Gemini

**BLOCKED.** No `GEMINI_API_KEY` is configured. The provider code is present and the SDK call signature was checked against the installed `google-genai` version, but no real cloud request was made. Consent, selection and fallback logic are covered with fakes, and the missing-key path is verified live above.

To run the live check once a key is available:

```powershell
$env:GEMINI_API_KEY = "<your key>"       # never commit this
$env:CLOUD_AI_ENABLED = "true"
$env:AI_LOCAL_ENABLED = "false"          # local wins when both are enabled
python scripts/live_ai_check.py
```

The script prints only provider, fallback reason, grounding, latency and the explanation. It never prints the key. A real key must also be paired with an active consent record for the signed-in user before Gemini is selected.

## Docker

```powershell
docker build -t utsavos:local .
docker run -d --name utsavos-smoke -p 8010:8000 `
  -e APP_ENV=development `
  -e APP_SECRET_KEY=smoke-test-secret-key-that-is-long-enough `
  -e DATABASE_URL=postgresql+psycopg://utsavos:strong-url-safe-password-123@host.docker.internal:5432/utsavos `
  -e AI_LOCAL_ENABLED=false `
  -e CLOUD_AI_ENABLED=false `
  utsavos:local
```

Production smoke tests must use HTTPS and must not set `SESSION_COOKIE_SECURE=false`.

### Result (2026-10-26, local Compose)

- `docker compose config --quiet` passed. Compose fails interpolation when `POSTGRES_PASSWORD`, `APP_SECRET_KEY` or required database variables are missing.
- `docker compose build api` succeeded, including the frontend build and `pip install .`. Local image ID `sha256:b9af10f4aef63595cbad46ac60c0b540a4d9edb2e2c2ffd1ae1f1c1f0cf88049`; final SPA bundle `index-D603vT35.js` (451.62 kB, 126.59 kB gzip).
- A production-style project (`APP_ENV=production`, fresh volume, strong explicit secrets) reached healthy `db` and `api`; ports were bound to loopback only. `alembic upgrade head` created `0001_initial` then `0002_idempotency`; a second run was a no-op.
- `/healthz` returned 200; `/readyz` returned 200. Stopping `db` produced 503 `{"status":"not_ready","database":false,"reason":"OperationalError"}`; restarting it recovered to 200 without restarting the API. `docker compose restart api` returned to healthy.
- Production rejected a short secret, SQLite, a weak/default database password, `SESSION_COOKIE_SECURE=false`, and `TRUSTED_PROXY_IPS=0.0.0.0/0`. It reported `APP_ENV=production` and `__Host-utsavos_session`.
- Production responses had HSTS, CSP and the other security headers. Signup set `__Host-utsavos_session` with `Secure`, `HttpOnly`, `SameSite=Lax`, `Path=/` and no `Domain`; `utsavos_csrf` was readable. `/api/docs` and `/api/openapi.json` returned 404. `/api/` responses had `no-store` and `no-cache`.
- On a development-profile run over loopback HTTP (Secure cookies cannot be used by a browser over plain HTTP): signup/login worked, logout returned 204 and cleared the session, a reused old session returned 401 after login rotation, a write without CSRF returned `403 csrf_failed`, and spoofed `X-Forwarded-For` was ignored by the rate limiter (ten 401s, then 429).
- Live idempotent event creation replayed with `Idempotency-Replayed: true`; the same key with a changed payload returned `409 idempotency_conflict`. CORS allowed `http://localhost:5173` and the `Idempotency-Key` header in development, and rejected an unknown origin.
- The API process count was one. `11434` was not published and no Ollama service exists in Compose; `/api/v1/ai/status` reported local and cloud AI off.
- The 57-test browser run above used the source server, not this image. The image was smoke-tested separately; both used the same source revision.
- Local backup/restore is recorded in [runbooks/BACKUP_RESTORE.md](runbooks/BACKUP_RESTORE.md): a 125,778-byte custom dump with matching SHA-256 restored into an isolated PostgreSQL 16 container with matching 15-table row counts and `0002_idempotency`; a scratch API reported `/readyz` 200.

### Previously verified (2026-10-21, historical)

- The image built and served the SPA, API, PostgreSQL and demo; `scripts/live_smoke.py` passed all 31 checks against the container.
- Public staging, TLS, HSTS at a real host, DNS and managed-database behavior were **not** verified then and remain unverified.

## Blocked or unverified

| Item | Status | Why |
| --- | --- | --- |
| Live Gemini | **BLOCKED** | no API key |
| Public deployment / staging host | **not performed** | no host, domain or credentials |
| Live TLS, HSTS and reverse proxy | **not verified** | only code-level production tests and local HTTP Compose were run |
| Live Ollama privacy/network boundary | **not re-run on 2026-10-26** | prior local Ollama result is historical; Compose runs AI off and no staging Ollama boundary was available |
| Live TLS / secure-cookie browser flow | not verified | production headers/cookies were inspected locally over HTTP; no HTTPS host or browser session |
| Live reverse-proxy hop and real-client rate limit | not verified | direct spoofed `X-Forwarded-For` was ignored; no proxy deployment exists |
| Live session expiry and browser Back cache | not verified | expiry, revocation and `no-store` are code/test checked; no staged browser run |
| Request-id log correlation | **verified (Batch A, 2026-10-28)** | completion logs print `request_id`; suppressed/filtered tested in `tests/security/test_request_context.py` |
| Staging backup/restore | not verified | an isolated local restore passed; no staging data or backup host |
| Browser E2E in CI | not wired | runs locally; CI has no Playwright/API/database job |
| Manual screen-reader audit | not performed | no screen reader available; axe covers automated rules only |
| Multi-worker rate limiting | not implemented | login and signup limits are per process (documented); a shared store is required before scaling |
| PostgreSQL verified TLS end-to-end | **config verified** | production rejects non-TLS `DATABASE_URL` at startup and `/readyz` checks `pg_stat_ssl`; not exercised against a real TLS-enabled PostgreSQL host |
| Coverage percentage | not measured | no coverage run |
| CI execution on GitHub | **not run** | repository has no commit, no remote, and `gh auth status` is logged out |

## CI

`.github/workflows/ci.yml` defines two jobs: backend (ruff, mypy, Alembic, pytest against a PostgreSQL service) and frontend (pnpm install, vitest, build). It has not been executed on GitHub from this machine. The Playwright E2E is local only and is not part of this workflow.

Remote CI could not be inspected: `git status` shows an unborn `main` branch with zero commits, `git remote -v` is empty, and `gh auth status` reports no logged-in GitHub host. The workflow commands were run locally instead and passed (159 backend tests, ruff, mypy, 55 frontend tests, typecheck and production build, plus the full local Playwright suite: 57 passed across Chromium, Firefox and WebKit).
