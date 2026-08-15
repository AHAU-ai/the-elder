-- migrations/010_threshold_letter_marker.sql
-- Returning-Arc Marker Personalization.
--
-- Adds `marker` (which of the 5 §1.5 markers this kept letter closed on)
-- and `chain_id` (best-effort, decorative — not read by the deficit
-- computation) to threshold_letter. Nullable, no backfill: pre-existing
-- rows stay marker = NULL and must be excluded from deficit counts rather
-- than treated as evidence for any marker.

BEGIN;

ALTER TABLE threshold_letter
  ADD COLUMN IF NOT EXISTS marker   TEXT NULL,
  ADD COLUMN IF NOT EXISTS chain_id TEXT NULL;

ALTER TABLE threshold_letter
  ADD CONSTRAINT threshold_letter_marker_check
  CHECK (marker IS NULL OR marker IN ('wound','threshold','pattern','exile','figure'));

CREATE INDEX IF NOT EXISTS threshold_letter_user_marker_idx
  ON threshold_letter (user_id, marker);

COMMIT;
