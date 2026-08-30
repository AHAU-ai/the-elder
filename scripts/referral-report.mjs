#!/usr/bin/env node
// scripts/referral-report.mjs
//
// Answers the actual question acquisition instrumentation exists to
// answer: is a channel (a partner-org link, a tracked share) converting
// NEW users, not just being looked at? Reads lib/referral.ts's
// elder_user.referral_source/referred_at and share_card.open_count --
// see migrations/025_referral_attribution.sql for what's actually stored.
//
// Usage:
//   node scripts/referral-report.mjs [--since 2026-08-01] [--source partner-okma]
//
// Requires DATABASE_URL (reads it from .env.local if not already set,
// same convention as scripts/drift-detect.mjs's loadEnvLocalKey).

import { readFileSync } from 'fs';
import { neon } from '@neondatabase/serverless';

function loadEnvLocalKey(name) {
  if (process.env[name]) return process.env[name];
  try {
    const raw = readFileSync('.env.local', 'utf-8');
    for (const line of raw.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      if (key === name) return trimmed.slice(eq + 1).trim();
    }
  } catch { /* no .env.local, fall through */ }
  return undefined;
}

const DATABASE_URL = loadEnvLocalKey('DATABASE_URL');
if (!DATABASE_URL) {
  console.error('DATABASE_URL not set (checked process.env and .env.local). Cannot run report.');
  process.exit(1);
}

const args = process.argv.slice(2);
function argValue(flag) {
  const i = args.indexOf(flag);
  return i !== -1 && args[i + 1] ? args[i + 1] : null;
}
const since = argValue('--since'); // e.g. '2026-08-01'
const sourceFilter = argValue('--source'); // e.g. 'partner-okma'

const sql = neon(DATABASE_URL);

async function main() {
  console.log('\n━━━ New accounts by referral source ━━━\n');
  const bySource = await sql`
    SELECT
      COALESCE(referral_source, '(organic/direct)') AS source,
      count(*)::int AS new_accounts,
      min(referred_at) AS first_seen,
      max(referred_at) AS last_seen
    FROM elder_user
    WHERE (${since}::date IS NULL OR created_at >= ${since}::date)
      AND (${sourceFilter}::text IS NULL OR referral_source = ${sourceFilter})
    GROUP BY referral_source
    ORDER BY new_accounts DESC
  `;
  if (bySource.length === 0) {
    console.log('  (no accounts match the given filters)');
  } else {
    for (const row of bySource) {
      console.log(`  ${row.source.padEnd(30)} ${String(row.new_accounts).padStart(6)} new accounts`);
    }
  }

  console.log('\n━━━ Share reach vs. conversion (share-* sources only) ━━━\n');
  // Every account whose referral_source is 'share-<id>' converted from
  // that specific share_card's open_count -- joining the two tells you
  // the actual conversion rate per share, not just aggregate opens or
  // aggregate signups in isolation.
  const shareConv = await sql`
    SELECT
      sc.id AS share_id,
      sc.open_count,
      sc.created_at AS share_created_at,
      count(eu.id)::int AS converted_accounts
    FROM share_card sc
    LEFT JOIN elder_user eu ON eu.referral_source = 'share-' || sc.id::text
    WHERE sc.open_count > 0 OR EXISTS (
      SELECT 1 FROM elder_user WHERE referral_source = 'share-' || sc.id::text
    )
    GROUP BY sc.id, sc.open_count, sc.created_at
    ORDER BY sc.open_count DESC
    LIMIT 50
  `;
  if (shareConv.length === 0) {
    console.log('  (no shares have been opened or converted yet)');
  } else {
    console.log('  share id                              opens   new accounts   conv. rate');
    for (const row of shareConv) {
      const rate = row.open_count > 0 ? ((row.converted_accounts / row.open_count) * 100).toFixed(1) + '%' : 'n/a';
      console.log(`  ${row.share_id}   ${String(row.open_count).padStart(5)}   ${String(row.converted_accounts).padStart(12)}   ${rate}`);
    }
    const totals = shareConv.reduce((acc, r) => ({ opens: acc.opens + r.open_count, conv: acc.conv + r.converted_accounts }), { opens: 0, conv: 0 });
    const overallRate = totals.opens > 0 ? ((totals.conv / totals.opens) * 100).toFixed(1) + '%' : 'n/a';
    console.log(`\n  TOTAL: ${totals.opens} opens -> ${totals.conv} new accounts (${overallRate})`);
  }

  console.log('\nNote: this only covers shares created by SIGNED-IN seekers -- anonymous');
  console.log('"taste" visitors currently share the raw image via the device share sheet');
  console.log('with no tracked link at all, so their reach/conversion is invisible here.');
  console.log('See docs/referral-attribution.md for why, and what closing that gap would take.\n');
}

main().catch((err) => {
  console.error('Report failed:', err);
  process.exit(1);
});
