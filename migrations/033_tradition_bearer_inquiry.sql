-- Tradition-bearer inquiry ledger.
--
-- The gate documented in docs/reading-shape-voice-review.md and
-- src/resilience/flags.ts is not meant to be a dead end -- it's meant to
-- be a door a real tradition-bearer can walk through. Before this
-- migration there was no surface for that: someone with standing to
-- speak for a lineage had no way to reach the project except finding
-- Jesse directly. This table is the intake for that door: a submission
-- is a lead for a real review (Track 1 in reading-shape-voice-review.md
-- style: draft an ask, get a real answer, record it), never an
-- authorization by itself. Nothing about a row in this table flips a
-- flag or an AUTHORIZED_ACCENTS entry automatically -- see
-- lib/traditionBearerLedger.ts.
CREATE TABLE IF NOT EXISTS tradition_bearer_inquiry (
  id SERIAL PRIMARY KEY,
  lineage_key TEXT NOT NULL,
  name TEXT NOT NULL,
  relationship TEXT NOT NULL, -- the inquirer's own words on their standing to speak for this tradition
  contact TEXT NOT NULL, -- email or other way to reach back
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new', -- new | contacted | in_review | resolved
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS tradition_bearer_inquiry_status_idx
  ON tradition_bearer_inquiry (status, created_at DESC);
