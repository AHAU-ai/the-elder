-- migrations/014_anomaly_record_source_column.sql
-- app/api/log/route.ts has, since it was written, inserted a `source`
-- column into anomaly_record that was never added to the table --
-- schema.sql's anomaly_record definition never had it either. Every
-- anomaly write has been silently failing (caught by the route's own
-- try/catch, "observatory must never break the response") for as long
-- as that code has existed. Found 2026-08-18 while wiring corpus
-- retrieval to log real failures there for the first time.
--
-- Adding the column the app already expects, rather than removing the
-- field from the route -- `source` (which module/route logged this) is
-- genuinely useful and was clearly intentional (_source is threaded
-- through logAnomaly() call sites specifically to carry it).

BEGIN;

ALTER TABLE anomaly_record
  ADD COLUMN IF NOT EXISTS source TEXT NULL;

COMMIT;
