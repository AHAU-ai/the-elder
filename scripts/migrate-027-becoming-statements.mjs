#!/usr/bin/env node
// Migration 027 — becoming_statement. Mirrors migrations/027_becoming_statements.sql.
// Uses DATABASE_URL_UNPOOLED if set (recommended for DDL), falls back to DATABASE_URL.
import { neon } from "@neondatabase/serverless";

const DATABASE_URL = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("ERROR: DATABASE_URL_UNPOOLED or DATABASE_URL environment variable is required.");
  process.exit(1);
}

const sql = neon(DATABASE_URL);

async function run() {
  console.log("Migration 027 — becoming_statement");
  console.log("=".repeat(52));

  console.log("\n[1/4] Creating becoming_statement...");
  await sql`
    CREATE TABLE IF NOT EXISTS becoming_statement (
      id                BIGSERIAL   PRIMARY KEY,
      user_id           BIGINT      NOT NULL REFERENCES elder_user(id) ON DELETE CASCADE,
      voice_key         TEXT        NOT NULL CHECK (char_length(voice_key) <= 64),
      archetype_name    TEXT        CHECK (archetype_name IS NULL OR char_length(archetype_name) <= 120),
      marker            TEXT        NOT NULL CHECK (marker IN ('wound', 'figure', 'threshold', 'exile', 'pattern')),
      completion_stem   TEXT        NOT NULL CHECK (char_length(completion_stem) <= 80),
      completion_text   TEXT        NOT NULL CHECK (char_length(completion_text) BETWEEN 3 AND 140),
      created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;

  console.log("[2/4] Index...");
  await sql`
    CREATE INDEX IF NOT EXISTS idx_becoming_statement_user
      ON becoming_statement (user_id, created_at ASC)
  `;

  console.log("[3/4] Extending core_myth_statement with source_becoming_ids...");
  await sql`
    ALTER TABLE core_myth_statement
      ADD COLUMN IF NOT EXISTS source_becoming_ids JSONB NOT NULL DEFAULT '[]'
  `;

  console.log("[4/4] Verifying...");
  const bsCols = await sql`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'becoming_statement' ORDER BY ordinal_position
  `;
  const cmsCols = await sql`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'core_myth_statement' ORDER BY ordinal_position
  `;
  console.log("becoming_statement columns:", bsCols.map(c => c.column_name).join(", "));
  console.log("core_myth_statement columns:", cmsCols.map(c => c.column_name).join(", "));

  console.log("\nMigration 027 complete.");
}

run().catch(e => {
  console.error("Migration 027 FAILED:", e.message);
  process.exit(1);
});
