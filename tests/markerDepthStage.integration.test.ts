/**
 * markerDepthStage.integration.test.ts — Adversarial race test for the
 * depth-stage transition write path (migration 020).
 *
 * The original replay-double-count bug (confirm-marker/route.ts's own
 * header comment) existed because a read-then-write merge was assumed
 * race-safe under concurrent double-submit without being tested that way.
 * This test replicates that exact shape against the NEW logic
 * (recordMarkerAppearance's depth-stage computation + recordDepthTransition)
 * rather than assuming the existing atomic guard protects it for free.
 *
 * Requires a live DATABASE_URL — this is an integration test, not a
 * hermetic one (same category as tests/corpusRetrieval.integration.test.ts).
 * Run: npx tsx tests/markerDepthStage.integration.test.ts
 *
 * Creates and cleans up its own throwaway elder_user/visit_record rows —
 * never touches real seeker data.
 */
import { sql } from '../lib/returning/db';
import { recordMarkerAppearance, recordDepthTransition } from '../lib/returning/markerTrajectory';

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
// exactly (lines ~141-167 of that file) -- this is the real concurrency
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

  const transition = await recordMarkerAppearance(userId, field as any, storedValue, mode);
  if (transition) {
    await recordDepthTransition(userId, field as any, transition.trajectoryId, transition.fromStage, transition.toStage, visitId);
  }
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
    // This is the exact double-submit shape that caused the original bug.
    // Only one must win; the other must see already_recorded.
    const v1 = await makeVisit();
    const [r1a, r1b] = await Promise.all([
      simulateConfirm(userId, v1, 'wound', 'reshaped', markerValue),
      simulateConfirm(userId, v1, 'wound', 'reshaped', markerValue),
    ]);
    const results1 = [r1a, r1b].sort();
    check('round 1: exactly one recorded, one already_recorded', results1[0] === 'already_recorded' && results1[1] === 'recorded');

    let [traj] = await sql`SELECT reshape_count, appearance_count, depth_stage FROM marker_trajectory WHERE user_id=${userId} AND marker_type='wound' AND lower(marker_value)=lower(${markerValue})`;
    check('round 1: reshape_count is 1, not 2 (no double-count)', Number(traj.reshape_count) === 1);
    check('round 1: appearance_count is 1, not 2', Number(traj.appearance_count) === 1);
    check('round 1: stage moved surface -> confronted', traj.depth_stage === 'confronted');

    let transitions = await sql`SELECT from_stage, to_stage FROM marker_depth_transition WHERE user_id=${userId} AND marker_type='wound'`;
    check('round 1: exactly one transition row written, not two', transitions.length === 1);
    if (transitions.length > 0) {
      check('round 1: transition recorded as surface -> confronted', transitions[0].from_stage === 'surface' && transitions[0].to_stage === 'confronted');
    }

    // ── Rounds 2-3: two more genuine (sequential, different visits) ────
    // reshapes to cross INTEGRATED_AT_RESHAPE_COUNT (3) -- then fire the
    // THIRD (threshold-crossing) reshape concurrently with itself too, to
    // confirm the confronted -> integrated transition is equally race-safe,
    // not just the surface -> confronted one exercised above.
    const v2 = await makeVisit();
    await simulateConfirm(userId, v2, 'wound', 'reshaped', markerValue);

    const v3 = await makeVisit();
    const v3b = await makeVisit(); // a second visit for the concurrent duplicate to (wrongly) target if the guard failed
    const [r3a, r3b] = await Promise.all([
      simulateConfirm(userId, v3, 'wound', 'reshaped', markerValue),
      simulateConfirm(userId, v3, 'wound', 'reshaped', markerValue), // same visit id on purpose -- the actual adversarial case
    ]);
    const results3 = [r3a, r3b].sort();
    check('round 3 (threshold-crossing transition): exactly one recorded', results3[0] === 'already_recorded' && results3[1] === 'recorded');

    ;[traj] = await sql`SELECT reshape_count, depth_stage FROM marker_trajectory WHERE user_id=${userId} AND marker_type='wound' AND lower(marker_value)=lower(${markerValue})`;
    check('round 3: reshape_count is exactly 3 (1 + 1 + 1, no double-count)', Number(traj.reshape_count) === 3);
    check('round 3: stage moved confronted -> integrated', traj.depth_stage === 'integrated');

    transitions = await sql`SELECT from_stage, to_stage FROM marker_depth_transition WHERE user_id=${userId} AND marker_type='wound' ORDER BY created_at`;
    check('round 3: exactly two transitions total (surface->confronted, confronted->integrated)', transitions.length === 2);
    if (transitions.length === 2) {
      check('round 3: second transition is confronted -> integrated, not duplicated', transitions[1].from_stage === 'confronted' && transitions[1].to_stage === 'integrated');
    }

    // ── Regression floor: stage never moves backward ────────────────────
    // A plain 'confirmed' (not reshaped) response after integration must
    // never regress the stage, even though it still bumps appearance_count.
    const v4 = await makeVisit();
    await simulateConfirm(userId, v4, 'wound', 'confirmed', markerValue);
    ;[traj] = await sql`SELECT depth_stage FROM marker_trajectory WHERE user_id=${userId} AND marker_type='wound' AND lower(marker_value)=lower(${markerValue})`;
    check('a plain confirm after integration does not regress the stage', traj.depth_stage === 'integrated');

    await sql`DELETE FROM visit_record WHERE id IN (${v3b}::uuid)`; // the unused fixture visit
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
  console.log('\nAll marker depth-stage race/regression tests passed.');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
