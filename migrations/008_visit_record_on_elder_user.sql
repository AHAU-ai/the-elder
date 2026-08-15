-- migrations/008_visit_record_on_elder_user.sql
-- The Elder — Memory Spine PR A: one identity, full words, a way to release.
--
-- GOVERNANCE NOTE: the 004 returning-visitor tables carried their own identity
-- system (user_record, cookie-backed UUID) parallel to elder_user's signed
-- sessions. No UI ever wrote to them. This migration RENAMES them to
-- *_legacy_004 (preserving any rows for inspection — drop later, deliberately,
-- in their own migration) and recreates visit_record keyed to elder_user, the
-- single identity spine. altar_record remains anonymous and untouched, as ever.
--
-- The new visit_record stores the reading's FULL TEXT (elder_response) — the
-- first place the Elder's actual words persist. It is written only for
-- signed-in seekers, under the disclosure shipped with this phase, and is
-- releasable row-by-row, chain-by-chain, or wholly (see /api/user/history and
-- /api/journal DELETE handlers).
--
-- Idempotent: the rename is guarded so a re-run never renames the NEW table.
-- Run against a Neon DEV branch first.

BEGIN;

CREATE EXTENSION IF NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS "pgcrypto"; -- gen_random_uuid()

-- ── Legacy preservation (guarded, one-shot) ─────────────────────────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'visit_record')
     AND NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'visit_record_legacy_004')
     AND EXISTS (
       SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'visit_record'
         AND column_name = 'user_id' AND data_type = 'uuid'
     )
  THEN
    ALTER TABLE visit_record RENAME TO visit_record_legacy_004;
    ALTER INDEX IF EXISTS uq_visit_chain_depth RENAME TO uq_visit_chain_depth_legacy_004;
    ALTER INDEX IF EXISTS idx_visit_user_chain RENAME TO idx_visit_user_chain_legacy_004;
    ALTER INDEX IF EXISTS idx_visit_user_recent RENAME TO idx_visit_user_recent_legacy_004;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'user_record')
     AND NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'user_record_legacy_004')
  THEN
    ALTER TABLE user_record RENAME TO user_record_legacy_004;
  END IF;
END $$;

-- ── visit_record, rebuilt on the spine ──────────────────────────────────────
-- Mirrors myth_archetype's user_id shape exactly: BIGINT -> elder_user(id),
-- ON DELETE CASCADE. lineage_key is new: /api/divine is multi-lineage where
-- the retired invoke route was ojer_tzij-only, and a chain deepens within ONE
-- lineage's field (Lineage Integrity of Voice — enforced in PR B).
CREATE TABLE IF NOT EXISTS visit_record (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           BIGINT NOT NULL REFERENCES elder_user(id) ON DELETE CASCADE,
  chain_id          UUID NOT NULL,
  visit_mode        TEXT NOT NULL CHECK (visit_mode IN ('explore', 'deepen')),
  lineage_key       TEXT NOT NULL DEFAULT 'default',
  myth_title        CITEXT,
  archetype         CITEXT,
  depth             INTEGER NOT NULL DEFAULT 1,
  offering          TEXT,
  elder_response    TEXT NOT NULL,
  markers           JSONB,            -- proposed (model-extracted)
  markers_confirmed JSONB,            -- co-authored subset (§1.5) — only these feed trajectory
  door_back_offered BOOLEAN NOT NULL DEFAULT FALSE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Concurrency guard (Shalom Round 1, carried forward): one response per (chain, depth).
CREATE UNIQUE INDEX IF NOT EXISTS uq_visit_chain_depth
  ON visit_record (chain_id, depth);

-- Chain traversal.
CREATE INDEX IF NOT EXISTS idx_visit_user_chain
  ON visit_record (user_id, chain_id, depth, created_at);

-- Most-recent-chain lookup.
CREATE INDEX IF NOT EXISTS idx_visit_user_recent
  ON visit_record (user_id, created_at DESC);

COMMIT;
