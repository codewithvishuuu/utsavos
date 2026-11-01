# Database

PostgreSQL 16 is the only supported database. Tests run against real PostgreSQL databases; SQLite is not accepted (and production startup rejects it).

- Driver: `psycopg` 3
- ORM: SQLAlchemy 2.x typed `Mapped` models
- Migrations: Alembic
- Money: `BIGINT` paise
- IDs: PostgreSQL `UUID`
- Timestamps: `TIMESTAMPTZ`
- Flexible computed payloads: `JSONB`

## Tables

### `users`

`id` UUID PK, `email` varchar(320) unique indexed, `password_hash` varchar(255), `display_name` varchar(120), `created_at`, `updated_at`.

### `sessions`

`id` UUID PK, `user_id` FK → users `ON DELETE CASCADE` indexed, `token_hash` varchar(64) unique indexed (SHA-256 of the opaque token), `created_at`, `expires_at`, `revoked_at`, `user_agent` varchar(255).

### `events`

`id` UUID PK, `user_id` FK → users cascade indexed, `name` varchar(160), `event_type` varchar(40), `city` varchar(120), `event_date` date, `guest_count` int, `budget_minor` bigint, `reserve_minor` bigint, `currency` varchar(3), `status` varchar(20), `version` int, timestamps.

Checks: guests ≥ 0, budget ≥ 0, `0 ≤ reserve ≤ budget`, version ≥ 1, status in (`planning`, `approved`, `cancelled`). Index `(user_id, created_at)`.

### `ceremonies`

`id` UUID PK, `event_id` FK cascade indexed, `name`, `ceremony_date`, `guest_count`, `venue`.

### `budget_items`

`id` UUID PK, `event_id` FK cascade indexed, `category`, `label`, `basis` (`fixed` / `per_guest`), `unit_amount_minor` bigint, `quantity`, `vendor_id` FK → vendors `ON DELETE SET NULL` indexed, `quote_override_minor` bigint nullable, `is_optional` bool.

Checks: amount ≥ 0, override null or ≥ 0, quantity ≥ 0, basis in the two values.

### `guests`

`id` UUID PK, `event_id` FK cascade indexed, `full_name`, `party_size`, `dietary_tags`, `accessibility_notes`, `email`, `phone`, `notes`. Check party size ≥ 0.

### `vendors`

`id` UUID PK, `event_id` FK cascade indexed, `name`, `category`, `contact_name`, `email`, `phone`, `status`, timestamps.

### `quotes`

`id` UUID PK, `event_id` FK cascade indexed, `vendor_id` FK cascade indexed, `budget_item_id` FK → budget_items `ON DELETE SET NULL` indexed, `amount_minor` bigint, `inclusions`, `exclusions`, `status` (`estimated`, `quoted`, `confirmed`, `declined`), `valid_until`, timestamps.

A quote with status `confirmed` and a linked budget item writes `budget_items.quote_override_minor = amount_minor`. Other statuses do not affect totals.

### `tasks`

`id` UUID PK, `event_id` FK cascade indexed, `title`, `status` (`todo`, `in_progress`, `done`, `cancelled`), `due_date`, `offset_days` nullable, `is_locked` bool.

### `task_dependencies`

Composite PK (`predecessor_id`, `successor_id`), both FK → tasks cascade. Check predecessor ≠ successor. Cycles are rejected in the API before insert; the database only prevents self-loops.

### `proposals`

`id` UUID PK, `event_id` FK cascade indexed, `status` (`draft`, `approved`, `rejected`), `base_version` int, `scenario` JSONB, `impact` JSONB, `alternatives` JSONB, `created_at`, `decided_at`, `revision_id` UUID nullable.

Unique `(event_id, id)` supports ownership-safe lookups.

### `revisions`

`id` UUID PK, `event_id` FK cascade indexed, `proposal_id` UUID nullable, `version` int, `before_json` JSONB, `after_json` JSONB, `created_at`, `actor_user_id` UUID.

Unique `(event_id, version)` guarantees one revision per event version.

### `consent_records`

`id` UUID PK, `user_id` FK cascade indexed, `provider` varchar(40), `policy_version` varchar(20), `granted_at`, `revoked_at`.

### `idempotency_records`

`id` UUID PK, `user_id` FK cascade indexed, `event_id` FK cascade indexed nullable, `scope_key` varchar(64), `method` varchar(10), `endpoint` varchar(80), `idempotency_key` varchar(255), `request_hash` varchar(64), `response_status` int nullable, `response_body` JSONB nullable, `created_at`, `expires_at`.

Unique `(user_id, scope_key, method, endpoint, idempotency_key)`; index on `expires_at`. `scope_key` is the event UUID for event-scoped writes and `"account"` for event creation. See [API.md](API.md#idempotent-mutation-retries) and [DOMAIN_MODEL.md](DOMAIN_MODEL.md#idempotent-mutations).

## Concurrency

Approval runs in one transaction:

1. `SELECT ... FOR UPDATE` on the event row, owner-scoped.
2. Reject if the proposal is rejected, its base version is stale, or it has no baseline fingerprint.
3. Rebuild the snapshot, compare `impact.baseline_hash`, and recompute.
4. Apply allowlisted fields, increment `events.version` once.
5. Insert one revision and mark the proposal approved.
6. Commit.

Concurrent approvals serialize on the row lock. The second transaction sees `status = approved` and returns the existing revision with `idempotent_replay: true`. The test suite runs this race with two threads and asserts one mutation and one replay.

Snapshot-affecting setup writes (budget items, confirmed quotes, tasks and dependencies) take the same event row lock. They either commit before approval, causing `409 baseline_changed`, or after it, leaving the approved revision as the historical state. The suite also races an item edit against approval and asserts neither a torn revision nor a partial mutation.

Idempotent creates reserve their key row and run the mutation in one transaction. A concurrent request with the same scope and key waits on the unique constraint, then replays the committed response or sees `409 idempotency_conflict` if the request fingerprint differs. A failed mutation rolls back both the key row and the data. See [API.md](API.md#idempotent-mutation-retries).

## Migrations

- `alembic upgrade head` is a release step, not an application-start side effect.
- `0001_initial` intentionally uses `Base.metadata.create_all` so the first migration cannot drift from the models. The file carries a `shortcut:` comment instructing replacement with explicit operations before the first destructive schema change.
- `0002_idempotency` adds `idempotency_records`. It is conditional on the table being absent, so it also upgrades a database that was created by the metadata shortcut.
- Migration tests create and drop `utsavos_migrate_test`.

## Connection pool

Defaults: pool size 5, max overflow 5, pool timeout 5 s. Override with `DB_POOL_SIZE`, `DB_POOL_MAX_OVERFLOW` and `DB_POOL_TIMEOUT_SECONDS`. Every pooled connection sets server-side waits with the same psycopg options the app engine uses: `statement_timeout` (`DB_STATEMENT_TIMEOUT_MS`, default 15000) and `lock_timeout` (`DB_LOCK_TIMEOUT_MS`, default 5000), so stuck statements and lock waits cancel and requests fail bounded instead of hanging. A saturated pool returns `503 service_unavailable` after the pool timeout, without database internals in the body.

`GET /readyz` checks connectivity (`SELECT 1`), that every application table exists, and that `alembic_version` is at the head revision; in production it also requires the live connection to run with TLS (`pg_stat_ssl`). Reasons are fixed non-sensitive strings (`schema not migrated`, `migrations out of date`, `database TLS not verified`).

AI endpoints return their pooled connection before calling an external provider, so a slow Ollama or Gemini call does not consume pool capacity or hold a transaction open.

## Backup and restore

Follow [runbooks/BACKUP_RESTORE.md](runbooks/BACKUP_RESTORE.md). The short version:

- `pg_dump --format=custom` inside the container, then `docker cp` the file. Do not use PowerShell binary redirection.
- Verify the SHA-256 on both sides and parse the archive with `pg_restore --list`.
- Restore only into a new, empty database. Never use `--clean` against a live or shared database.
- Verify migration version, schema and row counts, then point a scratch API at the copy and require `/readyz` 200.
- These are logical backups only: no WAL/PITR, no roles/extensions/database settings, and no backup scheduler is included. Backups contain personal data; encrypt them, restrict access, set retention, and delete local test copies.

No automated backup is configured in this repository.
