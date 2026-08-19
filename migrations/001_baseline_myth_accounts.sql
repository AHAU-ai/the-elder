-- migrations/001_baseline_myth_accounts.sql
--
-- RETROACTIVE BASELINE — see migrations/README.md. Ports
-- scripts/migrate-phase2-myth-accounts.mjs ("Phase 2 Migration — Myth
-- Memory Accounts") into the numbered migration history, verified against
-- the live database on 2026-08-18. This is the identity spine every other
-- signed-in-user table (altar_record.user_id, threshold_letter,
-- myth_reading, visit_record, marker_trajectory, journal_synthesis,
-- consent tables that reference it) hangs off of — must run first.
--
-- Idempotent: every statement is IF NOT EXISTS-guarded.

CREATE TABLE IF NOT EXISTS elder_user (
  id         BIGSERIAL   PRIMARY KEY,
  email      TEXT        NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS elder_login_token (
  id         BIGSERIAL   PRIMARY KEY,
  token      TEXT        NOT NULL UNIQUE,
  email      TEXT        NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at    TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS elder_login_token_token_idx ON elder_login_token (token);

CREATE TABLE IF NOT EXISTS myth_archetype (
  id                   BIGSERIAL   PRIMARY KEY,
  user_id              BIGINT      NOT NULL REFERENCES elder_user(id) ON DELETE CASCADE,
  lineage_key          TEXT        NOT NULL,
  archetype_name       TEXT        NOT NULL,
  summary              TEXT        NOT NULL DEFAULT '',
  people_circumstances TEXT        NOT NULL DEFAULT '',
  reading_count        INTEGER     NOT NULL DEFAULT 1,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS myth_archetype_user_idx ON myth_archetype (user_id);
CREATE INDEX IF NOT EXISTS myth_archetype_updated_idx ON myth_archetype (updated_at);
CREATE UNIQUE INDEX IF NOT EXISTS myth_archetype_user_name_idx
  ON myth_archetype (user_id, lower(archetype_name));
