# UtsavOS documentation

UtsavOS is an adaptive event-planning application. A deterministic engine owns every rupee, date, feasibility rule and state transition. AI explains and suggests; it never computes authoritative totals or writes data.

**Status:** implementation complete for the MVP scope in this repository. A local
three-browser E2E run passed. Public hosting, live TLS/reverse-proxy behavior, the live
Ollama boundary and live Gemini calls are not verified — see [TESTING.md](TESTING.md)
and the final report.

## Navigation

| Document | What it covers |
| --- | --- |
| [PRODUCT.md](PRODUCT.md) | Problem, persona, flagship scenario, non-goals |
| [PRD.md](PRD.md) | Functional and non-functional requirements, acceptance criteria |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Modular monolith, layers, request flows, engine boundary |
| [DESIGN.md](DESIGN.md) | Landing page, app shell, states, accessibility, deferred visual work |
| [design/dashboard/](design/dashboard/README.md) | Dashboard visual design, tokens, states and implementation handoff (design-only; not implemented) |
| [DOMAIN_MODEL.md](DOMAIN_MODEL.md) | Entities, invariants, money and date rules |
| [DATABASE.md](DATABASE.md) | Tables, constraints, indexes, migrations, concurrency |
| [API.md](API.md) | Every route, payload, error envelope, examples |
| [AUTH_SECURITY.md](AUTH_SECURITY.md) | Sessions, Argon2id, CSRF, cookies, rate limits, deletion |
| [AI_SYSTEM.md](AI_SYSTEM.md) | Providers, consent, grounding, validation, fallback |
| [RAG.md](RAG.md) | Why retrieval is not implemented |
| [TESTING.md](TESTING.md) | Commands, coverage, exact results, unverified items |
| [DEPLOYMENT.md](DEPLOYMENT.md) | Local dev, self-host, public-hosted posture |
| [DEPLOYMENT_SMOKE_TEST.md](DEPLOYMENT_SMOKE_TEST.md) | Staging checklist for Compose, production env, HTTPS/HSTS, cookies, database, proxy and Ollama boundaries |
| [DEVELOPMENT.md](DEVELOPMENT.md) | Setup, commands, repository layout, conventions |
| [ROADMAP.md](ROADMAP.md) | Done, next, deliberately deferred |
| [DECISIONS.md](DECISIONS.md) | Architecture decision records |
| [THREAT_MODEL.md](THREAT_MODEL.md) | Assets, threats, mitigations, residual risk |
| [CHANGELOG.md](CHANGELOG.md) | Release history |
| [runbooks/OPERATIONS.md](runbooks/OPERATIONS.md) | Start, stop, migrate, rotate, incident steps |
| [runbooks/BACKUP_RESTORE.md](runbooks/BACKUP_RESTORE.md) | Safe dump, isolated restore, recovery and limits |

## Verified on 2026-10-26 (local)

| Check | Result |
| --- | --- |
| Backend tests (real PostgreSQL) | 131 passed, 1 warning |
| Ruff / mypy | clean / clean (35 source files) |
| Frontend component/unit tests | 43 passed (11 files) |
| Frontend typecheck + production build | passed; 66 modules |
| Playwright browser tests | 57 passed locally across Chromium 153.0.8010.12, Firefox 155.0 and WebKit 26.6 |
| axe accessibility audit | zero serious or critical violations across the audited screens and viewports |
| H6 date synchronization | UI-created tasks carry `offset_days`; ceremonies shift with the event; simulation, approval and revision history agree |
| H7 save/refresh safety | saved-but-refresh-failed message and **Retry refresh**; one POST on retry; rapid duplicate submits blocked |
| H8 idempotency | same-key replay, changed-payload conflict, frontend key lifecycle, user/event scoping and 24-hour records |
| P2 request context | production `500` keeps CSP/HSTS/`no-store`; header, body and logs share the request id; 200/4xx/500 completion logs; invalid inbound ids replaced |
| P2 logout safety | failed logout keeps the workspace authenticated and shows a retry; navigation only after server-confirmed revocation |
| P2 AI endpoint boundary | public Ollama rejected without explicit opt-in; remote opt-in is disclosed; private notes never reach a remote endpoint |
| Production headers and config | production-style Compose: HSTS, `__Host-` Secure cookies, `no-store`; weak settings refused; code and local checks, not live TLS |
| API cache boundary | `no-store` / `no-cache` asserted by tests and observed on the local Compose API |
| Docker Compose | config/build passed; healthy `db`/`api`; migration `0002_idempotency`; production-style smoke |
| Backup / restore | isolated local restore with matching hash, 15 tables, row counts and `/readyz` |
| Browser E2E in CI | not wired; runs locally |
| Remote GitHub CI | **not run** — no commit, remote or `gh` login |
| Public deployment / staging | **not performed** |
| Live TLS, HSTS and reverse proxy | **not verified** — local HTTP and header checks only |
| Live session expiry / browser Back cache | not verified in a staged HTTPS browser |
| Live Ollama privacy boundary | not re-run on 2026-10-26; Compose AI is off |
| Live Gemini call | **BLOCKED** — no API key |

Historical local result (2026-10-21, not re-run on 2026-10-26): live Ollama explain cold 24.9 s / warm 3.4 s and grounded; 31 live HTTP smoke checks against the Docker image.
