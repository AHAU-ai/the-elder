// lib/feedbackSteer.test.ts
//
// The learning loop reads a seeker's recent answers and steers the NEXT
// Reading. These tests pin the one property that matters most: "I need to sit
// with this" is not a miss.
import assert from 'node:assert/strict';
import { buildFeedbackSteer, tallySignals, MIN_DECISIVE_SIGNALS } from './feedbackSteer';
import { SIGNAL_VALUES } from './altar-types';

let passed = 0;
function test(name: string, fn: () => void) {
  try { fn(); passed++; } catch (e) { console.error(`FAIL ${name}\n`, e); process.exit(1); }
}
const rows = (...s: string[]) => s.map((signal) => ({ signal }));

test('the three answers a seeker can give are exactly landed / sitting / did_not_land', () => {
  assert.deepEqual([...SIGNAL_VALUES], ['landed', 'sitting', 'did_not_land']);
});

test('tally counts only decisive signals; sitting and unknown values are ignored', () => {
  assert.deepEqual(
    tallySignals(rows('landed', 'sitting', 'did_not_land', 'sitting', 'bogus', 'landed')),
    { landed: 2, didNotLand: 1 },
  );
  assert.deepEqual(tallySignals([{}, { signal: null }, { signal: 3 }]), { landed: 0, didNotLand: 0 });
});

test('below the evidence floor the steer is silence, not a guess', () => {
  assert.equal(MIN_DECISIVE_SIGNALS, 2);
  assert.equal(buildFeedbackSteer({ landed: 0, didNotLand: 0 }), '');
  assert.equal(buildFeedbackSteer({ landed: 1, didNotLand: 0 }), '');
  assert.equal(buildFeedbackSteer({ landed: 0, didNotLand: 1 }), '');
});

test('REGRESSION: a run of "sitting" never produces a steer, in either direction', () => {
  const t = tallySignals(rows('sitting', 'sitting', 'sitting', 'sitting', 'sitting', 'sitting'));
  assert.equal(buildFeedbackSteer(t), '');
  // One real answer plus many sitting is still below the floor.
  assert.equal(buildFeedbackSteer(tallySignals(rows('landed', 'sitting', 'sitting', 'sitting'))), '');
  assert.equal(buildFeedbackSteer(tallySignals(rows('did_not_land', 'sitting', 'sitting', 'sitting'))), '');
});

test('REGRESSION: sitting does not tip a split toward "sharpen"', () => {
  // 1 landed vs 1 missed is an even split; padding it with sitting must not change that.
  assert.equal(buildFeedbackSteer(tallySignals(rows('landed', 'did_not_land', 'sitting', 'sitting'))), '');
});

test('clear majority of misses sharpens; the clause names the real counts', () => {
  const out = buildFeedbackSteer(tallySignals(rows('did_not_land', 'did_not_land', 'landed', 'sitting')));
  assert.match(out, /did not land as strongly as they could have/);
  assert.match(out, /2 of 3 recent readings/);
  assert.match(out, /do not soften the register/);
});

test('clear majority of landings reinforces', () => {
  const out = buildFeedbackSteer(tallySignals(rows('landed', 'landed', 'did_not_land', 'sitting')));
  assert.match(out, /landed well/);
  assert.match(out, /2 of 3/);
});

test('an even split is silence', () => {
  assert.equal(buildFeedbackSteer({ landed: 2, didNotLand: 2 }), '');
});

console.log(`feedbackSteer: ${passed} passed`);
