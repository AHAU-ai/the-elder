-- migrations/028_letter_delivery_delay.sql
--
-- M4 (docs/inhabiting-the-elder.md): the seeker chooses HOW LONG a kept
-- Threshold Letter waits before it is emailed back -- a few days (the
-- existing behaviour), a month, or a season. Still exactly one send per
-- letter, ever (delivery_email_sent_at, migration 016): this adds a choice of
-- delay, never a recurring rhythm.
--
-- Two columns, and why there are two:
--   elder_user.letters_email_delay_days -- the seeker's CURRENT preference.
--   threshold_letter.delivery_delay_days -- a snapshot taken when the letter is
--     kept. A letter's own promised delay never moves: changing the preference
--     from "a season" to "a few days" must not suddenly release letters the
--     seeker kept weeks ago under the longer promise. (Turning email OFF still
--     stops every pending letter at once -- letters_by_email gates the sweep.)
--
-- NULL means "no explicit choice": the sweep treats it as the original 3 days,
-- so every row that exists today behaves exactly as before.
--
-- DEPLOY ORDER: apply this BEFORE shipping the code that reads it. Keeping a
-- letter inserts delivery_delay_days; without the column the insert fails (and
-- the callers deliberately swallow ledger errors, so a letter would silently
-- not be kept).

ALTER TABLE elder_user
  ADD COLUMN IF NOT EXISTS letters_email_delay_days SMALLINT NULL;

ALTER TABLE threshold_letter
  ADD COLUMN IF NOT EXISTS delivery_delay_days SMALLINT NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'elder_user_letters_email_delay_days_chk') THEN
    ALTER TABLE elder_user
      ADD CONSTRAINT elder_user_letters_email_delay_days_chk
      CHECK (letters_email_delay_days IS NULL OR letters_email_delay_days IN (3, 30, 90));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'threshold_letter_delivery_delay_days_chk') THEN
    ALTER TABLE threshold_letter
      ADD CONSTRAINT threshold_letter_delivery_delay_days_chk
      CHECK (delivery_delay_days IS NULL OR delivery_delay_days IN (3, 30, 90));
  END IF;
END $$;
