# Domain model

The domain is defined in `apps/api/src/utsavos/domain/planning.py`. Everything below is enforced there, not in the UI.

## Money

- All amounts are integer **paise** (`BigInteger` in PostgreSQL). No floats anywhere in the domain.
- Formatting to rupees happens only at the edge (`format_inr`, frontend `formatPaise`).
- Percentages in alternative titles are computed with integer ceiling division and are descriptive, not authoritative.
- Bounds: `0 <= amount <= 10^14` paise in a change; database checks reject negative stored amounts.

## Snapshot

A frozen view of one event at one version:

```
Snapshot(event_id, name, guest_count, budget_minor, reserve_minor,
         event_date, currency, items, tasks, dependencies, ceremonies)
```

Items carry `basis` (`fixed` or `per_guest`), `unit_amount_minor`, `quantity`, optional `vendor_id`, optional confirmed `quote_minor`, and `is_optional`.

## Totals

For each item:

| Condition | Amount |
| --- | --- |
| Confirmed quote exists | `quote_minor` (total override) |
| `basis == "per_guest"` | `unit_amount_minor × guest_count` |
| `basis == "fixed"` | `unit_amount_minor × quantity` |

Then:

- `spendable = budget − reserve`
- `committed = Σ item amounts`
- `remaining_budget = budget − committed` (the reserve is still included)
- `remaining_spendable = spendable − committed` (may be negative)
- `over_budget = committed > spendable`
- `spendable_shortfall = max(0, committed − spendable)`
- `per_guest_average = per_guest_total // guest_count` (integer floor, zero when no guests)

For the flagship projection, `remaining_budget = 9,920,000` paise (₹99,200), `remaining_spendable = −8,080,000`, and `spendable_shortfall = 8,080,000` paise (₹80,800). The shortfall is against spendable, not the total budget.

Category and vendor totals are summed from the same item amounts.

## Changes

A `Change` may set any of: `guest_count`, `budget_minor`, `reserve_minor`, `event_date`, `item_units`, `quote_totals`. Only non-`None` fields apply. `kind` is a label (`guest_count`, `budget`, `date`, `quote`, `items`, `proposal`).

Invariants:

- `0 <= guest_count <= 100000`
- `0 <= budget <= 10^14`
- `0 <= reserve <= budget`
- item ids in `item_units` / `quote_totals` must exist on the snapshot
- resulting unit amounts and quote totals must be non-negative

A change with no fields is invalid.

**Quote totals are a simulation-only lever.** A confirmed quote recorded through the vendor API writes `BudgetItem.quote_override_minor` directly; proposals do not carry `quote_totals`.

## Alternatives

Alternatives are computed only when the projected plan is over budget. They are derived from the projected snapshot; none are templated.

| ID | Condition | Change |
| --- | --- | --- |
| `release_reserve` | reserve ≥ spendable_shortfall | reserve −= spendable_shortfall |
| `trim_per_guest` | scaling produces a feasible result | scale unquoted per-guest rates proportionally to `(spendable − fixed) // guests`, integer floor, paise correction |
| `reduce_guests` | per-guest unit total > 0 and max guests < projected guests | guests = `(spendable − fixed) // per_guest_unit_total` |
| `increase_budget` | always added when over budget | budget = committed + reserve |

When fewer than two alternatives exist, the result carries a note rather than inventing options.

### Flagship values (asserted in tests)

| Quantity | Paise | Rupees |
| --- | --- | --- |
| Baseline committed | 146,560,000 | ₹14,65,600 |
| Spendable | 162,000,000 | ₹16,20,000 |
| Committed at 240 guests | 170,080,000 | ₹17,00,800 |
| Shortfall | 8,080,000 | ₹80,800 |
| Reserve after release | 9,920,000 | ₹99,200 |
| Trimmed per-guest unit sum | 358,332 | ₹3,583.32 |
| Reduced guest count | 219 | — |
| Increased budget | 188,080,000 | ₹18,80,800 |

## Proposals

A proposal stores `base_version`, the scenario, the computed impact and the alternatives. Creating a proposal:

- recomputes from the current snapshot;
- refuses an infeasible change (`422 infeasible_proposal`) and returns the alternatives;
- writes nothing to the event.

A proposal is a **draft** until approved. Approval applies only:

- `guest_count`, `budget_minor`, `reserve_minor`, `event_date`;
- `item_units` (unit amounts on existing budget items);
- moved task due dates and ceremony dates from the date projection.

`quote_totals` cannot enter a proposal (`422 quote_totals_simulation_only`) and is never applied by approval. `event.version` increments once for the approval. One revision row records the before/after summary and the actor. The summary includes `event_date`, `task_dates` and `ceremony_dates` so a date approval can be audited.

A proposal also stores a deterministic `baseline_hash` of the snapshot inputs: event budget, reserve, date and guest count; item units, quantities and confirmed quote overrides; tasks; dependencies; and ceremonies. Approval takes the event row lock, rebuilds the snapshot and compares the hash. A mismatch returns `409 baseline_changed` and writes nothing. Budget-item, confirmed-quote, task, dependency and ceremony writes take the same event row lock, so they serialize with approval. `event.version` alone is not the planning fingerprint: it tracks event-row writes and approved revisions, while separate-row edits are caught by the hash.

## Timeline

A task moves when `offset_days` is set, its status is not `done`, and it is not locked. Its new due date is `new_event_date + offset_days`. The UI computes `offset_days` from the event date when the task is created or edited.

Every ceremony moves by the event-date delta, preserving its relative spacing. The simulation returns the projected ceremony dates in `ceremony_changes`; approval persists them with the moved task dates.

After moving, each dependency is checked. If a predecessor's due date is later than its successor's, a conflict is reported. A simulation with conflicts is not feasible.

Dependency creation runs a depth-first cycle check and rejects a cycle with the offending path.

## Idempotent mutations

Create requests may carry an `Idempotency-Key`. The API stores an `IdempotencyRecord`
with:

- `user_id` and optional `event_id`;
- `scope_key` (`event_id` for event-scoped writes, `"account"` for event creation);
- `method`, `endpoint` and the client key;
- a SHA-256 fingerprint of the canonical request body and relevant path parameter;
- the completed response status and JSON body;
- `expires_at`, 24 hours after creation.

The unique constraint is `(user_id, scope_key, method, endpoint, idempotency_key)`.
The reservation row and the mutation are flushed and committed in one transaction. A
duplicate insert waits on the constraint, then replays the completed response or
returns `409 idempotency_conflict` when the fingerprint differs. A failed action rolls
back both the mutation and the reservation.

A replay is not a new domain transition: it does not increment `event.version`, create
a revision, or repeat any side effect. The key is scoped to one user and one event, so
it cannot expose another owner's response. Proposal creation and dependency creation
are outside this mechanism; approval has its own replay semantics through the proposal
status, and the dependency composite key prevents duplicate edges.

Records are retained for 24 hours. There is no in-app scheduler in this release;
operators may delete rows whose `expires_at` has passed using the index. Until a row is
removed, a retry still replays; after removal, the key may be used for a new mutation.

## State machine

Event status: `planning`, `approved`, `cancelled`. Proposal status: `draft`, `approved`, `rejected`. Rejecting an already rejected proposal is idempotent; approving a rejected proposal is a conflict; rejecting an approved proposal is a conflict.

Guest count and event-date changes are never accepted through `PATCH /events/{id}`. They must travel through simulate → proposal → approve so that review cannot be bypassed and dependent tasks and ceremonies move together.
