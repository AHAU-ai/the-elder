-- altar_record: anonymous session-level signal log
-- No seeker text. No IP. No PII. Shapes and signals only.
CREATE TABLE IF NOT EXISTS altar_record (
  id               BIGSERIAL PRIMARY KEY,
  session_id       TEXT        NOT NULL,
  timestamp        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  nahual           TEXT        NOT NULL,
  trecena          SMALLINT    NOT NULL CHECK (trecena BETWEEN 1 AND 13),
  lineage          TEXT        NOT NULL,
  signal           TEXT        NOT NULL CHECK (signal IN ('landed', 'did_not_land')),
  corpus_version   TEXT,
  model_version    TEXT,
  contract_version TEXT,
  mode             TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS altar_record_lineage_idx  ON altar_record (lineage);
CREATE INDEX IF NOT EXISTS altar_record_signal_idx   ON altar_record (signal);
CREATE INDEX IF NOT EXISTS altar_record_created_idx  ON altar_record (created_at DESC);