-- migrations/019_rate_limit_bucket.sql
--
-- Backs lib/rate-limit.ts with Neon Postgres instead of an in-memory Map.
-- The in-memory version resets on every serverless cold start and is
-- fragmented across concurrent warm instances -- on Vercel this means a
-- "10 requests/day" cap is not actually a global per-IP guarantee, just a
-- per-instance one. One row per rate-limit key (e.g. an IP, or a prefixed
-- key like "auth:<ip>"); the row is reused across the whole 24h window and
-- reset in place once expired, rather than growing a table of history.
--
-- Idempotent per migrations/README.md convention.

CREATE TABLE IF NOT EXISTS rate_limit_bucket (
  key        TEXT        PRIMARY KEY,
  count      INTEGER     NOT NULL DEFAULT 1,
  first_hit  TIMESTAMPTZ NOT NULL DEFAULT now()
);
