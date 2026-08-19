# Migrations

`migrations/*.sql` is the single source of truth for this database's
schema history, in numeric order. If you're adding a column or table,
add a new numbered `.sql` file here — do not write a new
`scripts/migrate-*.mjs` script.

## Why this note exists

Before 2026-08-18, schema changes went two ways: some as numbered files
here, others as standalone `scripts/migrate-phase*.mjs` scripts that were
never ported into this directory. That split had already caused real
drift once — `migrations/013_fix_lineage_key_drift.sql` exists because a
column rename went untracked long enough to break a view silently.

`migrations/001`–`003` retroactively document three tables/table-groups
that were live in the database but had no corresponding file here
(myth accounts, the altar ledger, threshold letters + the consent ledger).
Each was verified against the live database's actual `information_schema`
before being written — not copied from whichever of the (sometimes
mutually inconsistent — see the note in `002_baseline_altar_ledger.sql`
about `altar_record`) source scripts looked newest.

The old `scripts/migrate-phase*.mjs` / `scripts/migrate-consent-ledger.mjs`
/ `scripts/migrate-age-register.mjs` files are left in place as historical
record (and `age-register`'s content is already correctly mirrored by
`007_narrative_register.sql`) but should be treated as **read-only
history**, not run again — running them is harmless (everything in them is
`IF NOT EXISTS`-guarded) but they are no longer where a schema change
should be added.

## Running

Each file is idempotent (`CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT
EXISTS`, guarded `DO $$ ... $$` blocks for constraints) — safe to run
against a database that already has some or all of the tables. Apply in
numeric order via `psql -f migrations/NNN_name.sql "$DATABASE_URL"`, or
through the Neon SQL editor. Migrations that touch DDL under load should
use `DATABASE_URL_UNPOOLED` (see `008_visit_record_on_elder_user.sql` /
`009_marker_trajectory.sql` for the pattern).

After any migration that adds a column to a table wrapped by a
`SELECT *` view, run `npm run check:schema-drift` against the live
database — see that script's own header comment for why.
