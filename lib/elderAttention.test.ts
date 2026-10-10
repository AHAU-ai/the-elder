// Run: tsx lib/elderAttention.test.ts
import assert from 'node:assert/strict';
import {
  BASELINE_STILLNESS, PHASE_STILLNESS, resolveStillness, dominantPhase, ambientOpacityFactor, createClaimSet,
  type ElderPhase,
} from './elderAttention';

function ok(name: string, fn: () => void) { fn(); console.log(`  ok  ${name}`); }

ok('with nothing claimed, the baseline holds (never zero: omnipresent)', () => {
  assert.equal(resolveStillness([]), BASELINE_STILLNESS);
  assert.ok(BASELINE_STILLNESS > 0);
  assert.equal(dominantPhase([]), 'baseline');
});
ok('the deepest claim wins', () => {
  assert.equal(resolveStillness(['council', 'composing']), PHASE_STILLNESS.composing);
  assert.equal(dominantPhase(['council', 'composing', 'arrival']), 'composing');
});
ok('releasing the deeper claim falls back to the next, then the baseline', () => {
  assert.equal(resolveStillness(['council']), PHASE_STILLNESS.council);
  assert.equal(resolveStillness([]), BASELINE_STILLNESS);
});
ok('every phase is above the baseline and within 0-1', () => {
  for (const p of Object.keys(PHASE_STILLNESS) as ElderPhase[]) {
    assert.ok(PHASE_STILLNESS[p] > BASELINE_STILLNESS, p);
    assert.ok(PHASE_STILLNESS[p] <= 1, p);
  }
});
ok('composing is the deepest attention', () => {
  const max = Math.max(...Object.values(PHASE_STILLNESS));
  assert.equal(PHASE_STILLNESS.composing, max);
});
ok('ambient layers withdraw as stillness rises but never vanish', () => {
  assert.equal(ambientOpacityFactor(0), 1);
  assert.ok(ambientOpacityFactor(0.9) < ambientOpacityFactor(0.18));
  assert.ok(ambientOpacityFactor(1) > 0);
  assert.equal(ambientOpacityFactor(-5), 1);          // clamped
  assert.equal(ambientOpacityFactor(5), ambientOpacityFactor(1));
});
ok('claims raise the stillness and releasing returns it, emitting each change', () => {
  const seen: Array<[number, string]> = [];
  const set = createClaimSet((s, p) => seen.push([s, p]));
  set.refresh();
  assert.deepEqual(seen.at(-1), [BASELINE_STILLNESS, 'baseline']);
  const releaseCouncil = set.claim('council');
  assert.deepEqual(seen.at(-1), [PHASE_STILLNESS.council, 'council']);
  const releaseWait = set.claim('composing');
  assert.deepEqual(seen.at(-1), [PHASE_STILLNESS.composing, 'composing']);
  releaseWait();
  assert.deepEqual(seen.at(-1), [PHASE_STILLNESS.council, 'council']); // falls back, not to baseline
  releaseCouncil();
  assert.deepEqual(seen.at(-1), [BASELINE_STILLNESS, 'baseline']);
});
ok('two claims of the same phase are independent; releasing one keeps the other', () => {
  let last = 0;
  const set = createClaimSet((s) => { last = s; });
  const a = set.claim('unfolding');
  const b = set.claim('unfolding');
  a();
  assert.equal(last, PHASE_STILLNESS.unfolding);
  b();
  assert.equal(last, BASELINE_STILLNESS);
});
ok('releasing twice is harmless and does not release someone else', () => {
  let last = 0;
  const set = createClaimSet((s) => { last = s; });
  const a = set.claim('composing');
  const b = set.claim('composing');
  a(); a();
  assert.equal(last, PHASE_STILLNESS.composing); // b still holds it
  b();
  assert.equal(last, BASELINE_STILLNESS);
});
console.log('All elderAttention tests passed.');
