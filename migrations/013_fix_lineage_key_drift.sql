-- migrations/013_fix_lineage_key_drift.sql
-- Corrects a chain of bugs found 2026-08-18 while ingesting the second
-- Mekubal batch (Bereshit 2:6-2:10):
--
-- 1. corpus_passage already had a `lineage_key` column (default
--    'ojer_tzij', a leftover from when the table only served the K'iche'
--    voice) that migration 012 didn't know about -- it added a REDUNDANT
--    `voice_key` column instead of using the existing one.
-- 2. scripts-resilience/ingest.py's upsert() never set lineage_key, so
--    every row it has ever inserted (all 10 real Zohar rows) silently
--    took the wrong default: lineage_key='ojer_tzij' on Mekubal content.
-- 3. retrievable_passage is `SELECT *`, which Postgres freezes to the
--    column list at CREATE time -- it predates lineage_key AND voice_key,
--    so it exposed neither. lib/corpusRetrieval.ts's query against
--    retrievable_passage.voice_key has been failing (column doesn't
--    exist) and silently degrading to [] this whole time, masked by its
--    own fail-soft design. Retrieval has never actually returned a row.
--
-- Fix: backfill lineage_key correctly, drop the redundant voice_key
-- column, and recreate the view so it reflects the table's real shape.
-- Application code (lib/corpusRetrieval.ts, ingest.py) updated in the
-- same change to use lineage_key, matching this table's pre-existing
-- convention rather than introducing a second name for the same concept.

BEGIN;

UPDATE corpus_passage
  SET lineage_key = 'mekubal'
  WHERE source ILIKE 'Zohar%';

ALTER TABLE corpus_passage DROP COLUMN IF EXISTS voice_key;

DROP VIEW IF EXISTS retrievable_passage;
CREATE VIEW retrievable_passage AS
    SELECT * FROM corpus_passage
    WHERE review_status = 'approved'
      AND ceremonial_sensitivity = 'open'
      AND body_normalized = TRUE
      AND embedding IS NOT NULL;

COMMIT;
