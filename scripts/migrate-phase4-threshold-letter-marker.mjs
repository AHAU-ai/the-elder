#!/usr/bin/env node
import { neon } from "@neondatabase/serverless";

const DATABASE_URL = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("ERROR: DATABASE_URL_UNPOOLED or DATABASE_URL environment variable is required.");
  console.error("Usage: DATABASE_URL=<url> node scripts/migrate-phase4-threshold-letter-marker.mjs");
  process.exit(1);
}

const sql = neon(DATABASE_URL);

async function run() {
  console.log("Phase 4 Migration — Threshold Letter Marker");
  console.log("=".repeat(52));

  console.log("\n[1/2] Adding marker/chain_id to threshold_letter...");
  await sql`
    ALTER TABLE threshold_letter
      ADD COLUMN IF NOT EXISTS marker   TEXT NULL,
      ADD COLUMN IF NOT EXISTS chain_id TEXT NULL`;

  const constraints = await sql`
    SELECT conname FROM pg_constraint WHERE conname = 'threshold_letter_marker_check'`;
  if (constraints.length === 0) {
    await sql`
      ALTER TABLE threshold_letter
        ADD CONSTRAINT threshold_letter_marker_check
        CHECK (marker IS NULL OR marker IN ('wound','threshold','pattern','exile','figure'))`;
  }

  await sql`CREATE INDEX IF NOT EXISTS threshold_letter_user_marker_idx ON threshold_letter (user_id, marker)`;
  console.log("  ok threshold_letter.marker, threshold_letter.chain_id");

  console.log("\n[2/2] Verifying...");
  const cols = await sql`
    SELECT column_name FROM information_schema.columns
    WHERE table_schema='public' AND table_name='threshold_letter'
    ORDER BY ordinal_position`;
  console.log(`  ok threshold_letter: ${cols.map(c => c.column_name).join(", ")}`);

  console.log("\n" + "=".repeat(52));
  console.log("Migration complete.");
}

run().catch(err => { console.error("Migration failed:", err.message); process.exit(1); });
