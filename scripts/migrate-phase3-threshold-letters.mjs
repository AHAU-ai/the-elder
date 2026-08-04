#!/usr/bin/env node
import { neon } from "@neondatabase/serverless";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("ERROR: DATABASE_URL environment variable is required.");
  console.error("Usage: DATABASE_URL=<url> node scripts/migrate-phase3-threshold-letters.mjs");
  process.exit(1);
}

const sql = neon(DATABASE_URL);

async function run() {
  console.log("Phase 3 Migration — Threshold Letter Memory");
  console.log("=".repeat(52));

  console.log("\n[1/2] Creating threshold_letter...");
  await sql`
    CREATE TABLE IF NOT EXISTS threshold_letter (
      id                    BIGSERIAL   PRIMARY KEY,
      user_id               BIGINT      NOT NULL REFERENCES elder_user(id) ON DELETE CASCADE,
      lineage_key           TEXT        NOT NULL,
      volatilization_phrase TEXT        NOT NULL DEFAULT '',
      return_phrase         TEXT        NOT NULL DEFAULT '',
      return_gift           TEXT        NOT NULL,
      threshold_image       TEXT        NOT NULL DEFAULT '',
      created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
    )`;
  await sql`CREATE INDEX IF NOT EXISTS threshold_letter_user_idx ON threshold_letter (user_id)`;
  await sql`CREATE INDEX IF NOT EXISTS threshold_letter_created_idx ON threshold_letter (created_at DESC)`;
  console.log("  ok threshold_letter");

  console.log("\n[2/2] Verifying...");
  const tables = await sql`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'threshold_letter'`;
  if (tables.length === 0) { console.error("  MISSING: threshold_letter"); process.exit(1); }

  const cols = await sql`
    SELECT column_name FROM information_schema.columns
    WHERE table_schema='public' AND table_name='threshold_letter'
    ORDER BY ordinal_position`;
  console.log(`  ok threshold_letter: ${cols.map(c => c.column_name).join(", ")}`);

  console.log("\n" + "=".repeat(52));
  console.log("Migration complete.");
}

run().catch(err => { console.error("Migration failed:", err.message); process.exit(1); });
