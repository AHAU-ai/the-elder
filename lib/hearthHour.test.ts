import assert from 'node:assert/strict';
import { hearthToneAt, localHour, GLOW_FLOOR, VEIL_CEILING } from './hearthHour';

// Bounds hold at every minute of the day -- the room is never dim or out.
for (let m = 0; m < 24 * 60; m++) {
  const t = hearthToneAt(m / 60);
  assert.ok(t.glow >= GLOW_FLOOR && t.glow <= 1, `glow in bounds at minute ${m}`);
  assert.ok(t.veil >= 0 && t.veil <= VEIL_CEILING, `veil in bounds at minute ${m}`);
}

// Midnight wraps seamlessly (no jump across the day boundary).
const a = hearthToneAt(23.999), b = hearthToneAt(0);
assert.ok(Math.abs(a.glow - b.glow) < 0.01 && Math.abs(a.veil - b.veil) < 0.01, 'wraps at midnight');
assert.deepEqual(hearthToneAt(24), hearthToneAt(0));
assert.deepEqual(hearthToneAt(-1), hearthToneAt(23));

// Smooth: no minute-to-minute step larger than a hair.
let prev = hearthToneAt(0);
for (let m = 1; m <= 24 * 60; m++) {
  const t = hearthToneAt(m / 60);
  assert.ok(Math.abs(t.glow - prev.glow) < 0.02 && Math.abs(t.veil - prev.veil) < 0.01, `smooth at minute ${m}`);
  prev = t;
}

// Shape: the plainest the fire looks is midday; night is warmer than noon.
assert.ok(hearthToneAt(13).glow < hearthToneAt(22).glow, 'night warmer than midday');
assert.ok(hearthToneAt(13).veil === 0, 'no veil at midday');

// localHour reads the device clock's own hours and minutes.
assert.equal(localHour(new Date(2026, 9, 3, 18, 30)), 18.5);

console.log('hearthHour tests passed');
