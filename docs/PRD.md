# Requirements

## Functional requirements

| ID | Requirement | Status |
| --- | --- | --- |
| FR-1 | Sign up, log in, log out, read current user, delete account with password | Implemented |
| FR-2 | Create, list, read, update, delete events; every query owner-scoped | Implemented |
| FR-3 | Event fields: name, type, city, date, guests, budget, reserve, currency, status, version | Implemented |
| FR-4 | Ceremonies with date, guest count, venue | Implemented |
| FR-5 | Budget items with fixed or per-guest basis, quantity, optional flag, vendor link | Implemented |
| FR-6 | Guests with party size, dietary and accessibility notes, contact fields | Implemented |
| FR-7 | Vendors and manual quotes; confirmed quote overrides the linked budget item total | Implemented |
| FR-8 | Tasks with due date, status, lock, offset; dependencies with cycle rejection | Implemented |
| FR-9 | Simulate guest count, budget, reserve, date, item units and quote totals without writing | Implemented |
| FR-10 | Return exact money impact, feasibility, warnings, and computed alternatives | Implemented |
| FR-11 | Create a draft proposal from a change; list proposals | Implemented |
| FR-12 | Approve a proposal transactionally; reject with an optional reason | Implemented |
| FR-13 | Record an immutable revision with before/after JSON and actor | Implemented |
| FR-14 | Reject direct guest-count edits with `guest_count_requires_proposal` | Implemented |
| FR-15 | Versioned JSON export of the plan | Implemented |
| FR-16 | Read-only public demo using a versioned synthetic fixture and the same engine | Implemented |
| FR-17 | AI status, consent grant/revoke, explain, interpret preferences, propose directions | Implemented; live Gemini unverified |
| FR-18 | AI output grounded in a deterministic fact sheet; unknown numbers rejected | Implemented |

## Non-functional requirements

| Area | Requirement | Implementation |
| --- | --- | --- |
| Money | Integer minor units only | `BigInteger` paise, no floats in domain |
| Determinism | Same snapshot + same change → same result | Pure functions in `domain/planning.py` |
| Transactions | Approval is atomic and idempotent | Row lock, version check, single commit |
| Auth | Argon2id, opaque sessions, hashed tokens | `security.py`, `sessions` table |
| Transport | HttpOnly, SameSite, Secure in production, `__Host-` prefix | `config.cookie_name` |
| CSRF | Double-submit token on state-changing requests | `utsavos_csrf` cookie + `X-CSRF-Token` |
| Abuse | Per-IP rate limits on auth and demo | Fixed-window limiter |
| Validation | Pydantic v2 with bounded lengths and enums | `schemas.py` |
| Errors | Stable envelope with code, message, details, request id | `api/errors.py` |
| Privacy | Account deletion cascades sessions and event data | FK `ON DELETE CASCADE` |
| Accessibility | Labelled inputs, focus styles, status text not colour-only | Frontend shell |
| Deployability | Single image serves SPA and API; migrations separate | `Dockerfile`, Alembic |

## Core-loop acceptance criteria

1. Simulating 180 → 240 guests on the flagship snapshot returns projected spend `170080000`, remaining total budget `9920000`, and spendable shortfall `8080000`, and writes nothing.
2. The same call returns four alternatives with those IDs: `release_reserve`, `trim_per_guest`, `reduce_guests`, `increase_budget`.
3. Creating a proposal does not change `events.guest_count` or `events.version`.
4. Approving a valid proposal increments `version` exactly once, updates the guest count, and inserts one revision in the same transaction.
5. Replaying the same approval returns `idempotent_replay: true` and does not increment again.
6. Approving a stale proposal returns `409 stale_proposal`.
7. Rejecting a proposal changes no event data and records the decision.
8. Concurrent approvals of the same proposal produce one mutation and one replay.
9. `PATCH /events/{id}` with a changed `guest_count` returns `422 guest_count_requires_proposal`.
10. A different user reading the event receives `404`, not `403`.

## AI acceptance criteria

1. With both providers disabled, AI routes return a deterministic fallback with `degraded: true`; the rest of the app is unaffected.
2. Cloud AI requires `CLOUD_AI_ENABLED`, a server-side key, and an active consent record.
3. No silent fallback from local to cloud.
4. AI responses containing numbers absent from the computed fact sheet are rejected.
5. AI never mutates the event; its output is display-only.

## Out of scope

PDF/OCR extraction, uploads, vendor research, RSVP, payments, multi-user, real-time collaboration, notifications, mobile apps, retrieval, vector databases, queues and agent frameworks. See [ROADMAP.md](ROADMAP.md).
