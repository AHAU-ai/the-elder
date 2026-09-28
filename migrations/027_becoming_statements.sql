-- migrations/027_becoming_statements.sql
--
-- Becoming statements: the seeker's own completed sentence from the fifth
-- Threshold Letter beat (app/components/Becoming.tsx / lib/mythopoetics
-- /becoming.ts), persisted as a first-class piece of confirmed material —
-- parallel to, but never merged with, marker_trajectory's 'integrated'
-- markers (migrations 020/021).
--
-- WHY A SEPARATE TABLE, NOT A ROW IN marker_trajectory:
-- A marker_trajectory row represents something The Elder noticed *across
-- sittings* and the seeker confirmed through a surface -> confronted ->
-- integrated arc (see lib/returning/markers.ts, confirm-marker,
-- confirm-depth-stage). A becoming_statement is different in kind: it is
-- authored whole, in the seeker's own words, in a single sitting, with no
-- depth-stage arc at all -- there is no "surface" or "confronted" state
-- for a sentence the seeker wrote themselves. Forcing it into
-- marker_trajectory's shape (inventing a fake depth_stage='integrated' at
-- insert time) would misrepresent its provenance to every downstream
-- reader of that table, including the depth-stage transition history in
-- migration 020/021. A separate table keeps the honest distinction:
-- marker_trajectory = noticed, confirmed, deepened over time.
-- becoming_statement = spoken, whole, once.
--
-- Both are equally eligible material for the Core Myth Statement (see
-- migration 022 and this migration's ALTER below) -- eligibility doesn't
-- care which table confirmed material came from, only that the seeker
-- confirmed it themselves.
--
-- Append-only. No depth stage, no supersession -- a becoming_statement is
-- never edited or replaced; a seeker who wants to say something different
-- writes a new one on a later reading. (Contrast core_myth_statement,
-- which IS versioned/superseded -- that's the seeker's synthesis across
-- many sittings; this is one sentence from one sitting.)
--
-- RATE LIMITING lives at the API layer (app/api/becoming-statement/
-- route.ts, via lib/rate-limit.ts -- the same DB-backed limiter already
-- guarding /api/divine), not here: a CHECK constraint can bound a single
-- row's shape but can't bound how many rows arrive per user per day.
-- Red-team finding (2026-09-27): without that limit, an authenticated
-- client can call this endpoint directly, with no reading ever having
-- happened, and manufacture Core Myth Statement eligibility in a handful
-- of scripted requests -- exactly the kind of gaming marker_trajectory's
-- real surface->confronted->integrated arc exists to make hard. See the
-- route file for the actual limit.
--
-- Idempotent. Run against a Neon DEV branch first.

BEGIN;

CREATE TABLE IF NOT EXISTS becoming_statement (
  id                BIGSERIAL   PRIMARY KEY,
  user_id           BIGINT      NOT NULL REFERENCES elder_user(id) ON DELETE CASCADE,
  -- VoiceKey (src/resilience/flags.ts) at the time of writing -- stored as
  -- plain text, not a foreign key, same posture as marker_trajectory's own
  -- marker_type column: voices are a code-level enum, not a DB table.
  voice_key         TEXT        NOT NULL CHECK (char_length(voice_key) <= 64),
  -- The named oracle archetype for the reading this came from, if any
  -- (OracleResponse's archetypeName) -- attribution only, never asserted
  -- as a claim the app makes; nullable because not every reading names one.
  -- Length-capped (red-team pass, 2026-09-27): this is client-supplied
  -- text with no natural bound otherwise.
  archetype_name    TEXT        CHECK (archetype_name IS NULL OR char_length(archetype_name) <= 120),
  -- suggestMarker()'s classification of the reading's own returnGift text
  -- (lib/mythopoetics/cardConfig.ts) -- same five values as
  -- marker_trajectory.marker_type, kept as plain text for the same reason
  -- (voices/markers are a code-level enum, not a DB table) and constrained
  -- the same way marker_trajectory.marker_type already is (migrations
  -- 009, 010, 020) -- this table originally omitted that CHECK; added on
  -- red-team review rather than left inconsistent with every prior table
  -- that stores this same enum.
  marker            TEXT        NOT NULL CHECK (marker IN ('wound', 'figure', 'threshold', 'exile', 'pattern')),
  -- The fixed stem the seeker completed (becoming.ts's completionStem at
  -- time of writing) and the seeker's own completed clause, stored
  -- separately so a future UI can render them with different emphasis
  -- without re-parsing a combined sentence.
  completion_stem   TEXT        NOT NULL CHECK (char_length(completion_stem) <= 80),
  completion_text   TEXT        NOT NULL CHECK (char_length(completion_text) BETWEEN 3 AND 140),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_becoming_statement_user
  ON becoming_statement (user_id, created_at ASC);

-- Core Myth Statement material can now cite becoming_statement rows
-- alongside marker_trajectory rows. Kept as its own column (not merged
-- into source_marker_ids) so the two id spaces never collide -- an id in
-- source_marker_ids always means marker_trajectory.id, an id in
-- source_becoming_ids always means becoming_statement.id, and no code
-- path has to guess which table an id belongs to.
ALTER TABLE core_myth_statement
  ADD COLUMN IF NOT EXISTS source_becoming_ids JSONB NOT NULL DEFAULT '[]';

COMMIT;
