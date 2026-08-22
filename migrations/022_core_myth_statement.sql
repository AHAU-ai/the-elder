-- migrations/022_core_myth_statement.sql
--
-- The Core Myth Statement: a seeker-authored, seeker-owned capstone
-- artifact. Resolves the R1 tension structurally rather than working
-- around it forever -- The Elder is forbidden from asserting a connection
-- between separately-confirmed markers (R1, settled (a): co-occurrence is
-- spoken as bare fact, never framed as a claimed relationship), but the
-- SEEKER is the sovereign author of claims about their own life. This
-- moves that authorship to its correct owner.
--
-- Append-only, versioned -- a revision is a meaningful event, not an
-- overwrite. Exempt from any cap/eviction by simply being its own table
-- with none (see thresholdLetterLedger.ts's MAX_LETTERS_PER_USER for
-- contrast -- deliberately not applied here, and this migration does not
-- touch that file or its logic at all).
--
-- Idempotent. Run against a Neon DEV branch first.

BEGIN;

CREATE TABLE IF NOT EXISTS core_myth_statement (
  id                BIGSERIAL   PRIMARY KEY,
  user_id           BIGINT      NOT NULL REFERENCES elder_user(id) ON DELETE CASCADE,
  version           INTEGER     NOT NULL CHECK (version >= 1),
  body_text         TEXT        NOT NULL CHECK (char_length(body_text) BETWEEN 50 AND 1500),
  -- marker_trajectory row ids that were on offer as material at authorship
  -- time -- audit trail only, never asserted as connected to each other or
  -- to the statement itself. References by id, not re-typed marker_value
  -- text, matching marker_depth_transition's own precedent (migration 020).
  source_marker_ids JSONB       NOT NULL DEFAULT '[]',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  superseded_at     TIMESTAMPTZ,
  UNIQUE (user_id, version)
);

CREATE INDEX IF NOT EXISTS idx_core_myth_statement_user
  ON core_myth_statement (user_id, version DESC);

-- Enforces "at most one current (non-superseded) statement per user" at
-- the database level, not just in application logic -- a partial unique
-- index rather than a CHECK constraint, since CHECK can't reference other
-- rows. Race-safety backstop for the propose/supersede write path in
-- lib/returning/coreMythStatement.ts: even if two concurrent saves both
-- pass the application-level "no other current version" check, only one
-- can hold this index slot.
CREATE UNIQUE INDEX IF NOT EXISTS uq_core_myth_statement_one_current
  ON core_myth_statement (user_id) WHERE superseded_at IS NULL;

-- Standing-invitation dismissal state (count-based re-offer, no timers --
-- see the design record in the PR this migration ships with). One row
-- per user; upserted on dismiss.
CREATE TABLE IF NOT EXISTS core_myth_invitation_dismissal (
  user_id           BIGINT      PRIMARY KEY REFERENCES elder_user(id) ON DELETE CASCADE,
  dismissed_at_count INTEGER    NOT NULL,
  dismissed_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMIT;
