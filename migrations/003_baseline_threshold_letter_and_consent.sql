-- migrations/003_baseline_threshold_letter_and_consent.sql
--
-- RETROACTIVE BASELINE — see migrations/README.md. Ports two previously
-- untracked scripts into the numbered migration history, verified against
-- the live database on 2026-08-18:
--   - scripts/migrate-phase3-threshold-letters.mjs (threshold_letter, base
--     shape — marker/chain_id columns were already correctly tracked as
--     migrations/010_threshold_letter_marker.sql, not duplicated here)
--   - scripts/migrate-consent-ledger.mjs (consent_grant, consent_withdrawal
--     — Lineage Integrity of Voice §5.2 authorization/revocation ledger)
--
-- These two are otherwise unrelated tables bundled into one file only
-- because neither had its own tracked migration number; grouping them here
-- rather than inventing an artificial ordering between them.
--
-- Idempotent: every statement is IF NOT EXISTS-guarded. Must run after
-- 001_baseline_myth_accounts.sql (threshold_letter.user_id references
-- elder_user).

CREATE TABLE IF NOT EXISTS threshold_letter (
  id                    BIGSERIAL   PRIMARY KEY,
  user_id               BIGINT      NOT NULL REFERENCES elder_user(id) ON DELETE CASCADE,
  lineage_key           TEXT        NOT NULL,
  volatilization_phrase TEXT        NOT NULL DEFAULT '',
  return_phrase         TEXT        NOT NULL DEFAULT '',
  return_gift           TEXT        NOT NULL,
  threshold_image       TEXT        NOT NULL DEFAULT '',
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS threshold_letter_user_idx ON threshold_letter (user_id);
CREATE INDEX IF NOT EXISTS threshold_letter_created_idx ON threshold_letter (created_at DESC);

-- ── consent_grant ────────────────────────────────────────────────────────
-- One row per authorization grant per tradition/voice (§5.2: tradition,
-- holder, scope, version, date, status).
CREATE TABLE IF NOT EXISTS consent_grant (
  id                bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  tradition         text NOT NULL,
  voice_key         text NOT NULL,
  holder_name       text NOT NULL,
  holder_role       text NOT NULL,
  scope             text NOT NULL,
  scope_detail      jsonb NOT NULL DEFAULT '{}',
  version           text NOT NULL,
  granted_at        timestamptz NOT NULL,
  granted_by        text NOT NULL,
  status            text NOT NULL DEFAULT 'active',
  superseded_by     bigint REFERENCES consent_grant(id),
  notes             text,
  created_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS consent_grant_voice_key_idx ON consent_grant(voice_key);
CREATE INDEX IF NOT EXISTS consent_grant_status_idx ON consent_grant(status);

-- ── consent_withdrawal ───────────────────────────────────────────────────
-- One row per revocation event; a withdrawal marks the grant and all
-- downstream content for removal (§5.2 right of withdrawal).
CREATE TABLE IF NOT EXISTS consent_withdrawal (
  id                bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  grant_id          bigint NOT NULL REFERENCES consent_grant(id),
  withdrawn_by      text NOT NULL,
  withdrawn_at      timestamptz NOT NULL,
  reason            text NOT NULL,
  scope_affected    jsonb NOT NULL DEFAULT '{}',
  propagation_log   jsonb NOT NULL DEFAULT '[]',
  created_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS consent_withdrawal_grant_id_idx ON consent_withdrawal(grant_id);
