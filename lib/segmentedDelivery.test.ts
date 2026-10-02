import assert from 'node:assert/strict';
import { buildSystemPrompt } from './system-prompt-builder';
import {
  SEGMENT_MAX,
  MORE_TOKEN,
  clampSegmentIndex,
  assembleSegmentedReading,
  segmentedDeliveryClause,
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

console.log('All segmentedDelivery tests passed.');
