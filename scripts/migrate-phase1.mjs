#!/usr/bin/env node
import { neon } from "@neondatabase/serverless";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("ERROR: DATABASE_URL environment variable is required.");
  console.error("Usage: DATABASE_URL=<url> node scripts/migrate-phase1.mjs");
  process.exit(1);
}

const sql = neon(DATABASE_URL);

async function run() {
  console.log("Phase 1 Migration — The Elder Server-Side Ledger");
  console.log("=".repeat(52));

  console.log("\n[1/4] Ensuring altar_record exists...");
  await sql`
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
      created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
    )`;
  await sql`CREATE INDEX IF NOT EXISTS altar_record_session_idx ON altar_record (session_id)`;
  console.log("  ok altar_record");

  console.log("\n[2/4] Creating altar_ledger...");
  await sql`
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
    )`;
  await sql`CREATE INDEX IF NOT EXISTS altar_ledger_reading_idx ON altar_ledger (reading_id)`;
  await sql`CREATE INDEX IF NOT EXISTS altar_ledger_session_idx ON altar_ledger (session_id)`;
  await sql`CREATE INDEX IF NOT EXISTS altar_ledger_created_idx ON altar_ledger (created_at DESC)`;
  console.log("  ok altar_ledger");

  console.log("\n[3/4] Creating share_tokens...");
  await sql`
    CREATE TABLE IF NOT EXISTS share_tokens (
      id           BIGSERIAL   PRIMARY KEY,
      token        TEXT        NOT NULL UNIQUE,
      reading_id   TEXT        NOT NULL,
      ledger_id    BIGINT      NOT NULL REFERENCES altar_ledger(id),
      expires_at   TIMESTAMPTZ NOT NULL,
      used_count   INTEGER     NOT NULL DEFAULT 0,
      max_uses     INTEGER     NOT NULL DEFAULT 50,
      created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
    )`;
  await sql`CREATE INDEX IF NOT EXISTS share_tokens_token_idx ON share_tokens (token)`;
  await sql`CREATE INDEX IF NOT EXISTS share_tokens_expires_idx ON share_tokens (expires_at)`;
  console.log("  ok share_tokens");

  console.log("\n[4/4] Verifying...");
  const tables = await sql`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name IN ('altar_record', 'altar_ledger', 'share_tokens')
    ORDER BY table_name`;
  const names = tables.map(r => r.table_name);
  const missing = ["altar_ledger","altar_record","share_tokens"].filter(t => !names.includes(t));
  if (missing.length) { console.error("  MISSING:", missing.join(", ")); process.exit(1); }

  for (const name of names) {
    const cols = await sql`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema='public' AND table_name=${name}
      ORDER BY ordinal_position`;
    console.log(`  ok ${name}: ${cols.map(c => c.column_name).join(", ")}`);
  }

  console.log("\n" + "=".repeat(52));
  console.log("Migration complete. Run with DATABASE_URL=<url> node scripts/migrate-phase1.mjs");
}

run().catch(err => { console.error("Migration failed:", err.message); process.exit(1); });
