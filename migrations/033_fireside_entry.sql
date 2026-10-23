-- migrations/033_fireside_entry.sql
--
-- The fireside (docs/fireside.md): a room where the seeker talks with the
-- Elder as host, not a Reading. One row per completed exchange.
--
-- WHAT IS NEVER WRITTEN HERE
--   * A crisis or distress turn: the route returns before any insert. There is
--     no column for "this was a crisis", because the row simply does not exist.
--   * A turn the dual guardian declined, or one that failed for infrastructure
--     reasons.
--   * Anything about the seeker the seeker did not say. No markers, no
--     classification, no model-assessed summary.
--
-- WHAT FEEDS THE TREE
--   Only kept_text: one line, in the seeker's own words, that the seeker chose
--   to carry out of an exchange. It is seeker-authored and seeker-confirmed
--   (kept_at set by the seeker's own action), the same posture as
--   becoming_statement (migration 027), and is kept in its own table for the
--   same reason: it is a different kind of thing from a marker the Elder
--   noticed across sittings, and must not be passed off as one.
--
-- RELEASE
--   Every row is the seeker's to release (DELETE by id, or all at once through
--   /api/journal's release-all). ON DELETE CASCADE with elder_user covers
--   account removal. Releasing a row removes its Tree leaf with it.
--
-- Idempotent. Run against a Neon DEV branch first.

BEGIN;

CREATE TABLE IF NOT EXISTS fireside_entry (
  id          BIGSERIAL   PRIMARY KEY,
  user_id     BIGINT      NOT NULL REFERENCES elder_user(id) ON DELETE CASCADE,
  seeker_text TEXT        NOT NULL CHECK (char_length(seeker_text) BETWEEN 1 AND 2000),
  elder_text  TEXT        NOT NULL CHECK (char_length(elder_text) BETWEEN 1 AND 3000),
  -- The seeker's own line, set only by the seeker's explicit keep.
  kept_text   TEXT        CHECK (kept_text IS NULL OR char_length(kept_text) BETWEEN 3 AND 140),
  kept_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT fireside_kept_pair CHECK ((kept_text IS NULL) = (kept_at IS NULL))
);

CREATE INDEX IF NOT EXISTS idx_fireside_entry_user
  ON fireside_entry (user_id, created_at DESC);

COMMIT;
