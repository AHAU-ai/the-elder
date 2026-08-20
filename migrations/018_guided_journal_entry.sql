-- migrations/018_guided_journal_entry.sql
--
-- Guided journaling: a reflective prompt offered right after a seeker
-- keeps their reading as a Shareable Card (see ShareableCard.tsx /
-- GuidedJournalPrompt.tsx), distinct from journal_synthesis (an
-- auto-generated cross-reading throughline) and myth_archetype (the
-- stored myth itself) — this is the seeker's own written reflection on
-- one specific reading.
--
-- Idempotent per migrations/README.md convention.

CREATE TABLE IF NOT EXISTS guided_journal_entry (
  id          BIGSERIAL   PRIMARY KEY,
  user_id     BIGINT      NOT NULL REFERENCES elder_user(id) ON DELETE CASCADE,
  lineage_key TEXT        NOT NULL,
  marker      TEXT,
  prompt      TEXT        NOT NULL,
  response    TEXT        NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS guided_journal_entry_user_idx ON guided_journal_entry (user_id);
CREATE INDEX IF NOT EXISTS guided_journal_entry_created_idx ON guided_journal_entry (created_at DESC);
