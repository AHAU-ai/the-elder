-- migrations/012_corpus_passage_voice_key.sql
-- corpus_passage was originally shaped for a single tradition (K'iche' /
-- ojer_tzij: nahuales, cruz_positions) and has no column to say which
-- voice a passage belongs to. Now that a second voice (mekubal) has real
-- rows, retrieval needs a way to filter by voice rather than pattern-
-- matching on `source`. Nullable + backfilled by source pattern, not
-- required at the DB level -- ingest.py must set it going forward.

BEGIN;

ALTER TABLE corpus_passage
  ADD COLUMN IF NOT EXISTS voice_key TEXT NULL;

UPDATE corpus_passage
  SET voice_key = 'mekubal'
  WHERE source ILIKE 'Zohar%' AND voice_key IS NULL;

UPDATE corpus_passage
  SET voice_key = 'ojer_tzij'
  WHERE source ILIKE '%Popol Wuj%' AND voice_key IS NULL;

CREATE INDEX IF NOT EXISTS corpus_passage_voice_key_idx ON corpus_passage (voice_key);

COMMIT;
