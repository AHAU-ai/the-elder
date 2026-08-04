-- migrations/004_returning_visitor.sql
-- The Elder — Returning Visitor foundation (Spec v2, 2026-06-28)
--
-- GOVERNANCE NOTE: altar_record is, by documented invariant (lib/altarRecord.ts),
-- ANONYMOUS — "session ID, never tied to a person." This migration does NOT touch
-- altar_record. All persistent-identity, consented returning-visitor data lives in
-- its own tables (user_record, visit_record), keeping the anonymous probe-detection
-- telemetry and the consented relationship record cleanly separate.
--
-- Idempotent where practical. Run against a Neon DEV branch first.
-- (Renamed 003 -> 004 because 003 is taken in this repo.)

BEGIN;

CREATE EXTENSION IF NOT EXISTS citext;

-- ── user_record ────────────────────────────────────────────────────────────
-- Persistent, consented visitor identity. Cookie-backed UUID.
CREATE TABLE IF NOT EXISTS user_record (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_visit_at       TIMESTAMPTZ,
  visit_count         INTEGER NOT NULL DEFAULT 0,
  welfare_block_count INTEGER NOT NULL DEFAULT 0   -- content-free safety counter (Spec v2 R8)
);

-- ── visit_record ────────────────────────────────────────────────────────────
-- One row per Elder encounter in the returning-visitor flow.
-- Distinct from altar_record (anonymous telemetry). This table is intentionally
-- person-linked, under an active consent grant.
CREATE TABLE IF NOT EXISTS visit_record (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES user_record(id) ON DELETE CASCADE,
  chain_id          UUID NOT NULL,
  visit_mode        TEXT NOT NULL CHECK (visit_mode IN ('explore', 'deepen')),
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

-- Concurrency guard (Shalom Round 1): one response per (chain, depth).
CREATE UNIQUE INDEX IF NOT EXISTS uq_visit_chain_depth
  ON visit_record (chain_id, depth);

-- Chain traversal.
CREATE INDEX IF NOT EXISTS idx_visit_user_chain
  ON visit_record (user_id, chain_id, depth, created_at);

-- Most-recent-chain lookup.
CREATE INDEX IF NOT EXISTS idx_visit_user_recent
  ON visit_record (user_id, created_at DESC);

COMMIT;
