-- migrations/034_guided_journal_letter_outcome.sql
--
-- Brainstorm item #5, full pass: "the report becomes something the next
-- reading can honestly draw on." Before this, a report-back written
-- through LetterReportForm.tsx (app/components/RecallLetter.tsx,
-- ThresholdLetters.tsx) was saved into guided_journal_entry
-- (migration 018) exactly like an ordinary post-reading reflection --
-- structurally correct (it IS the seeker's own unedited words), but with
-- no way to tell the two apart later. lib/returning/letterOutcomeContext.ts
-- needs to find "reports of what happened after a kept gift" specifically,
-- not every guided-journal entry ever written, so this adds a nullable
-- link back to the letter it reports on. NULL for every entry written
-- before this migration and for ordinary post-reading reflections going
-- forward -- only LetterReportForm's own POST sets it.
--
-- Idempotent per migrations/README.md convention.

ALTER TABLE guided_journal_entry
  ADD COLUMN IF NOT EXISTS threshold_letter_id BIGINT REFERENCES threshold_letter(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS guided_journal_entry_letter_idx
  ON guided_journal_entry (threshold_letter_id) WHERE threshold_letter_id IS NOT NULL;
