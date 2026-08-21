/**
 * markerDepthStage.integration.test.ts — Adversarial race test for the
 * depth-stage propose/affirm write path (migrations 020/021).
 *
 * The original replay-double-count bug (confirm-marker/route.ts's own
 * header comment) existed because a read-then-write merge was assumed
 * race-safe under concurrent double-submit without being tested that way.
 * This test replicates that exact shape against BOTH new writes this
 * feature adds: proposing a stage-up (recordMarkerAppearance) and
 * affirming one (affirmPendingStage) — rather than assuming the existing
 * atomic guard protects the new logic for free.
 *
 * Requires a live DATABASE_URL — this is an integration test, not a
 * hermetic one (same category as tests/corpusRetrieval.integration.test.ts).
 * Run: npx tsx -r dotenv/config tests/markerDepthStage.integration.test.ts dotenv_config_path=.env.local
 *
 * Creates and cleans up its own throwaway elder_user/visit_record rows —
 * never touches real seeker data.
 */
import { sql } from '../lib/returning/db';
import { recordMarkerAppearance, affirmPendingStage, declinePendingStage } from '../lib/returning/markerTrajectory';

let failures = 0;
function check(name: string, cond: boolean) {
  if (cond) {
    console.log(`  ok  ${name}`);
  } else {
    console.error(`  FAIL  ${name}`);
    failures++;
  }
}

// Mirrors confirm-marker/route.ts's own atomic guard + write sequence
// exactly (lines ~141-166 of that file) -- this is the real concurrency
// boundary under test, not a reimplementation invented for this test.
async function simulateConfirm(
  userId: number,
  visitId: string,
  field: string,
  mode: 'confirmed' | 'reshaped',
  storedValue: string
): Promise<'recorded' | 'already_recorded'> {
  const patch = { [field]: { value: storedValue, mode, confirmedAt: new Date().toISOString() } };
  const wrote = await sql`
    UPDATE visit_record
    SET markers_confirmed = COALESCE(markers_confirmed, '{}'::jsonb) || ${JSON.stringify(patch)}::jsonb
    WHERE id = ${visitId} AND user_id = ${userId}
      AND NOT (COALESCE(markers_confirmed, '{}'::jsonb) ? ${field})
    RETURNING id
  `;
  if (wrote.length === 0) return 'already_recorded';
  await recordMarkerAppearance(userId, field as any, storedValue, mode);
  return 'recorded';
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL required for this integration test.');
    process.exit(1);
  }

  const email = `depth-stage-test-${Date.now()}@example.invalid`;
  const [user] = await sql`INSERT INTO elder_user (email) VALUES (${email}) RETURNING id`;
  const userId = Number(user.id);
  const markerValue = 'a test wound that recurs';

  async function makeVisit(): Promise<string> {
    const [visit] = await sql`
      INSERT INTO visit_record (user_id, chain_id, visit_mode, elder_response, markers)
      VALUES (${userId}, gen_random_uuid(), 'explore', 'test response', ${JSON.stringify({ wound: markerValue })}::jsonb)
      RETURNING id
    `;
    return visit.id as string;
  }

  try {
    // ── Round 1: two concurrent reshapes for the SAME visit+field ──────
    // Exact double-submit shape that caused the original bug. Only one
    // must win the visit_record guard; both must agree on ONE proposal.
    const v1 = await makeVisit();
    const [r1a, r1b] = await Promise.all([
      simulateConfirm(userId, v1, 'wound', 'reshaped', markerValue),
      simulateConfirm(userId, v1, 'wound', 'reshaped', markerValue),
    ]);
    const results1 = [r1a, r1b].sort();
    check('round 1: exactly one recorded, one already_recorded', results1[0] === 'already_recorded' && results1[1] === 'recorded');

    let [traj] = await sql`SELECT id, reshape_count, appearance_count, depth_stage, pending_stage FROM marker_trajectory WHERE user_id=${userId} AND marker_type='wound' AND lower(marker_value)=lower(${markerValue})`;
    const trajectoryId = Number(traj.id);
    check('round 1: reshape_count is 1, not 2 (no double-count)', Number(traj.reshape_count) === 1);
    check('round 1: depth_stage is still surface (not yet affirmed)', traj.depth_stage === 'surface');
    check('round 1: pending_stage proposed as confronted', traj.pending_stage === 'confronted');

    let transitions = await sql`SELECT from_stage, to_stage FROM marker_depth_transition WHERE user_id=${userId} AND marker_type='wound'`;
    check('round 1: no transition row yet (nothing affirmed)', transitions.length === 0);

    // ── Round 2: two concurrent AFFIRMATIONS of the same proposal ──────
    // The other half of the adversarial concern -- the seeker's own
    // confirm action must be equally race-safe.
    const [a1, a2] = await Promise.all([
      affirmPendingStage(userId, trajectoryId, v1),
      affirmPendingStage(userId, trajectoryId, v1),
    ]);
    const affirmResults = [a1, a2].filter(Boolean);
    check('round 2: exactly one affirmation actually wins', affirmResults.length === 1);

    ;[traj] = await sql`SELECT depth_stage, pending_stage FROM marker_trajectory WHERE id=${trajectoryId}`;
    check('round 2: depth_stage now confronted', traj.depth_stage === 'confronted');
    check('round 2: pending_stage cleared', traj.pending_stage === null);

    transitions = await sql`SELECT from_stage, to_stage FROM marker_depth_transition WHERE user_id=${userId} AND marker_type='wound'`;
    check('round 2: exactly one transition row, not two', transitions.length === 1);
    if (transitions.length === 1) {
      check('round 2: transition recorded as surface -> confronted', transitions[0].from_stage === 'surface' && transitions[0].to_stage === 'confronted');
    }

    // ── Decline path: propose again, then decline, then re-propose ─────
    // Confronted was reached at reshape_count=1 (round 1/2 above);
    // INTEGRATED_AT_RESHAPE_COUNT=3, so this needs TWO more reshapes
    // (count 2, then 3) before a proposal appears again -- the first of
    // the two intentionally does NOT propose anything yet.
    const v2 = await makeVisit();
    await simulateConfirm(userId, v2, 'wound', 'reshaped', markerValue);
    ;[traj] = await sql`SELECT pending_stage, reshape_count FROM marker_trajectory WHERE id=${trajectoryId}`;
    check('decline path: reshape_count is 2 after this reshape', Number(traj.reshape_count) === 2);
    check('decline path: no proposal yet at count 2 (integrated needs 3)', traj.pending_stage === null);

    const v2b = await makeVisit();
    await simulateConfirm(userId, v2b, 'wound', 'reshaped', markerValue);
    ;[traj] = await sql`SELECT pending_stage FROM marker_trajectory WHERE id=${trajectoryId}`;
    check('decline path: the third reshape proposes integrated', traj.pending_stage === 'integrated');

    const declined = await declinePendingStage(userId, trajectoryId);
    check('decline path: decline succeeds', declined === true);
    ;[traj] = await sql`SELECT depth_stage, pending_stage, reshape_count FROM marker_trajectory WHERE id=${trajectoryId}`;
    check('decline path: depth_stage unchanged (still confronted)', traj.depth_stage === 'confronted');
    check('decline path: pending_stage cleared, nothing lost from reshape_count', traj.pending_stage === null && Number(traj.reshape_count) === 3);

    const v3 = await makeVisit();
    await simulateConfirm(userId, v3, 'wound', 'reshaped', markerValue);
    ;[traj] = await sql`SELECT pending_stage FROM marker_trajectory WHERE id=${trajectoryId}`;
    check('decline path: a later reshape re-proposes the same target (nothing lost)', traj.pending_stage === 'integrated');

    const secondAffirm = await affirmPendingStage(userId, trajectoryId, v3);
    check('decline path: re-proposed integration can still be affirmed', secondAffirm?.toStage === 'integrated');

    // ── Regression floor: a plain confirm never regresses the stage ────
    const v4 = await makeVisit();
    await simulateConfirm(userId, v4, 'wound', 'confirmed', markerValue);
    ;[traj] = await sql`SELECT depth_stage, pending_stage FROM marker_trajectory WHERE id=${trajectoryId}`;
    check('a plain confirm after integration does not regress the stage', traj.depth_stage === 'integrated');
    check('a plain confirm never proposes anything (only reshapes do)', traj.pending_stage === null);

    // ── An affirmation attempt with nothing pending is a safe no-op ────
    const noopAffirm = await affirmPendingStage(userId, trajectoryId, null);
    check('affirming with nothing pending returns null, does not throw', noopAffirm === null);
  } finally {
    // Cleanup — never leave test fixtures in a real database.
    await sql`DELETE FROM marker_depth_transition WHERE user_id = ${userId}`;
    await sql`DELETE FROM marker_trajectory WHERE user_id = ${userId}`;
    await sql`DELETE FROM visit_record WHERE user_id = ${userId}`;
    await sql`DELETE FROM elder_user WHERE id = ${userId}`;
  }

  if (failures > 0) {
    console.error(`\n${failures} test(s) failed`);
    process.exit(1);
  }
  console.log('\nAll marker depth-stage propose/affirm race and regression tests passed.');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
