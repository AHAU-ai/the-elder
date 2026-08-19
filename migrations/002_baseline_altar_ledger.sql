-- migrations/002_baseline_altar_ledger.sql
--
-- RETROACTIVE BASELINE — see migrations/README.md for why this file exists
-- despite documenting tables that were already live before today. This
-- ports scripts/migrate-phase1.mjs ("Phase 1 Migration — The Elder
-- Server-Side Ledger") plus the user_id column later added by
-- scripts/migrate-phase3-feedback-loop.mjs into the single numbered
-- migration history, in FINAL shape (not a blow-by-blow replay), verified
-- against the live database on 2026-08-18.
--
-- KNOWN DRIFT NOTE: scripts-resilience/schema.sql also defines a table
-- named `altar_record`, with a completely different, incompatible shape
-- (UUID session_id primary key; voice/markers_fired/retrieved_passages
-- columns instead of nahual/trecena/lineage/signal). That definition was
-- checked against the live DB and does NOT match what's actually
-- deployed — this file's shape is the one confirmed live. The
-- scripts-resilience/schema.sql block is stale/aspirational and should
-- not be run against this database; it needs its own follow-up pass to
-- reconcile or remove, out of scope here since it may be feeding other
-- resilience-layer views (corpus_coverage) that need separate review.
--
-- Idempotent: every statement is IF NOT EXISTS-guarded, safe to run
-- against a database that already has these tables (the common case).
--
-- Ordering note: altar_record.user_id references elder_user(id), so this
-- file must run after 001_baseline_myth_accounts.sql on a fresh database.

CREATE TABLE IF NOT EXISTS altar_record (
  id               BIGSERIAL   PRIMARY KEY,
  session_id       TEXT        NOT NULL,
  timestamp        TIMESTAMPTZ NOT NULL,
  nahual           TEXT        NOT NULL,
  trecena          INTEGER     NOT NULL CHECK (trecena BETWEEN 1 AND 13),
  lineage          TEXT        NOT NULL,
  signal           TEXT        NOT NULL,
  corpus_version   TEXT,
  model_version    TEXT,
  contract_version TEXT,
  mode             TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- added by scripts/migrate-phase3-feedback-loop.mjs — nullable, no FK
  -- backfill needed for pre-existing anonymous rows
  user_id          BIGINT      REFERENCES elder_user(id)
);
CREATE INDEX IF NOT EXISTS altar_record_session_idx ON altar_record (session_id);
CREATE INDEX IF NOT EXISTS altar_record_user_lineage_idx ON altar_record (user_id, lineage, created_at DESC);

CREATE TABLE IF NOT EXISTS altar_ledger (
  id               BIGSERIAL   PRIMARY KEY,
  reading_id       TEXT        NOT NULL,
  session_id       TEXT        NOT NULL,
  voice_id         TEXT        NOT NULL,
  lineage_key      TEXT        NOT NULL,
  reading_text     TEXT        NOT NULL,
  signals          JSONB       NOT NULL DEFAULT '[]',
  provenance       JSONB       NOT NULL DEFAULT '{}',
  retrieval_log    JSONB       NOT NULL DEFAULT '[]',
  seal_state       TEXT        NOT NULL DEFAULT 'open',
  corrects_id      BIGINT      REFERENCES altar_ledger(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS altar_ledger_reading_idx ON altar_ledger (reading_id);
CREATE INDEX IF NOT EXISTS altar_ledger_session_idx ON altar_ledger (session_id);
CREATE INDEX IF NOT EXISTS altar_ledger_created_idx ON altar_ledger (created_at DESC);

CREATE TABLE IF NOT EXISTS share_tokens (
  id           BIGSERIAL   PRIMARY KEY,
  token        TEXT        NOT NULL UNIQUE,
  reading_id   TEXT        NOT NULL,
  ledger_id    BIGINT      NOT NULL REFERENCES altar_ledger(id),
  expires_at   TIMESTAMPTZ NOT NULL,
  used_count   INTEGER     NOT NULL DEFAULT 0,
  max_uses     INTEGER     NOT NULL DEFAULT 50,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS share_tokens_token_idx ON share_tokens (token);
CREATE INDEX IF NOT EXISTS share_tokens_expires_idx ON share_tokens (expires_at);
