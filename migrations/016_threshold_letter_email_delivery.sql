-- migrations/016_threshold_letter_email_delivery.sql
--
-- Delayed delivery of a kept Threshold Letter back to its seeker by
-- email, days after it was kept ("a letter has come for you") — the one
-- place the existing memory/return architecture (myth_archetype,
-- threshold_letter, journal_synthesis, RecallLetter.tsx) was pull-only:
-- none of it reaches back out to a lapsed seeker on its own.
--
-- Explicit opt-in, per user, not per letter: `letters_by_email` defaults
-- false. A seeker turns it on once (see RecallLetter.tsx / POST
-- /api/user/preferences) and it then applies to future kept letters —
-- consistent with the ledger's own fail-closed posture (nothing sent
-- unless deliberately asked for).
--
-- `email_attempts` exists so the cron sweep (app/api/cron/
-- deliver-threshold-letters) can give up after repeated send failures
-- instead of retrying a permanently-bouncing address forever.

ALTER TABLE elder_user
  ADD COLUMN IF NOT EXISTS letters_by_email BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE threshold_letter
  ADD COLUMN IF NOT EXISTS delivery_email_sent_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS email_attempts INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS threshold_letter_delivery_pending_idx
  ON threshold_letter (created_at)
  WHERE delivery_email_sent_at IS NULL;
