-- migrations/026_lineage_archetype_stage.sql
--
-- Moves myth_archetype's identity key from (user_id, lower(archetype_name))
-- to (user_id, lineage_key) -- one archetype per lineage, not per name.
-- Under the old key, two different lineages naming the same archetype
-- would have silently merged into one row (a cross-lineage leak the
-- Lineage Integrity of Voice principle forbids), and nothing stopped a
-- single lineage from accumulating several differently-named rows across
-- separate readings. Going forward: first reading in a lineage names the
-- archetype (system-prompt-builder.ts's catalog-constrained naming
-- clause), every reading after restates it exactly and only deepens the
-- existing row (lib/mythLedger.ts enforces this as a backstop even if a
-- reading somehow drifts).
--
-- Also adds a simple v1 depth stage (surface -> confronted -> integrated),
-- auto-advanced purely on reading_count (lib/mythLedger.ts,
-- computeArchetypeStage) -- unlike marker_trajectory's propose/ratify
-- shape (migrations 020/021), this v1 has no seeker-confirmation step.
-- Forward/hold only, same as markers, so a seeker never regresses.
--
-- Idempotent. Run against a Neon DEV branch first, exactly like every
-- other migration here.

BEGIN;

-- Step 1: fold any pre-existing duplicate (user_id, lineage_key) rows into
-- one survivor before the new unique index below can be created. Under the
-- old (user_id, archetype_name) key nothing prevented a single lineage from
-- having accumulated more than one row across separate readings that each
-- named a different archetype in that lineage -- this can only ever be a
-- real state on rows written before this migration.
WITH ranked AS (
  SELECT id, user_id, lineage_key, summary, people_circumstances, reading_count,
         row_number() OVER (PARTITION BY user_id, lineage_key ORDER BY updated_at DESC, id DESC) AS rn
  FROM myth_archetype
),
survivors AS (
  SELECT id, user_id, lineage_key FROM ranked WHERE rn = 1
),
folded AS (
  SELECT r.user_id, r.lineage_key,
         string_agg(r.summary, E'\n\n' ORDER BY r.id) FILTER (WHERE length(r.summary) > 0) AS summary_extra,
         string_agg(r.people_circumstances, E'\n\n' ORDER BY r.id) FILTER (WHERE length(r.people_circumstances) > 0) AS people_extra,
         sum(r.reading_count) AS total_count
  FROM ranked r
  WHERE r.rn > 1
  GROUP BY r.user_id, r.lineage_key
)
UPDATE myth_archetype m
SET
  summary = CASE WHEN f.summary_extra IS NULL THEN m.summary
                 WHEN length(m.summary) = 0 THEN f.summary_extra
                 ELSE m.summary || E'\n\n' || f.summary_extra END,
  people_circumstances = CASE WHEN f.people_extra IS NULL THEN m.people_circumstances
                 WHEN length(m.people_circumstances) = 0 THEN f.people_extra
                 ELSE m.people_circumstances || E'\n\n' || f.people_extra END,
  reading_count = m.reading_count + coalesce(f.total_count, 0),
  updated_at = now()
FROM survivors s
JOIN folded f ON f.user_id = s.user_id AND f.lineage_key = s.lineage_key
WHERE m.id = s.id;

-- Step 2: the folded-in rows' content is now safely merged into the
-- survivor above -- delete them so the unique index below can be created.
WITH ranked AS (
  SELECT id, row_number() OVER (PARTITION BY user_id, lineage_key ORDER BY updated_at DESC, id DESC) AS rn
  FROM myth_archetype
)
DELETE FROM myth_archetype WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

-- Step 3: swap the unique key.
DROP INDEX IF EXISTS myth_archetype_user_name_idx;
CREATE UNIQUE INDEX IF NOT EXISTS myth_archetype_user_lineage_idx
  ON myth_archetype (user_id, lineage_key);

-- Step 4: depth stage.
ALTER TABLE myth_archetype
  ADD COLUMN IF NOT EXISTS depth_stage TEXT NOT NULL DEFAULT 'surface'
    CHECK (depth_stage IN ('surface', 'confronted', 'integrated')),
  ADD COLUMN IF NOT EXISTS depth_stage_updated_at TIMESTAMPTZ;

COMMIT;
