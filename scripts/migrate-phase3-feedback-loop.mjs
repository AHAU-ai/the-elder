#!/usr/bin/env node
import { neon } from "@neondatabase/serverless";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("ERROR: DATABASE_URL environment variable is required.");
  console.error("Usage: DATABASE_URL=<url> node scripts/migrate-phase3-feedback-loop.mjs");
  process.exit(1);
}

const sql = neon(DATABASE_URL);

async function run() {
  console.log("Phase 3 Migration — Feedback Loop for Returning Seekers");
  console.log("=".repeat(52));

  console.log("\n[1/2] Adding user_id to altar_record...");
  await sql`ALTER TABLE altar_record ADD COLUMN IF NOT EXISTS user_id BIGINT REFERENCES elder_user(id)`;
  await sql`CREATE INDEX IF NOT EXISTS altar_record_user_lineage_idx ON altar_record (user_id, lineage, created_at DESC)`;
  console.log("  ok altar_record.user_id");

  console.log("\n[2/2] Verifying...");
  const cols = await sql`
    SELECT column_name FROM information_schema.columns
    WHERE table_schema='public' AND table_name='altar_record'
    ORDER BY ordinal_position`;
  const names = cols.map(c => c.column_name);
  if (!names.includes('user_id')) {
    console.error("  MISSING: altar_record.user_id");
    process.exit(1);
  }
  console.log(`  ok altar_record: ${names.join(", ")}`);

  console.log("\n" + "=".repeat(52));
  console.log("Migration complete. Run with DATABASE_URL=<url> node scripts/migrate-phase3-feedback-loop.mjs");
}

run().catch(err => { console.error("Migration failed:", err.message); process.exit(1); });
