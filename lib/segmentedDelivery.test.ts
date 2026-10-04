import assert from 'node:assert/strict';
import { buildSystemPrompt } from './system-prompt-builder';
import {
  SEGMENT_MAX,
  MORE_TOKEN,
  clampSegmentIndex,
  assembleSegmentedReading,
  segmentedDeliveryClause,
  segmentedDeliveryApplies,
  divineRateBucket,
} from './segmentedDelivery';

function ok(name: string, fn: () => void) {
  fn();
  console.log(`  ok  ${name}`);
}

ok('clampSegmentIndex bounds bad and out-of-range input', () => {
  assert.equal(clampSegmentIndex(99), SEGMENT_MAX - 1);
  assert.equal(clampSegmentIndex(-3), 0);
  assert.equal(clampSegmentIndex('2'), 0);
  assert.equal(clampSegmentIndex(NaN), 0);
  assert.equal(clampSegmentIndex(1.9), 1);
});

ok('final-allowed segment forbids MORE; earlier segments allow it', () => {
  assert.match(segmentedDeliveryClause(SEGMENT_MAX - 1), /Do NOT emit the ⧁⧁MORE⧁⧁ token/);
  assert.match(segmentedDeliveryClause(0), /end this segment with ONE short follow-up question/);
});

ok('default prompt is unchanged (no segmentation text)', () => {
  const p = buildSystemPrompt('maya' as never, false, true);
  assert.ok(!p.includes('SEGMENTED DELIVERY'));
  assert.ok(p.includes('the whole arc, unbroken'));
});

ok('segmented prompt replaces the "unbroken" instruction, in both modes', () => {
  const reading = buildSystemPrompt('maya' as never, false, true, 'English', '', '', null, '', '', 0);
  const questioning = buildSystemPrompt('maya' as never, false, false, 'English', '', '', null, '', '', 0);
  assert.ok(reading.includes('SEGMENTED DELIVERY') && !reading.includes('the whole arc, unbroken'));
  assert.ok(questioning.includes('SEGMENTED DELIVERY') && !questioning.includes('proceed straight through the full arc'));
});

ok('assembleSegmentedReading joins prior segments and recovers the offering', () => {
  const msgs = [
    { role: 'user', content: 'offering' },
    { role: 'assistant', content: 'one' },
    { role: 'user', content: 'yes' },
    { role: 'assistant', content: 'two' },
    { role: 'user', content: 'go on' },
  ];
  const r = assembleSegmentedReading(msgs, 2, 'three');
  assert.equal(r.fullText, 'one\n\ntwo\n\nthree');
  assert.equal(r.offering, 'offering');
});

ok('assembleSegmentedReading ignores an earlier clarifying exchange', () => {
  const msgs = [
    { role: 'user', content: 'thin offering' },
    { role: 'assistant', content: 'clarifying question' },
    { role: 'user', content: 'the detail' },
    { role: 'assistant', content: 'one' },
    { role: 'user', content: 'yes' },
  ];
  const r = assembleSegmentedReading(msgs, 1, 'two');
  assert.equal(r.fullText, 'one\n\ntwo');
  assert.equal(r.offering, 'the detail');
});

ok('assembleSegmentedReading with no prior segments returns the text as is', () => {
  assert.deepEqual(assembleSegmentedReading([], 0, 'solo'), { fullText: 'solo', offering: undefined });
  assert.equal(MORE_TOKEN, '⧁⧁MORE⧁⧁');
});

ok('voices with contradicting form rules are excluded; others apply', () => {
  for (const v of ['ojer_tzij', 'pythia', 'sufi']) assert.equal(segmentedDeliveryApplies(v), false);
  for (const v of ['norse', 'babalawo', 'mekubal', 'keeper_of_the_fire']) assert.equal(segmentedDeliveryApplies(v), true);
});


// ── rate-limit bucket (a Reading costs one divination, not three) ───────────


ok('divineRateBucket charges segment 0 and unsegmented requests to the ordinary per-IP bucket', () => {
  assert.deepEqual(divineRateBucket('1.2.3.4', null, 10), { key: '1.2.3.4', limit: 10 });
  assert.deepEqual(divineRateBucket('1.2.3.4', 0, 10), { key: '1.2.3.4', limit: 10 });
});

ok('divineRateBucket charges continuations to their own bucket sized for honest use', () => {
  for (const seg of [1, 2]) {
    assert.deepEqual(divineRateBucket('1.2.3.4', seg, 10), { key: 'divine-cont:1.2.3.4', limit: 10 * (SEGMENT_MAX - 1) });
  }
});

ok('divineRateBucket: the two buckets never share a key, and a forged index gains only the continuation allowance', () => {
  const a = divineRateBucket('9.9.9.9', 0, 10);
  const b = divineRateBucket('9.9.9.9', 2, 10);
  assert.notEqual(a.key, b.key);
  // clampSegmentIndex bounds whatever the client sends before it reaches the bucket choice
  const forged = divineRateBucket('9.9.9.9', clampSegmentIndex(10_000), 10);
  assert.equal(forged.key, 'divine-cont:9.9.9.9');
  assert.equal(a.limit + forged.limit, 10 * SEGMENT_MAX);
});

console.log('All segmentedDelivery tests passed.');
