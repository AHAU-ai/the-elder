-- migrations/015_add_bhikkhu_lineage_key.sql
-- lib/lineageToVoiceKey.ts has mapped taoist:'sage_of_the_way' since it was
-- introduced, and the valid_lineage_key check constraint was updated for it
-- at the time -- but 'bhikkhu' (buddhist voice) was never added, even
-- though the app-level mapping already names it. Discovered 2026-08-18
-- ingesting the first Buddhist corpus batch: ingest.py's upsert failed with
-- CheckViolation on valid_lineage_key before a single row landed.
--
-- Fix: add 'bhikkhu' to the allowed set. No backfill needed -- no
-- corpus_passage rows existed for this voice before this migration.

BEGIN;

ALTER TABLE corpus_passage DROP CONSTRAINT valid_lineage_key;

ALTER TABLE corpus_passage ADD CONSTRAINT valid_lineage_key
  CHECK (lineage_key = ANY (ARRAY[
    'ojer_tzij', 'keeper_of_the_fire', 'volva', 'pythia', 'hem_netjer',
    'sage_of_the_way', 'vedic', 'babalawo', 'sufi', 'stoa', 'mekubal',
    'elder_of_country', 'bhikkhu'
  ]));

COMMIT;
