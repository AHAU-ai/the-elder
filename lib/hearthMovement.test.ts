import assert from 'node:assert/strict';
import { clampWarmth, warmthFor, WARMTH_MAX } from './hearthMovement';

const MOVEMENTS = ['ARRIVING', 'DESCENDING', 'CIRCLING', 'RANGING', 'CROSSING'];

// Warm-only and bounded: no movement ever takes light from the fire.
for (const m of MOVEMENTS) {
  const w = warmthFor(m);
  assert.ok(w >= 0 && w <= WARMTH_MAX, `${m} within [0, max]`);
}
// Coarse: the fire cannot tell a seeker they are circling.
assert.equal(warmthFor('CIRCLING'), warmthFor('DESCENDING'));
assert.equal(warmthFor('ARRIVING'), 0);
assert.equal(warmthFor('RANGING'), 0);
assert.ok(new Set(MOVEMENTS.map(warmthFor)).size <= 3, 'at most three distinguishable tones');
// Unknown input is neutral.
assert.equal(warmthFor('FLEEING'), 0);
assert.equal(warmthFor(''), 0);
// Subtle: well under the glow layer's own maximum (0.16 in HearthHour).
assert.ok(WARMTH_MAX <= 0.16 / 2);
// Whatever the network hands the client is clamped.
for (const [raw, want] of [[0.05, 0.05], [-1, 0], [9, WARMTH_MAX], ['x', 0], [NaN, 0], [null, 0], [undefined, 0], [Infinity, 0]] as const) {
  assert.equal(clampWarmth(raw), want, String(raw));
}

async function main() {
  const ENV = ['HEARTH_RESPONDS_TO_MOVEMENT_ENABLED', 'ELDER_TRAJECTORY_ENABLED', 'MARKER_CONFIRMATION_READY', 'CEILING_RATIFIED', 'TRAJECTORY_ALL_SEEKERS'];
  const saved = Object.fromEntries(ENV.map((k) => [k, process.env[k]]));
  const restore = () => ENV.forEach((k) => (saved[k] === undefined ? delete process.env[k] : (process.env[k] = saved[k])));
  try {
    ENV.forEach((k) => delete process.env[k]);
    const { readHearthWarmth } = await import('./returning/hearthRead');
    let touched = 0;
    const deps = {
      isTester: async () => { touched++; return true; },
      effectiveTierIsKeptPlus: async () => { touched++; return true; },
      recentVisits: async () => { touched++; return []; },
    };
    assert.equal(await readHearthWarmth(1, deps), 0, 'dark');
    assert.equal(touched, 0, 'dark means no reads at all');

    // The flip alone is not enough: trajectory's own gates must hold too.
    process.env.HEARTH_RESPONDS_TO_MOVEMENT_ENABLED = 'true';
    assert.equal(await readHearthWarmth(1, deps), 0, 'flip without trajectory gates');
    assert.equal(touched, 0);

    // A failing read is neutral, not a guess.
    const { hearthRespondsToMovementEnabled } = await import('../config/returning-features');
    assert.equal(hearthRespondsToMovementEnabled(), false, 'trajectory gates still closed (ELDER_TRAJECTORY frozen off)');
    assert.equal(await readHearthWarmth(1, { ...deps, recentVisits: async () => { throw new Error('db'); } }), 0);
  } finally {
    restore();
  }
  console.log('hearthMovement: ok');
}
main().catch((e) => { console.error(e); process.exit(1); });
