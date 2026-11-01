# Decisions

Short architecture decision records. Each records the choice and the reason, including the ones with known limits.

## ADR-1: Modular monolith

One FastAPI app and one PostgreSQL database. No microservices, queue or separate AI service. The workload is a single-user planning loop; distribution would add failure modes without a benefit.

## ADR-2: Integer paise everywhere

All money is `BIGINT` paise in the database, Python and the API. The frontend converts only for display. This removes floating-point drift and makes equality tests exact.

## ADR-3: One deterministic engine

`domain/planning.py` is the only source of budget, feasibility, alternatives and timeline truth. The authenticated API and the public demo both call it. AI never computes an authoritative number.

## ADR-4: Guest-count changes require a proposal

`PATCH /events/{id}` rejects a changed guest count with `422 guest_count_requires_proposal`. A guest change must be simulated, turned into a feasible proposal, and approved. This makes review impossible to bypass for the highest-impact field.

Other setup fields can still be edited directly. Extending the guard to budget/reserve is listed in the roadmap, not hidden.

## ADR-5: Approval is one locked transaction

Approval takes `SELECT ... FOR UPDATE` on the event, checks `base_version`, rebuilds the snapshot from the database, recomputes feasibility, applies only allowlisted fields, increments the version once, inserts one revision, and commits. Replaying an approved proposal returns the original revision with `idempotent_replay: true`.

The database is the authority, not the proposal's stored impact. A proposal can never apply a stale total.

## ADR-6: Infeasible changes cannot become proposals

`create_proposal` rejects an over-budget or conflict-bearing change and returns the computed alternatives. The user must choose an alternative that actually fits, rather than approving a plan the engine already knows is infeasible. This is why the flagship path uses `increase_budget` (or another alternative) rather than proposing 240 guests at the old budget.

## ADR-7: Quote totals are simulation-only

A `confirmed` quote linked to a budget item writes `BudgetItem.quote_override_minor` directly through the quote endpoint. Proposals do not carry `quote_totals`; the lever exists for what-if simulation. This keeps the manual quote workflow simple and avoids a second write path for the same field.

## ADR-8: First migration uses metadata

`0001_initial` calls `Base.metadata.create_all` so it cannot drift from the models before the first release. A `shortcut:` comment requires replacing it with explicit operations before the first destructive schema change. Migration tests create and drop a dedicated database.

## ADR-9: Single image serves SPA and API

The production image builds the Vite app and copies `dist` into the API image. `WEB_DIST_DIR` points the fallback at it. This gives one origin, one cookie jar, no CORS in production and one deployable artifact. Vite dev mode remains separate for fast iteration.

## ADR-10: AI is optional and local-first

Ollama is selected when enabled. Gemini requires cloud enabled, a server-side key and active consent. A local failure never falls back to cloud. With no provider, explain and directions return deterministic content; preferences fails honestly with `503`.

## ADR-11: Consent is versioned

Consent is stored per provider and policy version (`2026-10-v1`). A record for an older policy is inactive. Revocation is timestamped, not deleted. This makes the consent state auditable and prevents an old grant from authorising a new data flow.

## ADR-12: Public demo is a separate, read-only surface

`/api/v1/demo/*` uses a versioned synthetic fixture, the same engine, no auth, no database, no AI, a per-IP limit and a body cap. It cannot read user data or write anything. A golden test pins the flagship numbers.

## ADR-13: Tests use real PostgreSQL

The suite creates `utsavos_test` and the migration test creates `utsavos_migrate_test`. No SQLite substitution. PostgreSQL-specific behaviour (row locks, `JSONB`, check constraints, `ON DELETE CASCADE`) is part of what is being tested.

## ADR-14: In-process rate limiter

A fixed-window limiter is enough for a single-process local/self-host deployment. The file carries a `shortcut:` marker: multi-worker deployments need Redis or the database. This is a known ceiling, not a silent assumption.

## ADR-15: Landing page now, dashboard and Studio design later

The public landing page is implemented from the approved Gemini art direction, including the brand icon, favicon, real navigation and an honest illustrative planning preview. The dashboard and Studio visual language remain deferred: shipping a polished-looking shell without the corresponding interaction model would misrepresent the state of the product.

## ADR-16: No RAG

There is no document corpus, no uploads, no vendor research and no quote extraction. Retrieval would add infrastructure and a prompt-injection surface without improving the three shipped AI tasks. See [RAG.md](RAG.md).

## ADR-17: Deferred features stay deferred

PDF/OCR, uploads, vendor research, RSVP, payments and multi-user collaboration are absent. They are listed in [ROADMAP.md](ROADMAP.md) rather than represented by stubs or fake success states.

## ADR-18: Proposal approval fingerprints the planning baseline

`event.version` tracks event-row writes and approved revisions. Budget items, quotes, tasks and dependencies live in separate rows, so editing them does not bump it. Rather than redefining the public version semantics, a proposal stores a deterministic `baseline_hash` of the snapshot inputs. Approval takes the event row lock, rebuilds the snapshot and rejects a mismatch with `409 baseline_changed`. Snapshot-affecting writes take the same lock, so the check and the apply are serialized. The alternative, bumping `event.version` on every setup edit, would make revision versions jump and invalidate drafts for changes the engine does not use.

## ADR-19: Database-backed idempotency for create retries

Event and setup creates reserve a row in `idempotency_records` in the same transaction
as the mutation. The unique key is `(user, scope, method, endpoint, Idempotency-Key)`;
the request fingerprint distinguishes a safe replay from a conflicting reuse. A
committed response is returned again with `Idempotency-Replayed: true`; a different
payload gets `409 idempotency_conflict`. The transaction is the lock, so no Redis or
in-memory cache is required and a process crash cannot leave a success marker without
the mutation.

Records live for 24 hours. There is no scheduler in this release: operators delete
expired rows through the `expires_at` index. This is deliberately a bounded convenience
for lost responses, not a durable request log. Proposal approval already has its own
idempotent replay, and dependency duplicates are prevented by their composite key, so
those creates do not use the header. See
[API.md](API.md#idempotent-mutation-retries) and
[BATABASE.md](DATABASE.md#idempotency_records).
