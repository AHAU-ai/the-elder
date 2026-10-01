-- migrations/027_seeker_carry.sql
-- R2/R3 (specs/adr/ADR-0015.md): what a seeker chose to carry out of a reading —
-- optionally one static "way of looking" (practice_key) and/or one line in their
-- OWN words. One row per reading at most.
--
-- Privacy shape: the row is tied to its reading with ON DELETE CASCADE, so
-- releasing a reading (or a chain, or the account) releases what was carried
-- from it. The line is read back to the same seeker only. No model ever reads
-- this table (enforced by scripts/check-carry-register.mjs).
--
-- Idempotent. Run against a Neon DEV branch first.

BEGIN;

CREATE TABLE IF NOT EXISTS seeker_carry (
  id            BIGSERIAL PRIMARY KEY,
  user_id       BIGINT NOT NULL REFERENCES elder_user(id) ON DELETE CASCADE,
  visit_id      UUID   NOT NULL REFERENCES visit_record(id) ON DELETE CASCADE,
  practice_key  TEXT CHECK (practice_key IN ('appear', 'absent', 'near', 'before')),
  line          TEXT CHECK (char_length(line) <= 200),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT seeker_carry_has_content CHECK (practice_key IS NOT NULL OR line IS NOT NULL)
);

-- At most one carry per reading: a double-submit is a no-op, never a duplicate.
CREATE UNIQUE INDEX IF NOT EXISTS uq_seeker_carry_visit ON seeker_carry (visit_id);
CREATE INDEX IF NOT EXISTS idx_seeker_carry_user_created ON seeker_carry (user_id, created_at DESC);

COMMIT;
