# Backup and restore runbook

Logical PostgreSQL backups for UtsavOS. This is not a substitute for the database
provider's managed backups, point-in-time recovery or disaster-recovery plan.

## Safety rules

- Never restore over a live or shared database, and never use `--clean` or `--if-exists`
  on one. Restore into a new, empty database.
- Keep the previous database read-only until the restored copy has passed verification
  and the application has been pointed at it.
- Do not redirect a custom-format dump through PowerShell `>`/`|`. Use a file inside
  the container and `docker cp`; binary redirection can corrupt the archive.
- Test the restore into an isolated PostgreSQL instance before trusting the backup.
- Backups contain account emails, password hashes, guest contact details and planning
  data. Encrypt them at rest and in transit, restrict access, set a retention period,
  and delete local test copies. `.dump` files are ignored by Git, but that is not
  access control.
- No backup schedule is included in this repository. Configure one at the deployment
  or managed-database layer.

## Backup

The commands below use the local Compose stack. Compose still interpolates the API
environment for `db` commands, so `APP_SECRET_KEY` and `POSTGRES_PASSWORD` must be set
(or present in `.env`) even though only the database is involved.

```powershell
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$name = "utsavos-$stamp.dump"
$containerPath = "/tmp/$name"
New-Item -ItemType Directory -Force -Path backups | Out-Null

# Dump inside the container so no host binary redirection is involved.
docker compose exec -T db pg_dump -U utsavos -d utsavos `
  --format=custom --compress=9 --file=$containerPath
if ($LASTEXITCODE -ne 0) { throw "pg_dump failed" }

$container = (docker compose ps -q db).Trim()
docker cp "${container}:$containerPath" "backups/$name"

# Transport integrity: both hashes must match.
certutil -hashfile "backups/$name" SHA256
docker compose exec -T db sha256sum $containerPath

# Parse the archive before relying on it.
docker compose exec -T db pg_restore --list $containerPath
```

For a managed database, run `pg_dump` with the same PostgreSQL major version as the
server, using a least-privilege backup role. Put the password in `PGPASSWORD` from a
secret manager or in a protected `.pgpass`; do not put it on the command line.

Use `--format=custom` so `pg_restore` can verify the archive while restoring and can
restore selectively. A custom dump is not encrypted by PostgreSQL.

## Isolated restore test

Use a throwaway container with no persistent volume and a port bound to loopback. The
example password is a placeholder; generate a unique one.

```powershell
$name = "utsavos-<stamp>.dump"   # the dump created above
$dump = Resolve-Path "backups/$name"

docker run -d --rm --name utsavos-restore-test `
  -e POSTGRES_USER=utsavos `
  -e POSTGRES_PASSWORD=<ephemeral-password> `
  -e POSTGRES_DB=utsavos_restore `
  -p 127.0.0.1:55432:5432 `
  postgres:16-alpine

# Wait until the scratch server accepts connections.
docker exec utsavos-restore-test pg_isready -U utsavos -d utsavos_restore

docker cp $dump "utsavos-restore-test:/tmp/$name"
docker exec utsavos-restore-test sha256sum "/tmp/$name"

# Empty target, one transaction, fail on the first error.
docker exec utsavos-restore-test pg_restore `
  -U utsavos -d utsavos_restore `
  --single-transaction --exit-on-error --no-owner --no-privileges `
  "/tmp/$name"
```

`--no-owner --no-privileges` makes the copy portable to a target where role names or
grants differ. The restored objects are owned by the connecting restore user. If the
production plan requires the original owners and ACLs, create those roles first and
omit both flags.

Verify the migration version and compare every table count with the source:

```powershell
docker exec utsavos-restore-test psql -U utsavos -d utsavos_restore `
  -c "select version_num from alembic_version;"

$tables = @(
  "users", "events", "ceremonies", "budget_items", "guests", "vendors",
  "quotes", "tasks", "task_dependencies", "proposals", "revisions",
  "sessions", "consent_records", "idempotency_records", "alembic_version"
)
$selects = ($tables | ForEach-Object {
  "select '$_' as table_name, count(*) as rows from $_"
}) -join " union all "
docker exec utsavos-restore-test psql -U utsavos -d utsavos_restore `
  -At -F "|" -c "$selects order by table_name"
```

Then start a scratch API against the copy and require readiness. This does not write to
the restored database:

```powershell
$env:DATABASE_URL = "postgresql+psycopg://utsavos:<ephemeral-password>@127.0.0.1:55432/utsavos_restore"
$env:APP_ENV = "development"
$env:APP_SECRET_KEY = "<throwaway-secret-at-least-32-characters>"
$env:AI_LOCAL_ENABLED = "false"
$env:CLOUD_AI_ENABLED = "false"
$env:PYTHONPATH = "src"
cd apps/api
.\.venv\Scripts\python -m uvicorn utsavos.main:app --host 127.0.0.1 --port 8010
# In another shell:
curl.exe -sS http://127.0.0.1:8010/readyz
```

Require `{"status":"ready","database":true}`. Stop the scratch API, then clean up:

```powershell
docker stop utsavos-restore-test
Remove-Item "backups/$name"
docker compose exec -T db rm -f "/tmp/$name"
```

## Production recovery

1. Stop writes: scale the API to zero, take it out of the load balancer, or enable
   maintenance mode at the proxy. Keep the old database for rollback and evidence.
2. Provision a new empty PostgreSQL 16 database with the required roles and extensions.
   Do not restore into the live database.
3. Restore the selected dump with `--single-transaction --exit-on-error`. Prefer
   `--no-owner --no-privileges` unless the original roles and grants are already
   present.
4. Verify `alembic_version` is the expected revision, all tables exist, row counts are
   plausible, and a scratch API reports `/readyz` 200.
5. Point the application at the restored database, start one API worker, and run the
   authenticated and public smoke checks in [DEPLOYMENT_SMOKE_TEST.md](../DEPLOYMENT_SMOKE_TEST.md).
6. Keep the old database read-only until the rollback window closes. Rotate database
   credentials if the incident involved exposure.

If the application is restored at an older migration, run `alembic upgrade head` as a
release step, then re-run readiness and the smoke checks. If the dump is newer than the
application, deploy the matching application version first.

## Limitations

- This is a logical backup, not WAL archiving or point-in-time recovery. The recovery
  point is the last successful dump; the recovery time is the restore and verification
  time.
- PostgreSQL major versions must match (or be supported by `pg_restore`). Test the
  actual version pair.
- PostgreSQL roles, database-level settings, extensions and some ownership/ACL details
  are not reliably portable. The tested restore used `--no-owner --no-privileges`.
- A dump is a consistent snapshot, but it does not stop application writes. Large
  databases increase dump and restore time.
- No encryption, off-host copy, retention policy, integrity schedule or restore drill
  is automated here. Those are deployment responsibilities.
- `idempotency_records` are included in the backup. Their 24-hour expiry is not a
  backup retention policy; see [OPERATIONS.md](OPERATIONS.md#idempotency-retention).

## Local evidence (2026-10-26)

This was a local test of the procedure, not a staging or production backup:

- Source: local Compose PostgreSQL 16.15 at `alembic_version = 0002_idempotency`; 15
  public tables; 78 users, 78 events, 190 idempotency records, and the other snapshot
  counts recorded below.
- Dump: custom format with gzip compression, 125,778 bytes, 90 TOC entries, SHA-256
  `9254ad744712e442fb81a9e6eca892e28c125d17caa0f9106c7a25eb288f0c2b`.
- Restore: throwaway `postgres:16-alpine` container on `127.0.0.1:55432`, no persistent
  volume. `pg_restore --single-transaction --exit-on-error --no-owner --no-privileges`
  exited 0. The copied dump hash matched the source hash.
- Verified: 15 tables, `0002_idempotency`, and matching row counts:
  `alembic_version=1`, `budget_items=462`, `ceremonies=26`, `consent_records=0`,
  `events=78`, `guests=36`, `idempotency_records=190`, `proposals=64`, `quotes=26`,
  `revisions=64`, `sessions=78`, `task_dependencies=26`, `tasks=52`, `users=78`,
  `vendors=26`.
- A scratch API pointed at the restored copy returned
  `{"status":"ready","database":true}` from `/readyz`.
- Cleanup: the throwaway container was removed, port 55432 was closed, and the local
  dump was deleted.
