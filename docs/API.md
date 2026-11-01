# API

Base path: `/api/v1`. JSON in, JSON out. Errors use one envelope.

Interactive docs exist only outside production: `/api/docs` and `/api/openapi.json` (development/test). Production disables both.

## Authentication and CSRF

- Session cookie: `utsavos_session` (or `__Host-utsavos_session` when Secure), HttpOnly, SameSite=Lax.
- CSRF cookie: `utsavos_csrf`, readable by JavaScript.
- Every authenticated request that is not `GET`/`HEAD`/`OPTIONS` must send `X-CSRF-Token` equal to the CSRF cookie. Missing or wrong → `403 csrf_failed`.
- Signup and login are unauthenticated and do not require CSRF. The public demo requires no auth and no CSRF.
- A resource owned by another user returns `404 not_found`.

## Error envelope

```json
{
  "error": {
    "code": "version_conflict",
    "message": "The event changed after this proposal was drafted. Simulate again.",
    "details": {"expected_version": 3, "proposal_base_version": 2},
    "request_id": "..."
  }
}
```

Validation errors use `422 validation_error` with `details.fields = [{loc, msg}]`.

Every response includes `X-Request-ID`. The API echoes an inbound value only when it is 1–128 characters, starts with a letter or digit, and otherwise contains only `A-Z a-z 0-9 . _ : -`; otherwise it generates a new id. The value is correlation only, never authentication.

## Response caching

Every `/api/` response is sent with `Cache-Control: no-store` and `Pragma: no-cache`.
API responses can contain event, account and AI data, so browsers and shared proxies
must not reuse them. Static SPA assets keep their normal asset caching.

## Idempotent mutation retries

`POST /events` and the setup creates for ceremonies, budget items, guests, tasks,
vendors and quotes accept an optional `Idempotency-Key` request header. The header is
1–255 visible ASCII characters (codes 33–126). If it is absent, the endpoint keeps its
backward-compatible non-idempotent behaviour.

The browser sends one key per logical submission and reuses it only when retrying that
submission. It must not reuse a key after changing the payload, after success, or after
`409 idempotency_conflict`.

Scope is `(user_id, event_id or "account", method, endpoint, idempotency_key)`. A key
created by one user or for one event cannot replay another user's or event's response.
The request fingerprint covers the normalized JSON body and the relevant path parameter
(the quote endpoint includes the vendor id).

| Situation | Result |
| --- | --- |
| New key | Mutation runs; the response is stored in the same transaction. |
| Same key and same fingerprint, completed | Original status and body are replayed, with `Idempotency-Replayed: true`. |
| Same key, different fingerprint | `409 idempotency_conflict`; nothing is written. Start a new submission. |
| Same key while the first request is still in flight | `409 idempotency_in_progress`; retry shortly with the same key. |
| Malformed or empty key | `422 invalid_idempotency_key`. |

If the mutation or commit fails, the reservation and the mutation roll back together;
no replayable success is stored. Records are retained for 24 hours and are eligible for
cleanup by `expires_at`. Until a record is removed, the same key still replays. After
removal, that key can create a new mutation, so clients must not reuse a key as a
long-term identifier.

```http
POST /api/v1/events/9f5c.../guests
Idempotency-Key: 3f6e7b39-...
X-CSRF-Token: ...
Content-Type: application/json
```

The frontend keeps the key while a request fails with a network error or an unknown
result, so a retry is safe. A `409 idempotency_conflict` clears the key and tells the
user to start a new submission. Section [Setup resources](#setup-resources) lists the
supported create paths.

## Auth

| Method | Path | Body | Success |
| --- | --- | --- | --- |
| POST | `/auth/signup` | `{email, password, display_name?}` | `201` user |
| POST | `/auth/login` | `{email, password}` | `200` user |
| POST | `/auth/logout` | — | `204` |
| GET | `/auth/me` | — | `200` user |
| DELETE | `/auth/account` | `{password}` | `204` |

User object: `{id, email, display_name, created_at}`.

Signup rules: valid email, password 10–128 characters with no leading/trailing whitespace. Login rotates the session and deletes the previous row. Logout revokes the row and clears cookies. Account deletion verifies the password, deletes consent records explicitly, deletes the user (cascading sessions and events), and clears cookies.

Codes: `rate_limited` 429, `validation_error` / `weak_password` 422, `email_taken` 409, `invalid_credentials` 401, `invalid_password` 403, `not_authenticated` / `invalid_session` / `expired_session` 401. When the connection pool is saturated, requests fail bounded and fast with `503 service_unavailable`.

## Events

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/events?limit=50&offset=0` | List own events, newest first (limit 1–200); response includes `items`, `total`, `limit`, `offset` |
| POST | `/events` | Create |
| GET | `/events/{event_id}` | Detail with ceremonies, items, tasks, vendors, quotes, totals |
| PATCH | `/events/{event_id}` | Update fields with `expected_version` |
| DELETE | `/events/{event_id}` | Delete, cascade |

Create body:

```json
{
  "name": "Ananya wedding",
  "event_type": "wedding",
  "city": "Hyderabad",
  "event_date": "2027-02-14",
  "guest_count": 180,
  "budget_minor": 180000000,
  "reserve_minor": 18000000,
  "currency": "INR"
}
```

Event object: `{id, name, event_type, city, event_date, guest_count, budget_minor, reserve_minor, currency, status, version, created_at, updated_at}`.

Patch body accepts any of the event fields plus required `expected_version`. Changing `guest_count` or `event_date` is rejected:

```json
{"error": {"code": "guest_count_requires_proposal", "message": "Change the guest count through simulation and an approved proposal, so the impact is reviewed before it is persisted.", "details": {}, "request_id": "..."}}
```

An event-date change returns `event_date_requires_proposal` with the same `422` envelope. Use simulate → proposal → approve so task and ceremony dates move together.

Other conflicts: `409 version_conflict`, `422 invalid_reserve`.

### Setup resources

| Method | Path | Body / notes |
| --- | --- | --- |
| POST | `/events/{id}/ceremonies` | `{name, ceremony_date, guest_count, venue?}` |
| POST | `/events/{id}/budget-items` | `{category, label, basis, unit_amount_minor, quantity, vendor_id?, is_optional}` |
| PATCH | `/events/{id}/budget-items/{item_id}` | `{unit_amount_minor?, quantity?}` |
| GET | `/events/{id}/guests` | `{items: [...]}` |
| POST | `/events/{id}/guests` | `{full_name, party_size, dietary_tags?, accessibility_notes?, email?, phone?, notes?}` |
| GET | `/events/{id}/tasks` | `{items, dependencies}` |
| POST | `/events/{id}/tasks` | `{title, due_date, status, offset_days?, is_locked}`; offset overrides due date. The UI sends the event-relative offset so date proposals can move the task |
| PATCH | `/events/{id}/tasks/{task_id}` | `{status?, is_locked?, due_date?}`; due date recomputes offset |
| POST | `/events/{id}/task-dependencies` | `{predecessor_id, successor_id}`; `422 dependency_cycle` on a cycle |
| POST | `/events/{id}/vendors` | `{name, category, contact_name?, email?, phone?, status}` |
| POST | `/events/{id}/vendors/{vendor_id}/quotes` | `{amount_minor, budget_item_id?, inclusions?, exclusions?, status, valid_until?}` |

Quote response includes `applied_to_budget`. A `confirmed` quote linked to a budget item sets that item's `quote_override_minor` (total override). `unknown_budget_item` and `vendor_mismatch` are 422.

The six setup create endpoints above, plus `POST /events`, accept `Idempotency-Key`;
see [Idempotent mutation retries](#idempotent-mutation-retries). Proposal creation and
task-dependency creation do not use this header.

## Planning

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/events/{id}/plan` | Event, totals, ceremonies, items, tasks, dependencies, vendors, quotes, guests, last 20 proposals + `proposal_total`, last 50 revisions + `revision_total` |
| POST | `/events/{id}/simulate` | Compute impact, no writes |
| POST | `/events/{id}/proposals` | Create draft proposal (must be feasible) |
| GET | `/events/{id}/proposals?limit=50&offset=0` | Proposals newest first (limit 1–200) with `items`, `total`, `limit`, `offset` |
| POST | `/events/{id}/proposals/{pid}/approve` | Apply atomically |
| POST | `/events/{id}/proposals/{pid}/reject` | `{reason?}` |
| GET | `/events/{id}/revisions?limit=50&offset=0` | Revisions newest version first with `items`, `total`, `limit`, `offset` |
| GET | `/events/{id}/export` | Download versioned JSON |

Change object (shared by simulate, proposal and AI explain/directions):

```json
{
  "kind": "guest_count",
  "guest_count": 240,
  "budget_minor": 188080000,
  "reserve_minor": 18000000,
  "event_date": "2027-02-14",
  "item_units": {"<budget-item-uuid>": 347363},
  "quote_totals": {"<budget-item-uuid>": 12000000}
}
```

Only non-null fields apply. `kind` is a label. `quote_totals` is simulation-only and cannot be placed in a proposal: `POST /proposals` returns `422 quote_totals_simulation_only`. Confirm a quote through the quote endpoint so the override is persisted with the quote.

### Simulation response

```json
{
  "event_id": "...",
  "base_version": 1,
  "change_kind": "guest_count",
  "feasible": false,
  "baseline": {"committed_minor": 146560000, "spendable_minor": 162000000, "...": "..."},
  "projected": {"committed_minor": 170080000, "remaining_budget_minor": 9920000, "remaining_spendable_minor": -8080000, "spendable_shortfall_minor": 8080000, "over_budget": true, "...": "..."},
  "lines": [{"kind": "committed", "label": "Projected spend", "before": 146560000, "after": 170080000, "delta": 23520000, "value_type": "money"}],
  "task_changes": [],
  "ceremony_changes": [],
  "conflicts": [],
  "alternatives": [{"id": "increase_budget", "changes": {"guest_count": 240, "budget_minor": 188080000, "reserve_minor": 18000000}, "...": "..."}],
  "alternative_notes": [],
  "assumptions": ["Integer paise arithmetic; no rounding to whole rupees."],
  "vendor_impacts": []
}
```

For an `event_date` change, `task_changes` lists each movable task's before/after due date and `ceremony_changes` lists each ceremony that moves. A task moves only when `offset_days` is set, its status is not `done`, and it is not locked. Every ceremony moves by the same day delta, preserving its spacing relative to the event. Approval applies both lists in the same transaction as the event date, and the revision summary records `event_date`, `task_dates` and `ceremony_dates`.

Totals fields: `guest_count`, `budget_minor`, `reserve_minor`, `spendable_minor`, `fixed_minor`, `per_guest_minor`, `committed_minor`, `remaining_budget_minor`, `remaining_spendable_minor`, `per_guest_average_minor`, `over_budget`, `spendable_shortfall_minor`, `category_totals`, `vendor_totals`.

Budget terms are deliberately separate:

- `budget_minor` is the total event budget.
- `reserve_minor` is held back and is not spendable.
- `spendable_minor = budget_minor - reserve_minor`.
- `committed_minor` is the projected spend.
- `remaining_budget_minor = budget_minor - committed_minor` (the reserve is still included).
- `remaining_spendable_minor = spendable_minor - committed_minor` (may be negative).
- `spendable_shortfall_minor = max(0, committed_minor - spendable_minor)`.

For the flagship 180 → 240 scenario: total budget `180000000`, reserve `18000000`, spendable `162000000`, projected spend `170080000`, remaining total budget `9920000` (₹99,200), remaining spendable `-8080000`, and spendable shortfall `8080000` (₹80,800). The shortfall is against the reserve-adjusted spendable budget, not the ₹18,00,000 total.

### Proposal lifecycle

Creating an infeasible proposal returns `422 infeasible_proposal` with `spendable_shortfall_minor`, `remaining_budget_minor`, `conflicts`, and the computed `alternatives`. A proposal stores `base_version`, `scenario`, `impact`, `alternatives`, and status `draft`. The internal `impact.baseline_hash` fingerprints the snapshot inputs used to compute the draft.

Approval response:

```json
{
  "proposal": {"id": "...", "status": "approved", "revision_id": "...", "...": "..."},
  "revision": {"id": "...", "version": 2, "before_json": {"...": "..."}, "after_json": {"...": "..."}, "created_at": "..."},
  "idempotent_replay": false
}
```

Approval takes the event row lock, rebuilds the snapshot and compares `impact.baseline_hash`. If a budget item, confirmed quote, task, ceremony or dependency changed after the draft was created, approval returns `409 baseline_changed` with `proposal_base_version` and `current_version`; nothing is written. Simulate again and create a fresh proposal.

Errors: `409 version_conflict`, `409 baseline_changed`, `409 proposal_rejected`, `409 inconsistent_proposal`, `422 infeasible_proposal`, `422 quote_totals_simulation_only`.

Rejection is idempotent for an already rejected proposal; rejecting an approved proposal is `409 proposal_approved`.

### Export

`GET /events/{id}/export` returns `application/json` with `Content-Disposition: attachment; filename="utsavos-<slug>-v<version>.json"`.

Top-level keys exactly: `format` (`utsavos.plan.v1`), `exported_at`, `event`, `totals`, `items`, `tasks`, `revisions`. The server validates its own export shape and integer money before responding; failure is `422 export_invalid`.

## Public demo

| Method | Path | Body | Notes |
| --- | --- | --- | --- |
| GET | `/demo/fixture` | — | Metadata, persona, event, baseline, `read_only: true` |
| POST | `/demo/simulate` | `{"scenario": "guests_180_to_240"}` | Same engine, synthetic fixture |

No auth, no database, no AI, no writes. Rate limited per IP (`DEMO_RATE_LIMIT_PER_MINUTE`, default 30/min) → `429 rate_limited`. Request bodies over `MAX_REQUEST_BYTES` (default 64 KiB) → `413 payload_too_large`. Any other scenario is rejected by validation.

## AI

| Method | Path | Body | Notes |
| --- | --- | --- | --- |
| GET | `/ai/status` | — | Provider state, consent, disclosure |
| POST | `/ai/consent` | `{"policy_version": "2026-10-v1"}` | Records Gemini consent |
| DELETE | `/ai/consent` | — | Revokes active consent |
| POST | `/events/{id}/ai/explain` | `{change}` | Explanation; falls back to deterministic text |
| POST | `/events/{id}/ai/preferences` | `{"text": "..."}` | Interpretation; `503 ai_unavailable` if no provider |
| POST | `/events/{id}/ai/directions` | `{change}` | Orders computed alternatives; falls back to computed order |

`explain` always returns `200` with `provider` (`ollama`, `gemini`, or `deterministic`), `fallback_reason`, `explanation`, `trade_offs`, `grounded`, `latency_ms`, `facts`. AI never writes to the event.

Consent mismatch → `422 consent_policy_mismatch`. Rejected AI output → `502 ai_output_rejected` (preferences only). Preferences text is sent only to a verified local Ollama endpoint; remote Ollama and cloud → `422 notes_not_sent_to_cloud`.

## Operational

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/healthz` | Liveness, no database |
| GET | `/readyz` | Database readiness: connectivity, schema completeness and migration head (plus verified TLS in production); 503 with a fixed non-sensitive reason when unavailable |

## Frontend routes

The built SPA is served from `/`, `/login`, `/events`, `/events/:id`, `/demo` and unknown non-API paths fall back to `index.html`. API, health and readiness prefixes are never swallowed by the SPA fallback. `index.html` is `Cache-Control: no-cache`; content-hashed `/assets/*` are immutable for a year; other public files one hour; missing assets (paths with a file extension) return `404`; responses ≥ 1 KiB are gzipped when accepted.
