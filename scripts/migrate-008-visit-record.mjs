#!/usr/bin/env node
// Migration 008 — visit_record on elder_user (Memory Spine PR A).
// Mirrors the established house style (see migrate-phase4-threshold-letter-marker.mjs):
// one sql`...` call per statement rather than executing the raw .sql file as
// one multi-statement query, since the HTTP driver's tagged-template
// interface expects a single statement per call. Every statement here is
// idempotent (IF EXISTS / IF NOT EXISTS guarded), matching
// migrations/008_visit_record_on_elder_user.sql.
//
// Uses DATABASE_URL_UNPOOLED if set (recommended for DDL), falls back to
// DATABASE_URL.
import { neon } from "@neondatabase/serverless";

const DATABASE_URL = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("ERROR: DATABASE_URL_UNPOOLED or DATABASE_URL environment variable is required.");
  process.exit(1);
}

const sql = neon(DATABASE_URL);

async function run() {
  console.log("Migration 008 — visit_record on elder_user");
  console.log("=".repeat(52));

  console.log("\n[1/5] Extensions...");
  await sql`CREATE EXTENSION IF NOT EXISTS citext`;
  await sql`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`;

  console.log("[2/5] Legacy 004 preservation (guarded, one-shot)...");
  await sql`
    DO $$
    BEGIN
      IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'visit_record')
         AND NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'visit_record_legacy_004')
         AND EXISTS (
           SELECT 1 FROM information_schema.columns
           WHERE table_schema = 'public' AND table_name = 'visit_record'
             AND column_name = 'user_id' AND data_type = 'uuid'
         )
      THEN
        ALTER TABLE visit_record RENAME TO visit_record_legacy_004;
        ALTER INDEX IF EXISTS uq_visit_chain_depth RENAME TO uq_visit_chain_depth_legacy_004;
        ALTER INDEX IF EXISTS idx_visit_user_chain RENAME TO idx_visit_user_chain_legacy_004;
        ALTER INDEX IF EXISTS idx_visit_user_recent RENAME TO idx_visit_user_recent_legacy_004;
      END IF;

      IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'user_record')
         AND NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'user_record_legacy_004')
      THEN
        ALTER TABLE user_record RENAME TO user_record_legacy_004;
      END IF;
    END $$
  `;

  console.log("[3/5] Creating visit_record...");
  await sql`
    CREATE TABLE IF NOT EXISTS visit_record (
      id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id           BIGINT NOT NULL REFERENCES elder_user(id) ON DELETE CASCADE,
      chain_id          UUID NOT NULL,
      visit_mode        TEXT NOT NULL CHECK (visit_mode IN ('explore', 'deepen')),
      lineage_key       TEXT NOT NULL DEFAULT 'default',
      myth_title        CITEXT,
      archetype         CITEXT,
      depth             INTEGER NOT NULL DEFAULT 1,
      offering          TEXT,
      elder_response    TEXT NOT NULL,
      markers           JSONB,
      markers_confirmed JSONB,
      door_back_offered BOOLEAN NOT NULL DEFAULT FALSE,
      created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  console.log("[4/5] Indexes...");
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS uq_visit_chain_depth ON visit_record (chain_id, depth)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_visit_user_chain ON visit_record (user_id, chain_id, depth, created_at)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_visit_user_recent ON visit_record (user_id, created_at DESC)`;

  console.log("[5/5] Verifying...");
  const cols = await sql`
    SELECT column_name FROM information_schema.columns
    WHERE table_schema='public' AND table_name='visit_record'
    ORDER BY ordinal_position`;
  console.log(`  ok visit_record: ${cols.map(c => c.column_name).join(", ")}`);

  console.log("\n" + "=".repeat(52));
  console.log("Migration 008 complete.");
}

run().catch(err => { console.error("Migration failed:", err.message); process.exit(1); });
