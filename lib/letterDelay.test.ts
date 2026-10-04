import assert from 'node:assert/strict';
import {
  LETTER_DELAY_CHOICES,
  DEFAULT_LETTER_DELAY_DAYS,
  LETTER_DELAY_LABELS,
  parseLetterDelay,
} from './letterDelay';

assert.deepEqual([...LETTER_DELAY_CHOICES], [3, 30, 90], 'closed set is exactly 3 / 30 / 90');
assert.equal(DEFAULT_LETTER_DELAY_DAYS, 3, 'default is the original behaviour');
assert.ok(Math.min(...LETTER_DELAY_CHOICES) >= 3, 'no short delay that would make the email a nudge');
for (const d of LETTER_DELAY_CHOICES) assert.ok(LETTER_DELAY_LABELS[d].length > 0, `label for ${d}`);

for (const v of [3, 30, 90]) assert.equal(parseLetterDelay(v), v);
for (const v of [0, 1, 2, 7, 29, 31, 91, -3, 3.5, NaN, '3', '30', null, undefined, true, {}, []]) {
  assert.equal(parseLetterDelay(v), null, `rejects ${String(v)}`);
}

console.log('letterDelay tests passed');
