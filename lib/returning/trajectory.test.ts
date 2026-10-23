// The movement classifier against the shape the database actually stores:
// visit_record.markers_confirmed = { [field]: { value, mode, confirmedAt } }.
// Before the markerText() fix, every case below that carried a confirmed marker
// threw inside readTrajectory and the route read it as ARRIVING.
import assert from 'node:assert/strict';

const ENV = ['ELDER_TRAJECTORY_ENABLED', 'MARKER_CONFIRMATION_READY', 'CEILING_RATIFIED', 'HEARTH_RESPONDS_TO_MOVEMENT_ENABLED', 'TRAJECTORY_ALL_SEEKERS'];
const saved = Object.fromEntries(ENV.map((k) => [k, process.env[k]]));

async function main() {
  // FEATURES freezes ELDER_TRAJECTORY at import, so light the gates first.
  process.env.ELDER_TRAJECTORY_ENABLED = 'true';
  process.env.MARKER_CONFIRMATION_READY = 'true';
  process.env.CEILING_RATIFIED = 'true';
  const { readTrajectory } = await import('./trajectory');
  type V = Parameters<typeof readTrajectory>[0][number];

  const c = (value: string) => ({ value, mode: 'confirmed', confirmedAt: '2026-10-01T00:00:00Z' });
  const visit = (over: Partial<V> & { confirmedObj?: Record<string, unknown> }, i: number): V => ({
    visitId: `v${i}`, chainId: 'chain-a', mode: 'explore', lineageKey: 'maya', mythTitle: '', archetype: '',
    depth: i + 1, timestamp: `2026-10-0${i + 1}T00:00:00Z`, elderResponse: '', markers: {},
    markersConfirmed: over.confirmedObj as never, ...over,
  }) as V;
  const grief = { griefSignal: false };

  assert.equal(readTrajectory([visit({}, 0)], grief).movement, 'ARRIVING', 'one visit is an arrival');

  // The same wound twice, never resolved into a pattern: circling (real, object-shaped data).
  const circling = [
    visit({ confirmedObj: { wound: c('the unanswered letter') } }, 0),
    visit({ confirmedObj: { wound: c('The unanswered letter') } }, 1),
    visit({ confirmedObj: {} }, 2),
  ];
  assert.equal(readTrajectory(circling, grief).movement, 'CIRCLING');

  // A pattern now stands where a threshold was: crossing.
  const crossing = [
    visit({ confirmedObj: { threshold: c('leaving the house') } }, 0),
    visit({ confirmedObj: { pattern: c('I wait to be asked') } }, 1),
  ];
  assert.equal(readTrajectory(crossing, grief).movement, 'CROSSING');

  // The old string shape still reads (any fixture or historical row that has it).
  const legacy = [
    visit({ confirmedObj: { wound: 'a door' } }, 0),
    visit({ confirmedObj: { wound: 'a door' } }, 1),
    visit({ confirmedObj: {} }, 2),
  ];
  assert.equal(readTrajectory(legacy, grief).movement, 'CIRCLING');

  // Fresh chains every time, never deepening: ranging.
  const ranging = [0, 1, 2].map((i) => visit({ chainId: `c${i}`, confirmedObj: {} }, i));
  assert.equal(readTrajectory(ranging, grief).movement, 'RANGING');

  // Grief overrides to the honoring register; junk markers never throw.
  assert.equal(readTrajectory(circling, { griefSignal: true }).movement, 'DESCENDING');
  const junk = [visit({ confirmedObj: { wound: 42, figure: null, pattern: { value: 7 } } }, 0), visit({ confirmedObj: { wound: [] } }, 1)];
  assert.doesNotThrow(() => readTrajectory(junk, grief));

  // Axis 4 end to end on real-shaped data: a circling seeker's fire gets the
  // same warm trace as a descending one, never less than neutral.
  process.env.HEARTH_RESPONDS_TO_MOVEMENT_ENABLED = 'true';
  const { readHearthWarmth } = await import('./hearthRead');
  const deps = (visits: V[]) => ({
    isTester: async () => true,
    effectiveTierIsKeptPlus: async () => true,
    recentVisits: async () => visits,
  });
  assert.equal(await readHearthWarmth(1, deps(circling)), 0.04);
  assert.equal(await readHearthWarmth(1, deps(crossing)), 0.06);
  assert.equal(await readHearthWarmth(1, deps(ranging)), 0);
  assert.equal(await readHearthWarmth(1, deps([visit({}, 0)])), 0);
  // Stage 1: a non-tester gets nothing until TRAJECTORY_ALL_SEEKERS.
  assert.equal(await readHearthWarmth(1, { ...deps(circling), isTester: async () => false }), 0);
  process.env.TRAJECTORY_ALL_SEEKERS = 'true';
  assert.equal(await readHearthWarmth(1, { ...deps(circling), isTester: async () => false }), 0.04);
  // Free tier: nothing.
  assert.equal(await readHearthWarmth(1, { ...deps(circling), effectiveTierIsKeptPlus: async () => false }), 0);

  console.log('trajectory: ok');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => ENV.forEach((k) => (saved[k] === undefined ? delete process.env[k] : (process.env[k] = saved[k]))));
