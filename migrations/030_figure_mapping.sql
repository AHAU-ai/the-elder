-- migrations/030_figure_mapping.sql
--
-- Figure Continuity (docs/figure-continuity-spec.md v0.2, section 4): a
-- seeker-confirmed pairing of one person/situation in their own life with
-- one character/episode in the home myth of their confirmed figure. One
-- table, no change to any existing table. Nothing reads or writes it until
-- the feature flag (FC-C) is lit, which is a governance action.
--
-- Types match the live schema: elder_user.id is BIGINT, chain ids are UUID
-- (visit_record.chain_id; there is no chains table), the lineage column is
-- lineage_key. There is no myth_entry table -- the approved corpus is
-- corpus_passage (passage_id TEXT), so the optional corpus link points there.
--
-- chain_id deliberately has NO foreign key: visit_record rows are released
-- independently (releaseVisit/releaseChain/releaseAllVisits) and mappings
-- are deleted by explicit calls on every release path (spec G12, D9), not
-- by cascade. Account deletion still cascades through elder_user.
--
-- The partial unique index figure_mapping_one_offer is the database-level
-- backstop for "at most one outstanding offer per user and chain": the
-- ledger deletes the older offer and inserts the new one in one transaction,
-- and if two writers race, exactly one insert wins and the other fails
-- loudly instead of leaving two live offers.
--
-- Idempotent. Run against a Neon DEV branch first; production is a separate,
-- deliberate step before the flag is flipped. DDL under load should use
-- DATABASE_URL_UNPOOLED (see migrations/README.md). Run
-- `npm run check:schema-drift` afterward.

BEGIN;

CREATE TABLE IF NOT EXISTS figure_mapping (
  id                     BIGSERIAL   PRIMARY KEY,
  user_id                BIGINT      NOT NULL REFERENCES elder_user(id) ON DELETE CASCADE,
  chain_id               UUID        NOT NULL,
  lineage_key            TEXT        NOT NULL,
  myth_title             TEXT        NOT NULL DEFAULT '',
  figure_label           TEXT        NOT NULL CHECK (char_length(figure_label) BETWEEN 1 AND 120),
  subject_kind           TEXT        NOT NULL CHECK (subject_kind IN ('person', 'situation')),
  subject_label          TEXT        NOT NULL CHECK (char_length(subject_label) BETWEEN 1 AND 60),
  counterpart_label      TEXT        NOT NULL CHECK (char_length(counterpart_label) BETWEEN 1 AND 80),
  counterpart_passage_id TEXT        NULL REFERENCES corpus_passage(passage_id) ON DELETE SET NULL,
  counterpart_basis      TEXT        NOT NULL CHECK (counterpart_basis IN ('corpus', 'model_report')),
  status                 TEXT        NOT NULL CHECK (status IN ('offered', 'confirmed')),
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  confirmed_at           TIMESTAMPTZ NULL,
  CHECK ((status = 'confirmed') = (confirmed_at IS NOT NULL))
);

CREATE UNIQUE INDEX IF NOT EXISTS figure_mapping_uniq
  ON figure_mapping (user_id, chain_id, lower(subject_label), lower(counterpart_label));

CREATE UNIQUE INDEX IF NOT EXISTS figure_mapping_one_offer
  ON figure_mapping (user_id, chain_id) WHERE status = 'offered';

CREATE INDEX IF NOT EXISTS figure_mapping_user_chain
  ON figure_mapping (user_id, chain_id, status);

CREATE INDEX IF NOT EXISTS figure_mapping_offer_expiry
  ON figure_mapping (created_at) WHERE status = 'offered';

COMMIT;
