#!/usr/bin/env node
// scripts/verify-neon-connections.mjs
//
// THROWAWAY — verify both Neon connection strings actually work before
// touching scripts/migrate-phase1.mjs. Delete after Phase 1 lands, or
// keep it around as a pre-migration sanity gate — your call.
//
// Checks:
//   DATABASE_URL           — pooled (PgBouncer), what the app routes use
//                             at runtime (see app/api/altar/route.ts,
//                             app/api/log/route.ts)
//   DATABASE_URL_UNPOOLED  — direct connection, what migrations should
//                             use (DDL/long transactions don't love
//                             pooled connections)
//
// If your Neon dashboard / Vercel integration uses different names,
// override on the command line:
//   node scripts/verify-neon-connections.mjs --pooled=FOO --unpooled=BAR
//
// USAGE:
//   node scripts/verify-neon-connections.mjs
//   node --env-file=.env.local scripts/verify-neon-connections.mjs   (Node 20.6+)
//
// Exits non-zero if either connection fails — safe to chain:
//   node scripts/verify-neon-connections.mjs && node scripts/migrate-phase1.mjs

import { neon } from '@neondatabase/serverless';
import { readFileSync, existsSync } from 'node:fs';

// --- minimal .env.local loader (no dotenv dependency, matches the rest
//     of this repo's scripts not pulling in extra deps for one-offs) ---
function loadDotEnvLocal() {
  if (!existsSync('.env.local')) return;
  const raw = readFileSync('.env.local', 'utf8');
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = val;
  }
}
loadDotEnvLocal();

// --- arg parsing for the override flags ---
const args = process.argv.slice(2);
function flag(name, fallback) {
  const hit = args.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.split('=').slice(1).join('=') : fallback;
}
const POOLED_VAR = flag('pooled', 'DATABASE_URL');
const UNPOOLED_VAR = flag('unpooled', 'DATABASE_URL_UNPOOLED');

function redact(connStr) {
  if (!connStr) return '(not set)';
  try {
    const u = new URL(connStr);
    return `${u.protocol}//${u.username}:****@${u.host}${u.pathname}`;
  } catch {
    return '(set, but failed to parse as a URL)';
  }
}

async function checkConnection(label, envVarName) {
  const connStr = process.env[envVarName];
  console.log(`\n${label} (${envVarName})`);
  console.log(`  ${redact(connStr)}`);

  if (!connStr) {
    console.log('  ✗ FAIL — env var is not set');
    return false;
  }

  try {
    const sql = neon(connStr);
    const start = Date.now();
    const rows = await sql`SELECT 1 AS ok, current_database() AS db, version() AS pg_version`;
    const ms = Date.now() - start;
    const row = rows[0];
    const versionShort = row.pg_version.split(',')[0]; // trim verbose build string
    console.log(`  ✓ OK — ${ms}ms — database "${row.db}" — ${versionShort}`);
    return true;
  } catch (err) {
    console.log(`  ✗ FAIL — ${err.message}`);
    return false;
  }
}

const results = await Promise.all([
  checkConnection('Pooled', POOLED_VAR),
  checkConnection('Unpooled / direct', UNPOOLED_VAR),
]);

const allOk = results.every(Boolean);
console.log(`\n${allOk ? '✓ both connections good' : '✗ at least one connection failed'}`);
process.exit(allOk ? 0 : 1);
