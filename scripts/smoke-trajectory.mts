// Smoke test: confirm -> floor -> speak loop for Axis 2 marker trajectory.
// Creates a throwaway elder_user, records the same marker 3x, checks that it
// stays silent below MIN_APPEARANCES_TO_SURFACE and surfaces in the spoken
// trajectory context at the floor, then deletes the user (ON DELETE CASCADE
// cleans marker_trajectory). Run from the repo root with .env.local loaded:
//   npx tsx --env-file=.env.local <this file>
import { sql } from '@/lib/returning/db';
import { trajectoryEnabled } from '@/config/returning-features';
import {
  recordMarkerAppearance,
  getTrajectoryMarkers,
  MIN_APPEARANCES_TO_SURFACE,
} from '@/lib/returning/markerTrajectory';
import { buildTrajectoryContext } from '@/lib/returning/trajectoryContext';

const MARKER_VALUE = 'a smoke-test wound that keeps returning';
const results: { name: string; ok: boolean; detail: string }[] = [];
const check = (name: string, ok: boolean, detail = '') => {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`);
};

async function main() {
  check('trajectoryEnabled() is true (env gate open)', trajectoryEnabled() === true);
  check('MIN_APPEARANCES_TO_SURFACE is 3', MIN_APPEARANCES_TO_SURFACE === 3, String(MIN_APPEARANCES_TO_SURFACE));

  const email = `smoke+traj-${Date.now()}@example.invalid`;
  const [u] = await sql`INSERT INTO elder_user (email) VALUES (${email}) RETURNING id`;
  const userId = Number(u.id);
  console.log(`\n(created throwaway elder_user id=${userId})\n`);

  try {
    await recordMarkerAppearance(userId, 'wound', MARKER_VALUE);
    await recordMarkerAppearance(userId, 'wound', MARKER_VALUE);
    const belowFloor = await getTrajectoryMarkers(userId);
    check('silent at 2 confirmations (below floor)', belowFloor.length === 0, `${belowFloor.length} surfaced`);
    const ctx2 = await buildTrajectoryContext(userId);
    check('spoken context empty at 2 confirmations', ctx2 === '', JSON.stringify(ctx2.slice(0, 60)));

    await recordMarkerAppearance(userId, 'wound', MARKER_VALUE);
    const atFloor = await getTrajectoryMarkers(userId);
    check('surfaces at 3 confirmations (floor crossed)', atFloor.length === 1, `${atFloor.length} surfaced`);
    check('appearance_count is 3', atFloor[0]?.appearanceCount === 3, String(atFloor[0]?.appearanceCount));

    const ctx3 = await buildTrajectoryContext(userId);
    check('spoken context names the marker value', ctx3.includes(MARKER_VALUE), JSON.stringify(ctx3));
    check('spoken context carries "returning since"', /returning since/.test(ctx3));
    check('spoken context does NOT leak a raw count', !/\b3\b/.test(ctx3.replace(MARKER_VALUE, '')));
  } finally {
    await sql`DELETE FROM elder_user WHERE id = ${userId}`;
    const [left] = await sql`SELECT count(*)::int AS n FROM marker_trajectory WHERE user_id = ${userId}`;
    check('cleanup: throwaway user + marker rows removed', left.n === 0, `${left.n} rows left`);
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${failed.length === 0 ? 'ALL PASS' : `${failed.length} FAILED`} (${results.length} checks)`);
  process.exit(failed.length === 0 ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
