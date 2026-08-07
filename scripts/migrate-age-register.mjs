#!/usr/bin/env node
import { neon } from "@neondatabase/serverless";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("ERROR: DATABASE_URL environment variable is required.");
  console.error("Usage: DATABASE_URL=<url> node scripts/migrate-age-register.mjs");
  process.exit(1);
}

const sql = neon(DATABASE_URL);
const __dirname = dirname(fileURLToPath(import.meta.url));
const migrationPath = join(__dirname, "..", "migrations", "007_narrative_register.sql");

// Neon's serverless driver sends each query as its own prepared statement,
// so a single file containing BEGIN/ALTER/DO/COMMIT can't be sent as one
// blob (it errors: "cannot insert multiple commands into a prepared
// statement"). The migration file is still the source of truth for anyone
// running it via psql/Neon SQL editor directly; here we just re-issue its
// two effective statements individually, same net effect.

async function run() {
  console.log("Age-Tiered Narrative Register Migration (007)");
  console.log("=".repeat(52));
  console.log(`\nApplying statements from ${migrationPath} individually (driver limitation)...`);

  console.log("\n[1/2] Adding narrative_register column...");
  await sql.query(`
    ALTER TABLE elder_user
      ADD COLUMN IF NOT EXISTS narrative_register TEXT NOT NULL DEFAULT 'adult'
  `);
  console.log("  ok column");

  console.log("\n[2/2] Adding CHECK constraint (guarded)...");
  await sql.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'elder_user_narrative_register_check'
      ) THEN
        ALTER TABLE elder_user
          ADD CONSTRAINT elder_user_narrative_register_check
          CHECK (narrative_register IN ('young_adult', 'adult'));
      END IF;
    END $$
  `);
  console.log("  ok constraint");

  console.log("\nVerifying...");
  const cols = await sql`
    SELECT column_name, data_type, column_default, is_nullable
    FROM information_schema.columns
    WHERE table_name = 'elder_user' AND column_name = 'narrative_register'
  `;
  const constraints = await sql`
    SELECT conname, pg_get_constraintdef(oid) AS def
    FROM pg_constraint
    WHERE conname = 'elder_user_narrative_register_check'
  `;
  console.log("  column:", cols[0]);
  console.log("  constraint:", constraints[0]);

  console.log("\nDone.");
}

run().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
