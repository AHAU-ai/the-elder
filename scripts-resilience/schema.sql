-- schema.sql — THE ELDER resilience data layer (Postgres + pgvector)
-- One auditable database for corpus, review state, altar record, and the observatory.
-- Apply with: psql "$DATABASE_URL" -f scripts/schema.sql

CREATE EXTENSION IF NOT EXISTS vector;

-- ---------------------------------------------------------------------------
-- CORPUS + BUILD GATE (v1 Section VI + v3 normalization gate)
-- Only review_status = 'approved' passages are ever embedded into the index.
-- The build gate is enforced in the ingestion script AND re-asserted by a view.
-- ---------------------------------------------------------------------------
CREATE TYPE review_status AS ENUM ('draft', 'in_review', 'approved', 'restricted', 'retired');
CREATE TYPE sensitivity AS ENUM ('open', 'restricted');

CREATE TABLE corpus_passage (
    passage_id        TEXT PRIMARY KEY,            -- e.g. 'pw-iv-012'
    source            TEXT NOT NULL,               -- 'Stanzione, Popol Wuj (Ximénez 1701-1703)'
    section           TEXT NOT NULL,               -- 'Part IV - The Dawn'
    body              TEXT NOT NULL,               -- normalized text (NFC + saltillo canonical)
    body_normalized   BOOLEAN NOT NULL DEFAULT FALSE, -- proof the normalization gate ran
    themes            TEXT[] NOT NULL DEFAULT '{}',
    nahuales          TEXT[] NOT NULL DEFAULT '{}',
    cruz_positions    TEXT[] NOT NULL DEFAULT '{}',
    signal_affinity   TEXT[] NOT NULL DEFAULT '{}', -- subset of Wound/Figure/Threshold/Exile/Pattern
    register          TEXT,                         -- 'invocation' | 'narrative' | 'exposition'
    ceremonial_sensitivity sensitivity NOT NULL DEFAULT 'open',
    review_status     review_status NOT NULL DEFAULT 'draft',
    reviewed_by       TEXT,
    review_date       DATE,
    embedding         vector(1024),                 -- set ONLY for approved+open passages
                                                       -- dims match Voyage AI voyage-multilingual-2
                                                       -- (see scripts-resilience/ingest.py). This value
                                                       -- was corrected 2026-08-17 to match the actually
                                                       -- deployed column -- the file previously said 1536
                                                       -- and had drifted from the live DB; see
                                                       -- migrations/011_corpus_passage_embedding_dims_note.sql
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- The build gate as a queryable surface: the ONLY rows retrieval may ever touch.
CREATE VIEW retrievable_passage AS
    SELECT * FROM corpus_passage
    WHERE review_status = 'approved'
      AND ceremonial_sensitivity = 'open'
      AND body_normalized = TRUE
      AND embedding IS NOT NULL;

-- Defensive constraint: a restricted passage must never carry an embedding.
ALTER TABLE corpus_passage ADD CONSTRAINT no_embedding_when_restricted
    CHECK (NOT (ceremonial_sensitivity = 'restricted' AND embedding IS NOT NULL));

CREATE INDEX corpus_embedding_idx ON corpus_passage
    USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- ---------------------------------------------------------------------------
-- ALTAR RECORD + PROVENANCE TRIPLE (v3 Reading Provenance Triple)
-- Adult-individual mode only. NEVER written in classroom mode (enforced in app layer).
-- Stores SIGNALS and PROVENANCE, never raw seeker text.
-- ---------------------------------------------------------------------------
CREATE TABLE altar_record (
    session_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    voice             TEXT NOT NULL,
    corpus_version    TEXT NOT NULL,
    model_version     TEXT NOT NULL,
    contract_version  TEXT NOT NULL,
    markers_fired     JSONB NOT NULL,               -- {wound:bool, figure:bool, ...}
    retrieved_passages TEXT[] NOT NULL DEFAULT '{}', -- passage_ids, feeds coverage report
    ended_in_silence  BOOLEAN NOT NULL DEFAULT FALSE,
    silence_class     TEXT,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- CORPUS COVERAGE REPORT (v3 the canon-within-the-canon)
-- Surfaces passages that dominate readings AND passages never retrieved.
-- Both are flagged for the lineage review loop's standing agenda.
-- ---------------------------------------------------------------------------
CREATE VIEW corpus_coverage AS
SELECT
    p.passage_id,
    p.section,
    COALESCE(c.retrieval_count, 0) AS retrieval_count
FROM corpus_passage p
LEFT JOIN (
    SELECT unnest(retrieved_passages) AS passage_id, COUNT(*) AS retrieval_count
    FROM altar_record
    GROUP BY 1
) c ON c.passage_id = p.passage_id
WHERE p.review_status = 'approved'
ORDER BY retrieval_count DESC;

-- ---------------------------------------------------------------------------
-- ANOMALY OBSERVATORY (v3 Discovery Layer)
-- Shapes and signals only. Adult mode only.
-- ---------------------------------------------------------------------------
CREATE TABLE anomaly_record (
    id            BIGSERIAL PRIMARY KEY,
    kind          TEXT NOT NULL,         -- silence | near_miss | jailbreak_shape | out_of_distribution
    failure_class TEXT,
    voice         TEXT,
    length_bucket TEXT,
    markers       JSONB,
    jailbreak_signals TEXT[] DEFAULT '{}',
    note          TEXT,                  -- bounded, no raw seeker text
    source        TEXT,                  -- which module/route logged this, e.g. 'divine_route'.
                                           -- Added 2026-08-18 -- app/api/log/route.ts had inserted
                                           -- this column since it was written; it didn't exist in
                                           -- the deployed DB or here, so every anomaly write was
                                           -- silently failing. See migrations/014.
    at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX anomaly_kind_at_idx ON anomaly_record (kind, at DESC);
