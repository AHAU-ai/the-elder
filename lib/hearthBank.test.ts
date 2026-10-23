import assert from 'node:assert/strict';
import {
  bankLevel,
  bankVeilOpacity,
  BANK_FREE_DAYS,
  BANK_FULL_DAYS,
  BANK_VEIL_MAX,
} from './hearthBank';

const DAY = 24 * 60 * 60 * 1000;

assert.equal(bankLevel(0), 0, 'just here: lit');
assert.equal(bankLevel(DAY), 0, 'a day away: lit');
assert.equal(bankLevel(BANK_FREE_DAYS * DAY), 0, 'exactly the free window: still lit');
assert.ok(bankLevel((BANK_FREE_DAYS + 0.5) * DAY) > 0, 'just past the free window: begins');
assert.equal(bankLevel(BANK_FULL_DAYS * DAY), 1, 'full bank at the full window');
assert.equal(bankLevel(365 * DAY), 1, 'a year away is no deeper than three weeks');

// bad input never banks the fire
for (const g of [-5 * DAY, NaN, Infinity, -Infinity]) assert.equal(bankLevel(g), 0, `bad gap ${g}`);

// monotone non-decreasing in the gap, bounded 0..1
let prev = 0;
for (let h = 0; h <= 60 * 24; h++) {
  const l = bankLevel(h * 60 * 60 * 1000);
  assert.ok(l >= prev - 1e-12 && l >= 0 && l <= 1, `monotone/bounded at ${h}h`);
  prev = l;
}

// The floor: even full bank leaves the fire clearly lit.
assert.equal(bankVeilOpacity(1), BANK_VEIL_MAX);
assert.ok(BANK_VEIL_MAX <= 0.3, 'veil never past a light dimming');
assert.equal(bankVeilOpacity(0), 0);
assert.equal(bankVeilOpacity(-1), 0);
assert.equal(bankVeilOpacity(9), BANK_VEIL_MAX);

// Subtle: a week away is meaningfully less than three weeks.
assert.ok(bankLevel(7 * DAY) < 0.5 * bankLevel(BANK_FULL_DAYS * DAY) + 0.01 || bankLevel(7 * DAY) < 0.5, 'a week is well short of full');

console.log('hearthBank tests passed');
