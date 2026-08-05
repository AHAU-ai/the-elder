-- migrations/006_journal_cross_lineage.sql
-- Adds the cross-lineage pattern field to journal_synthesis — the one
-- insight no single lineage's voice is permitted to speak (Lineage
-- Integrity of Voice keeps each voice inside its own tradition), computed
-- instead by the diviner reading across all of a seeker's lineages at once.
--
-- Idempotent. Run against a Neon DEV branch first.

BEGIN;

ALTER TABLE journal_synthesis
  ADD COLUMN IF NOT EXISTS cross_lineage_pattern TEXT NOT NULL DEFAULT '';

COMMIT;
