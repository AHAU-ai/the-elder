#!/usr/bin/env node
// Migration 009 — marker_trajectory. Mirrors migrations/009_marker_trajectory.sql.
// Uses DATABASE_URL_UNPOOLED if set (recommended for DDL), falls back to DATABASE_URL.
import { neon } from "@neondatabase/serverless";

const DATABASE_URL = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("ERROR: DATABASE_URL_UNPOOLED or DATABASE_URL environment variable is required.");
  process.exit(1);
}

const sql = neon(DATABASE_URL);

async function run() {
  console.log("Migration 009 — marker_trajectory");
  console.log("=".repeat(52));

  console.log("\n[1/3] Creating marker_trajectory...");
  await sql`
    CREATE TABLE IF NOT EXISTS marker_trajectory (
      id                BIGSERIAL PRIMARY KEY,
      user_id           BIGINT NOT NULL REFERENCES elder_user(id) ON DELETE CASCADE,
      marker_type       TEXT NOT NULL CHECK (marker_type IN ('wound', 'figure', 'threshold', 'exile', 'pattern')),
      marker_value      TEXT NOT NULL,
      appearance_count  INTEGER NOT NULL DEFAULT 1,
      first_seen        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_seen         TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  console.log("[2/3] Indexes...");
  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS uq_marker_trajectory_user_type_value
      ON marker_trajectory (user_id, marker_type, lower(marker_value))
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_marker_trajectory_user_count ON marker_trajectory (user_id, appearance_count DESC)`;

  console.log("[3/3] Verifying...");
  const cols = await sql`
    SELECT column_name FROM information_schema.columns
    WHERE table_schema='public' AND table_name='marker_trajectory'
    ORDER BY ordinal_position`;
  console.log(`  ok marker_trajectory: ${cols.map(c => c.column_name).join(", ")}`);

  console.log("\n" + "=".repeat(52));
  console.log("Migration 009 complete.");
}

run().catch(err => { console.error("Migration failed:", err.message); process.exit(1); });
