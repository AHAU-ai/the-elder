import assert from 'node:assert/strict';
import { BREATH_PHASES } from './breathTiming';
import {
  FIRE_MEDITATION_ROUTE,
  MEDITATION_FIRE_HIGH,
  MEDITATION_FIRE_LOW,
  meditationFireIntensity,
} from './fireMeditation';

assert.equal(FIRE_MEDITATION_ROUTE, '/fire-meditation');

// Every breath phase maps to an in-bounds intensity, and the fire never leaves
// its ordinary range (it never surges, never gutters).
for (const p of BREATH_PHASES) {
  const v = meditationFireIntensity(p.name);
  assert.ok(v >= MEDITATION_FIRE_LOW && v <= MEDITATION_FIRE_HIGH, `${p.name} in bounds`);
  assert.ok(v > 0.22 && v < 0.85, `${p.name} stays in the fire's ordinary range`);
}

// It rises with the inhale, holds, and settles with the exhale.
assert.equal(meditationFireIntensity('inhale'), MEDITATION_FIRE_HIGH);
assert.equal(meditationFireIntensity('hold'), MEDITATION_FIRE_HIGH);
assert.equal(meditationFireIntensity('exhale'), MEDITATION_FIRE_LOW);
assert.equal(meditationFireIntensity('rest-low'), MEDITATION_FIRE_LOW);

console.log('fireMeditation: ok');
