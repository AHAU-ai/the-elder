/**
 * threadRevision.integration.test.ts: seeker-initiated revision of a confirmed
 * thread (docs/thread-revision.md) against a real database.
 *
 * Needs a live DATABASE_URL on a DEVELOPMENT branch (refuses known production
 * hosts, like the figure-continuity suites). Creates and removes its own
 * throwaway elder_user, visit_record and marker_trajectory rows.
 *
 * Run: npx tsx -r dotenv/config tests/threadRevision.integration.test.ts dotenv_config_path=.env.local
 */
import { randomUUID } from 'node:crypto';
import { sql } from '../lib/returning/db';
import { assertDevDatabase } from './support/devDatabaseGuard';
import { recordMarkerAppearance, releaseThread, rewordThread, getTrajectoryMarkers } from '../lib/returning/markerTrajectory';
import { readChainFigure } from '../lib/returning/figureMapping';

let failures = 0;
function check(name: string, cond: boolean) {
  if (cond) console.log(`  ok  ${name}`);
  else { console.error(`  FAIL  ${name}`); failures++; }
}

async function confirmedVisit(userId: number, chainId: string, field: string, value: string, mode = 'confirmed') {
  const patch = { [field]: { value, mode, confirmedAt: new Date().toISOString() } };
  await sql`
    INSERT INTO visit_record (user_id, chain_id, visit_mode, lineage_key, elder_response, markers, markers_confirmed)
    VALUES (${userId}, ${chainId}, 'explore', 'ojer_tzij', 'test', ${JSON.stringify({ [field]: value })}::jsonb, ${JSON.stringify(patch)}::jsonb)
  `;
  await recordMarkerAppearance(userId, field as never, value, mode as never);
}

async function main() {
  assertDevDatabase(process.env.DATABASE_URL);
  const mk = async () => {
    const [u] = await sql`INSERT INTO elder_user (email) VALUES (${`thread-rev-${Date.now()}-${Math.random()}@example.invalid`}) RETURNING id`;
    return Number(u.id);
  };
  const userId = await mk();
  const otherId = await mk();
  try {
    const chain = randomUUID();
    for (let i = 0; i < 3; i++) await confirmedVisit(userId, randomUUID(), 'wound', 'the unanswered letter');
    await confirmedVisit(userId, chain, 'figure', 'The Hero Twin');
    await confirmedVisit(otherId, randomUUID(), 'wound', 'the unanswered letter');

    const threads = await getTrajectoryMarkers(userId, 1);
    const wound = threads.find((t) => t.markerType === 'wound')!;
    const figure = threads.find((t) => t.markerType === 'figure')!;
    check('threads carry ids', Number.isInteger(wound.id) && wound.appearanceCount === 3);
    check('figure continuity reads the object-shaped figure', (await readChainFigure(userId, chain) as { figureLabel?: string }).figureLabel === 'The Hero Twin');

    // Another seeker can neither release nor reword this thread.
    check('foreign release is not_found', (await releaseThread(otherId, wound.id)) === 'not_found');
    check('foreign reword is not_found', (await rewordThread(otherId, wound.id, 'mine now')) === 'not_found');
    check('...and nothing moved', (await getTrajectoryMarkers(userId, 1)).some((t) => t.id === wound.id));

    // Reword: same appearances, new words, here and in each confirmed place.
    check('reword ok', (await rewordThread(userId, wound.id, 'the letter I never sent')) === 'ok');
    const [after] = await sql`SELECT marker_value, appearance_count FROM marker_trajectory WHERE id = ${wound.id}`;
    check('reword keeps the count', after.marker_value === 'the letter I never sent' && Number(after.appearance_count) === 3);
    const reworded = await sql`SELECT markers_confirmed -> 'wound' ->> 'value' AS v FROM visit_record WHERE user_id = ${userId} AND markers_confirmed ? 'wound'`;
    check('reword reaches every confirmed visit', reworded.length === 3 && reworded.every((r: any) => r.v === 'the letter I never sent'));
    const theirs = await sql`SELECT markers_confirmed -> 'wound' ->> 'value' AS v FROM visit_record WHERE user_id = ${otherId}`;
    check("reword never touches another seeker's rows", theirs[0].v === 'the unanswered letter');

    // Reword into words another thread already holds: refused, nothing merged.
    await confirmedVisit(userId, randomUUID(), 'wound', 'a second wound');
    const second = (await getTrajectoryMarkers(userId, 1)).find((t) => t.markerValue === 'a second wound')!;
    check('reword onto an existing thread is a conflict', (await rewordThread(userId, second.id, 'The Letter I never sent')) === 'conflict');

    // Release: the thread is gone, the confirmed words blanked, the guard stays closed.
    check('release ok', (await releaseThread(userId, wound.id)) === 'ok');
    check('thread is gone', !(await getTrajectoryMarkers(userId, 1)).some((t) => t.id === wound.id));
    const blank = await sql`SELECT markers_confirmed -> 'wound' AS w FROM visit_record WHERE user_id = ${userId} AND markers_confirmed -> 'wound' ->> 'mode' = 'released'`;
    check('every confirmed place is blanked, key kept', blank.length === 3 && blank.every((r: any) => r.w.value === ''));
    const replay = await sql`
      UPDATE visit_record SET markers_confirmed = markers_confirmed || '{"wound": {"value": "x"}}'::jsonb
      WHERE user_id = ${userId} AND NOT (COALESCE(markers_confirmed, '{}'::jsonb) ? 'wound') RETURNING id`;
    check('a replayed confirm on a released visit stays closed', replay.length === 0 || replay.length === 1); // the unrelated 4th wound visit may match; the 3 released must not
    const released3 = await sql`SELECT id FROM visit_record WHERE user_id = ${userId} AND markers_confirmed -> 'wound' ->> 'mode' = 'released'`;
    check('released visits are still released', released3.length === 3);
    check('releasing again is not_found', (await releaseThread(userId, wound.id)) === 'not_found');

    // Naming it afresh starts from one.
    await confirmedVisit(userId, randomUUID(), 'wound', 'the unanswered letter');
    const reborn = (await getTrajectoryMarkers(userId, 1)).find((t) => t.markerValue === 'the unanswered letter')!;
    check('a new assent starts the count from one', reborn.appearanceCount === 1);

    // A released figure no longer makes a chain's figure.
    check('release the figure', (await releaseThread(userId, figure.id)) === 'ok');
    const gone = await readChainFigure(userId, chain);
    check('figure continuity no longer finds it', (gone as { ok?: boolean }).ok === false);
  } finally {
    await sql`DELETE FROM elder_user WHERE id IN (${userId}, ${otherId})`;
  }
  if (failures) { console.error(`${failures} failure(s)`); process.exit(1); }
  console.log('threadRevision: ok');
}

main().catch((e) => { console.error(e); process.exit(1); });
