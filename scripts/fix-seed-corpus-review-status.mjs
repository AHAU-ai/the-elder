// scripts/fix-seed-corpus-review-status.mjs
//
// ONE-TIME CORRECTION. Run once against the real database, then this script
// has served its purpose (leave it in history for the audit trail; no need
// to run again).
//
// Five passages (otz-001 through otz-005) were seeded with review_status =
// 'approved' while reviewed_by = 'pending-stanzione' -- a direct
// contradiction. Because retrievable_passage filters on review_status =
// 'approved' AND embedding IS NOT NULL, any of these that already had an
// embedding generated would have been servable to real users despite never
// having received Vincent's lineage review.
//
// This script:
//   1. Sets review_status back to 'pending' for all five passages.
//   2. Nulls their embedding (schema.sql's own comment: embedding should be
//      set ONLY for approved+open passages -- a pending passage shouldn't
//      carry one regardless of how it got there).
//   3. Rewrites the ambiguous "public scholarly record" source label on the
//      three Popol Wuj passages (otz-001/002/003) to make explicit these
//      are placeholder original paraphrase, not sourced from any specific
//      translation (Tedlock's or otherwise) -- pending replacement with
//      Stanzione's Nim Nuna Oj translation. otz-004/005 already correctly
//      cite Stanzione transmission and are left as-is aside from status.
//
// Usage:
//   node scripts/fix-seed-corpus-review-status.mjs
//
// Requires DATABASE_URL in .env.local, same as the other scripts/ files.

import { neon } from '@neondatabase/serverless';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const sql = neon(process.env.DATABASE_URL);

const PLACEHOLDER_SOURCE =
  "Popol Wuj — placeholder narrative (original paraphrase, not sourced from any specific translation), pending replacement with Stanzione's Nim Nuna Oj translation";

async function main() {
  console.log('Checking current state of the five affected passages...\n');

  const before = await sql`
    SELECT passage_id, review_status, reviewed_by, source, (embedding IS NOT NULL) AS has_embedding
    FROM corpus_passage
    WHERE passage_id IN ('otz-001', 'otz-002', 'otz-003', 'otz-004', 'otz-005')
    ORDER BY passage_id;
  `;

  if (before.length === 0) {
    console.log('No matching rows found -- these passages were never seeded into this database. Nothing to correct.');
    return;
  }

  console.table(before);

  const contradicted = before.filter(
    r => r.review_status === 'approved' && String(r.reviewed_by).includes('pending')
  );
  if (contradicted.length === 0) {
    console.log('\nNo rows currently show the approved/pending-stanzione contradiction. Nothing to correct.');
    return;
  }

  console.log(`\n${contradicted.length} row(s) show the contradiction. Correcting...\n`);

  // Fix review_status + null embedding for all five, regardless of current state
  // (idempotent -- safe to re-run).
  await sql`
    UPDATE corpus_passage
    SET review_status = 'pending',
        embedding = NULL,
        updated_at = now()
    WHERE passage_id IN ('otz-001', 'otz-002', 'otz-003', 'otz-004', 'otz-005');
  `;

  // Fix the ambiguous source label on the three Popol Wuj placeholder passages only.
  await sql`
    UPDATE corpus_passage
    SET source = ${PLACEHOLDER_SOURCE},
        updated_at = now()
    WHERE passage_id IN ('otz-001', 'otz-002', 'otz-003');
  `;

  const after = await sql`
    SELECT passage_id, review_status, reviewed_by, source, (embedding IS NOT NULL) AS has_embedding
    FROM corpus_passage
    WHERE passage_id IN ('otz-001', 'otz-002', 'otz-003', 'otz-004', 'otz-005')
    ORDER BY passage_id;
  `;

  console.log('\nAfter correction:');
  console.table(after);

  const stillRetrievable = await sql`
    SELECT passage_id FROM retrievable_passage
    WHERE passage_id IN ('otz-001', 'otz-002', 'otz-003', 'otz-004', 'otz-005');
  `;
  console.log(
    stillRetrievable.length === 0
      ? '\nConfirmed: none of the five passages are in retrievable_passage anymore.'
      : `\nWARNING: ${stillRetrievable.length} passage(s) still showing in retrievable_passage: ${stillRetrievable.map(r => r.passage_id).join(', ')}`
  );
}

main().catch(err => {
  console.error('Correction script failed:', err);
  process.exit(1);
});
