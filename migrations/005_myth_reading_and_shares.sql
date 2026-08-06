-- migrations/005_myth_reading_and_shares.sql
-- The Elder — Journal depth features: per-reading log, journal synthesis
-- cache, and the closed-loop share/response tables.
--
-- myth_reading is an append-only companion to myth_archetype (which is a
-- merged/aggregate record per archetype, not a per-reading log). Nothing
-- here replaces myth_archetype; this is additive substrate for the Mythic
-- Journal's narrative synthesis, archetype-arc counts, and within-lineage
-- recall.
--
-- share_card/share_response are a narrow, deliberate exception to
-- ShareableCard.tsx's "nothing is sent anywhere or stored" design: only the
-- one quoted line + marker + voice + optional dedication is persisted,
-- never full reading text, and only when the sharer is signed in.
--
-- Idempotent where practical. Run against a Neon DEV branch first.

BEGIN;

CREATE EXTENSION IF NOT EXISTS "pgcrypto"; -- gen_random_uuid()

-- ── myth_reading ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS myth_reading (
  id                   SERIAL PRIMARY KEY,
  user_id              INTEGER NOT NULL,
  lineage_key          TEXT NOT NULL,
  archetype_name       TEXT,
  depth_summary        TEXT NOT NULL,
  people_circumstances TEXT NOT NULL DEFAULT '',
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS myth_reading_user_created_idx
  ON myth_reading (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS myth_reading_user_lineage_idx
  ON myth_reading (user_id, lineage_key, created_at DESC);

-- ── journal_synthesis ───────────────────────────────────────────────────
-- One cached synthesis passage per user. Regenerated only once at least
-- three new myth_reading rows exist since reading_count_at_synthesis.
CREATE TABLE IF NOT EXISTS journal_synthesis (
  id                          SERIAL PRIMARY KEY,
  user_id                     INTEGER NOT NULL UNIQUE,
  synthesis_text              TEXT NOT NULL,
  reading_count_at_synthesis  INTEGER NOT NULL,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── share_card ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS share_card (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id  INTEGER NOT NULL,
  line           TEXT NOT NULL,
  marker         TEXT NOT NULL,
  voice_key      TEXT NOT NULL,
  dedicated_to   TEXT NOT NULL DEFAULT '',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS share_card_owner_idx
  ON share_card (owner_user_id, created_at DESC);

-- ── share_response ───────────────────────────────────────────────────────
-- A wordless glyph left by a viewer of a shared card. No account, no text.
CREATE TABLE IF NOT EXISTS share_response (
  id             SERIAL PRIMARY KEY,
  share_card_id  UUID NOT NULL REFERENCES share_card(id) ON DELETE CASCADE,
  marker         TEXT NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS share_response_card_idx
  ON share_response (share_card_id);

COMMIT;
