# Architecture

## Shape

A modular monolith: one FastAPI application, one PostgreSQL database, one React SPA. The same Python image can serve the API and the built SPA from a single origin. No microservices, no queue, no vector store, no agent framework.

```
apps/
  api/
    alembic/                 migrations
    src/utsavos/
      api/                   HTTP routers: auth, events, planning, demo, ai, errors
      services/              DB snapshots, proposals, approval, error types
      domain/                pure deterministic engine and money helpers
      ai/                    providers, prompt schemas, validation, orchestration
      demo/                  versioned synthetic fixture and demo service
      security/              Argon2id, session tokens, CSRF, rate limiter
      config.py              environment settings, production validation
      db.py                  engine, session factory, Base, health check
      models.py              SQLAlchemy 2.x models
      schemas.py             Pydantic v2 request/response models
      main.py                app factory, middleware, health, SPA fallback
  web/
    src/
      api/                   typed fetch client, shared types
      routes/                Login, Events, EventDetail, Demo
      lib/                   money formatting, auth hook
```

## The engine boundary

`domain/planning.py` is the only place that computes budget, feasibility, alternatives and timeline effects. It is pure: frozen dataclasses in, frozen dataclasses out, no SQLAlchemy session, no network, no clock.

`services/planning_service.py` is the only place that converts database rows into a `Snapshot` and applies an approved change back to rows. The public demo builds a `Snapshot` from `demo/fixture.json` and calls the same engine, which is why the demo cannot drift from the product.

```
HTTP router ──► service ──► build_snapshot(DB) ──► simulate(snapshot, change)
                                                        │
                                                        ▼
                                              SimulationResult (pure)
                                                        │
                        proposal ── approve ──► recompute ──► rows + revision
```

AI sits beside this path, never inside it:

```
simulate() ──► facts ──► provider ──► schema validation ──► number grounding
                             │                                   │
                             └──── failure ──► deterministic text ◄┘
```

## Request flow: guest count change

1. `POST /events/{id}/simulate` builds a snapshot and returns the projected totals, impact lines and alternatives. Nothing is written.
2. `POST /events/{id}/proposals` recomputes the change. Infeasible changes are rejected with `422 infeasible_proposal` and the computed alternatives. Feasible changes are stored as a draft with `base_version`.
3. `POST /events/{id}/proposals/{pid}/approve` locks the event row, checks `base_version == event.version`, rebuilds the snapshot from the database, recomputes, applies only allowlisted fields, increments the version once, inserts the revision, and commits.
4. A replay of an approved proposal returns the original revision with `idempotent_replay: true`.
5. A stale base version returns `409 version_conflict`; a rejected proposal returns `409 proposal_rejected`.

## Trust boundaries

- Browser → API: session cookie, CSRF header on writes, Pydantic validation, request size cap.
- API → database: owner-scoped queries, foreign keys with cascade, row locking during approval.
- API → AI provider: opt-in only; fact sheet contains counts, totals and dates, never guest or vendor contact details or notes.
- Public demo: separate router, no session, no database, no AI, rate limited.

## Error contract

Every handled error uses:

```json
{"error": {"code": "version_conflict", "message": "...", "details": {}, "request_id": "..."}}
```

`X-Request-ID` is also returned. Non-revealing 404s are used for resources owned by another user.

## Configuration

`config.Settings` validates the environment at startup. Production rejects the development secret, SQLite, wildcard CORS, and cloud AI without a key. Cookie naming and `Secure` follow `APP_ENV` unless explicitly overridden.

## Deployment topology

| Mode | Frontend | API | Database | AI |
| --- | --- | --- | --- | --- |
| Local dev | Vite :5173 | uvicorn :8000 | Docker Postgres :5432 | host Ollama |
| Local self-host | built SPA served by API :8000 | same process | Docker Postgres | off by default |
| Public hosted | built SPA behind HTTPS | same image | managed Postgres | off |

See [DEPLOYMENT.md](DEPLOYMENT.md).

## What was deliberately not built

Microservices, message queues, background workers, vector databases, retrieval pipelines, agent frameworks, websockets and multi-user presence. The MVP has no workload that justifies them.
