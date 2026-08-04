#!/usr/bin/env node
import { neon } from "@neondatabase/serverless";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("ERROR: DATABASE_URL environment variable is required.");
  console.error("Usage: DATABASE_URL=<url> node scripts/migrate-phase2-myth-accounts.mjs");
  process.exit(1);
}

const sql = neon(DATABASE_URL);

async function run() {
  console.log("Phase 2 Migration — Myth Memory Accounts");
  console.log("=".repeat(52));

  console.log("\n[1/4] Creating elder_user...");
  await sql`
    CREATE TABLE IF NOT EXISTS elder_user (
      id         BIGSERIAL   PRIMARY KEY,
      email      TEXT        NOT NULL UNIQUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`;
  console.log("  ok elder_user");

  console.log("\n[2/4] Creating elder_login_token...");
  await sql`
    CREATE TABLE IF NOT EXISTS elder_login_token (
      id         BIGSERIAL   PRIMARY KEY,
      token      TEXT        NOT NULL UNIQUE,
      email      TEXT        NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      used_at    TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`;
  await sql`CREATE INDEX IF NOT EXISTS elder_login_token_token_idx ON elder_login_token (token)`;
  console.log("  ok elder_login_token");

  console.log("\n[3/4] Creating myth_archetype...");
  await sql`
    CREATE TABLE IF NOT EXISTS myth_archetype (
      id                   BIGSERIAL   PRIMARY KEY,
      user_id              BIGINT      NOT NULL REFERENCES elder_user(id) ON DELETE CASCADE,
      lineage_key          TEXT        NOT NULL,
      archetype_name       TEXT        NOT NULL,
      summary              TEXT        NOT NULL DEFAULT '',
      people_circumstances TEXT        NOT NULL DEFAULT '',
      reading_count        INTEGER     NOT NULL DEFAULT 1,
      created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
    )`;
  await sql`CREATE INDEX IF NOT EXISTS myth_archetype_user_idx ON myth_archetype (user_id)`;
  await sql`CREATE INDEX IF NOT EXISTS myth_archetype_updated_idx ON myth_archetype (updated_at)`;
  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS myth_archetype_user_name_idx
    ON myth_archetype (user_id, lower(archetype_name))`;
  console.log("  ok myth_archetype");

  console.log("\n[4/4] Verifying...");
  const tables = await sql`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name IN ('elder_user', 'elder_login_token', 'myth_archetype')
    ORDER BY table_name`;
  const names = tables.map(r => r.table_name);
  const missing = ["elder_login_token", "elder_user", "myth_archetype"].filter(t => !names.includes(t));
  if (missing.length) { console.error("  MISSING:", missing.join(", ")); process.exit(1); }

  for (const name of names) {
    const cols = await sql`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema='public' AND table_name=${name}
      ORDER BY ordinal_position`;
    console.log(`  ok ${name}: ${cols.map(c => c.column_name).join(", ")}`);
  }

  console.log("\n" + "=".repeat(52));
  console.log("Migration complete. Run with DATABASE_URL=<url> node scripts/migrate-phase2-myth-accounts.mjs");
}

run().catch(err => { console.error("Migration failed:", err.message); process.exit(1); });
