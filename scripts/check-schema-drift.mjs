#!/usr/bin/env node
/**
 * check-schema-drift.mjs
 * THE ELDER — Schema/View Drift Guard
 * ────────────────────────────────────
 * Guards against the specific bug found + fixed 2026-08-18
 * (migrations/013_fix_lineage_key_drift.sql): retrievable_passage is a
 * `SELECT * FROM corpus_passage WHERE ...` view. Postgres freezes a
 * `SELECT *` view's column list at CREATE time -- adding a column to
 * corpus_passage later does NOT propagate to the view. That silently
 * broke lib/corpusRetrieval.ts's query (it filtered on a column the view
 * didn't expose), which threw, which was caught by retrieveForVoice()'s
 * deliberate fail-soft design -- so the break was invisible for as long
 * as the drift existed. Nobody would have found it without querying the
 * DB by hand.
 *
 * This script queries information_schema directly and fails loudly if
 * ANY `SELECT *`-style view listed below has drifted from its base
 * table's current column set. It requires DATABASE_URL and hits the
 * live DB -- run it locally after any migration that touches a table
 * one of these views wraps, or wire it into a deploy step. It does NOT
 * belong in gk-007's static CI tier (that tier is explicitly no-network/
 * no-secrets/deterministic) -- this needs a real DB connection.
 *
 * Usage:
 *   DATABASE_URL=... node scripts/check-schema-drift.mjs
 *
 * To cover a new SELECT * view: add { view, table } to WRAPPED_VIEWS below.
 */

import { neon } from '@neondatabase/serverless';

const WRAPPED_VIEWS = [
  { view: 'retrievable_passage', table: 'corpus_passage' },
];

async function columnsOf(sql, tableName) {
  const rows = await sql`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = ${tableName}
    ORDER BY column_name
  `;
  return new Set(rows.map((r) => r.column_name));
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL not set -- this check needs a real DB connection to compare live schema, not the schema.sql file (which can itself drift from the DB, as it did until 2026-08-17/18).');
    process.exit(1);
  }

  const sql = neon(process.env.DATABASE_URL);
  let drifted = false;

  for (const { view, table } of WRAPPED_VIEWS) {
    const [viewCols, tableCols] = await Promise.all([columnsOf(sql, view), columnsOf(sql, table)]);

    if (viewCols.size === 0) {
      console.error(`❌  ${view}: view not found in this DB (or has no columns) -- check the name.`);
      drifted = true;
      continue;
    }
    if (tableCols.size === 0) {
      console.error(`❌  ${table}: base table not found in this DB -- check the name.`);
      drifted = true;
      continue;
    }

    const missingFromView = [...tableCols].filter((c) => !viewCols.has(c));
    if (missingFromView.length > 0) {
      console.error(
        `❌  ${view} has drifted from ${table}: missing column(s) [${missingFromView.join(', ')}].\n` +
        `    ${table} was altered after ${view} was created (or last recreated), and the view's\n` +
        `    frozen SELECT * column list was never refreshed. Any code filtering/selecting on\n` +
        `    ${missingFromView.join('/')} against ${view} will throw at query time -- and if that\n` +
        `    code fails soft (as retrieval intentionally does), the break will be invisible.\n` +
        `    Fix: DROP VIEW ${view}; then recreate it (see scripts-resilience/schema.sql).`
      );
      drifted = true;
    } else {
      console.log(`✅  ${view} matches ${table} (${tableCols.size} columns, no drift).`);
    }
  }

  process.exit(drifted ? 1 : 0);
}

main().catch((err) => {
  console.error('check-schema-drift.mjs crashed:', err);
  process.exit(1);
});
