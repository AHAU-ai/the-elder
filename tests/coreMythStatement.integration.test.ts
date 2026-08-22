/**
 * coreMythStatement.integration.test.ts — Adversarial race test for the
 * Core Myth Statement's version-write path (migration 022), plus
 * eligibility/dismissal and the structural non-connection guarantee on
 * material assembly.
 *
 * Requires a live DATABASE_URL — this is an integration test, not a
 * hermetic one (same category as tests/markerDepthStage.integration.test.ts).
 * Run: npx tsx -r dotenv/config tests/coreMythStatement.integration.test.ts dotenv_config_path=.env.local
 *
 * Creates and cleans up its own throwaway elder_user/marker_trajectory
 * rows — never touches real seeker data.
 */
import { sql } from '../lib/returning/db';
import {
  getEligibility,
  assembleIntegratedMaterial,
  saveNewStatement,
  getCurrentStatement,
  getStatementHistory,
  dismissInvitation,
  VersionConflictError,
  REQUIRED_INTEGRATED_MARKERS,
} from '../lib/returning/coreMythStatement';

let failures = 0;
function check(name: string, cond: boolean) {
  if (cond) {
    console.log(`  ok  ${name}`);
  } else {
    console.error(`  FAIL  ${name}`);
    failures++;
  }
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL required for this integration test.');
    process.exit(1);
  }

  const email = `core-myth-test-${Date.now()}@example.invalid`;
  const [user] = await sql`INSERT INTO elder_user (email) VALUES (${email}) RETURNING id`;
  const userId = Number(user.id);

  const INTEGRATED_VALUES = [
    { type: 'wound', value: 'a wound that recurs, now faced' },
    { type: 'threshold', value: 'a threshold crossed more than once' },
    { type: 'exile', value: 'a part called home, in my own words' },
  ];

  try {
    check('below the floor: not eligible with zero integrated markers', (await getEligibility(userId)).status === 'not_eligible');

    // Insert the marker_trajectory rows directly at 'integrated' -- this
    // test is about the statement layer, not re-proving depth-stage
    // mechanics (already covered by markerDepthStage.integration.test.ts).
    const trajectoryIds: number[] = [];
    for (const m of INTEGRATED_VALUES) {
      const [row] = await sql`
        INSERT INTO marker_trajectory (user_id, marker_type, marker_value, reshape_count, depth_stage, depth_stage_updated_at)
        VALUES (${userId}, ${m.type}, ${m.value}, 3, 'integrated', now())
        RETURNING id
      `;
      trajectoryIds.push(Number(row.id));
    }

    const eligibility = await getEligibility(userId);
    check(`eligibility: invited at exactly ${REQUIRED_INTEGRATED_MARKERS} integrated markers`, eligibility.status === 'invited' && eligibility.integratedCount === 3);

    // ── Structural non-connection: verify the actual returned shape ────
    const material = await assembleIntegratedMaterial(userId);
    check('material: exactly 3 raw items, one per integrated marker', material.length === 3);
    check('material: every item is exactly one of the confirmed values, untouched', material.every(m => INTEGRATED_VALUES.some(v => v.value === m.markerValue)));

    // ── Round 1: two concurrent FIRST saves ─────────────────────────────
    // The two-statement-in-one-transaction write (same pattern
    // thresholdLetterLedger.ts already trusts) serializes correctly under
    // real concurrency: verified directly against the live DB (a small
    // standalone repro, not this test file) that Postgres row-locks the
    // UPDATE's target row, so a concurrent second call blocks and then
    // correctly sees the first call's already-committed state rather than
    // racing past it -- BOTH calls succeed, properly ordered, not one
    // winning and one erroring. The property that actually matters is
    // "no corruption" (never two current rows, never two rows claiming
    // the same version), which this asserts directly rather than
    // asserting which specific call happened to land first.
    const sourceIds = material.map(m => m.trajectoryId);
    const results = await Promise.allSettled([
      saveNewStatement(userId, 'This is my first attempt at naming what I now carry, written in full.', sourceIds),
      saveNewStatement(userId, 'This is a different simultaneous attempt at the very same moment of writing.', sourceIds),
    ]);
    const fulfilled = results.filter(r => r.status === 'fulfilled');
    check('round 1: both concurrent saves complete without a crash', fulfilled.length === 2);

    const rows1 = await sql`SELECT version, superseded_at FROM core_myth_statement WHERE user_id=${userId} ORDER BY version`;
    check('round 1: exactly two rows exist (versions 1 and 2), no duplicate/corrupted version', rows1.length === 2 && Number(rows1[0].version) === 1 && Number(rows1[1].version) === 2);
    check('round 1: exactly one current row after the race, not two', rows1.filter((r: any) => r.superseded_at === null).length === 1);
    check('round 1: version 1 is the one marked superseded (correct order preserved)', rows1[0].superseded_at !== null && rows1[1].superseded_at === null);

    // ── Round 2: a genuine sequential revision on top ───────────────────
    const revised = await saveNewStatement(userId, 'This is my revised understanding, written some time later, in full.', sourceIds);
    check('round 2: sequential revision lands as version 3', revised.version === 3);

    const current = await getCurrentStatement(userId);
    check('round 2: current statement is the new version 3 text', current?.version === 3);

    const history = await getStatementHistory(userId);
    check('round 2: history shows all three versions, newest first', history.length === 3 && history[0].version === 3 && history[2].version === 1);
    check('round 2: only the newest version is current, all others superseded', history.filter(h => h.supersededAt === null).length === 1 && history[0].supersededAt === null);

    // ── Dismissal: count-anchored, no timers ────────────────────────────
    await dismissInvitation(userId);
    let elig = await getEligibility(userId);
    check('dismissal: status flips to dismissed at the current count', elig.status === 'dismissed' && elig.integratedCount === 3);

    // A 4th integrated marker should re-open the (already-written-around)
    // invitation state -- confirms re-offer is tied to real new
    // engagement, not a clock.
    await sql`
      INSERT INTO marker_trajectory (user_id, marker_type, marker_value, reshape_count, depth_stage, depth_stage_updated_at)
      VALUES (${userId}, 'pattern', 'a fourth integrated pattern', 3, 'integrated', now())
    `;
    elig = await getEligibility(userId);
    check('dismissal: a 4th integration re-opens the invitation (count-based, not time-based)', elig.status === 'invited' && elig.integratedCount === 4);

    // ── Length validation ────────────────────────────────────────────────
    let rangeThrew = false;
    try {
      await saveNewStatement(userId, 'too short', sourceIds);
    } catch (e) {
      rangeThrew = e instanceof RangeError;
    }
    check('a body_text under the minimum length is rejected', rangeThrew);
  } finally {
    await sql`DELETE FROM core_myth_statement WHERE user_id = ${userId}`;
    await sql`DELETE FROM core_myth_invitation_dismissal WHERE user_id = ${userId}`;
    await sql`DELETE FROM marker_trajectory WHERE user_id = ${userId}`;
    await sql`DELETE FROM elder_user WHERE id = ${userId}`;
  }

  if (failures > 0) {
    console.error(`\n${failures} test(s) failed`);
    process.exit(1);
  }
  console.log('\nAll Core Myth Statement race, versioning, and eligibility tests passed.');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
