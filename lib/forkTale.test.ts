// Run: tsx lib/forkTale.test.ts
import assert from 'node:assert/strict';
import {
  parseFork, forkAllowed, forkClause, stripForkTokens, lastQuestion, FORK_MAX_WORDS, FORK_THE_TALE_ENABLED,
} from './forkTale';
import { segmentedDeliveryClause, SEGMENT_MAX, MORE_TOKEN } from './segmentedDelivery';
import { splitQuestion } from '../app/components/ReadingSegment';

let passed = 0;
function test(name: string, fn: () => void) {
  try { fn(); passed++; console.log('  ok  ' + name); }
  catch (e) { console.error('FAIL ' + name + '\n', e); process.exit(1); }
}

const Q = 'The road splits here. Do you follow the one who laughs, or the one who waits?';
const VISIBLE = `Smoke rose where the two of them had stood.\n\n${Q}`;
const RAW = `${VISIBLE}\n⧁FORK:the one who laughs|the one who waits⧁\n${MORE_TOKEN}`;

test('flag is on by default', () => assert.equal(FORK_THE_TALE_ENABLED, true));

test('parses a valid fork whose options sit inside the closing question', () => {
  assert.deepEqual(parseFork(RAW, VISIBLE), ['the one who laughs', 'the one who waits']);
});
test('case and spacing do not matter when matching the question', () => {
  const raw = `${VISIBLE}\n⧁FORK: The One Who  Laughs | THE ONE WHO WAITS ⧁`;
  assert.ok(parseFork(raw, VISIBLE));
});
test('no token -> null', () => assert.equal(parseFork(VISIBLE, VISIBLE), null));
test('options not found in the visible question -> dropped (guardian-review safety)', () => {
  assert.equal(parseFork(`${VISIBLE}\n⧁FORK:the river|the mountain⧁`, VISIBLE), null);
  // present in the telling but not in the closing question
  const v = `The one who laughs went east and the one who waits stayed.\n\nWhat do you notice?`;
  assert.equal(parseFork(`${v}\n⧁FORK:the one who laughs|the one who waits⧁`, v), null);
});
test('malformed tokens -> dropped', () => {
  for (const bad of ['one only', 'a|b|c', '|the one who waits', 'the one who laughs|', 'the one who laughs|the one who laughs', 'the one who laughs|The One Who Laughs']) {
    assert.equal(parseFork(`${VISIBLE}\n⧁FORK:${bad}⧁`, VISIBLE), null, bad);
  }
});
test('option length limits', () => {
  const long = Array.from({ length: FORK_MAX_WORDS + 1 }, (_, i) => 'w' + i).join(' ');
  const v = `Tale.\n\nDo you take ${long} or the other?`;
  assert.equal(parseFork(`${v}\n⧁FORK:${long}|the other⧁`, v), null);
});
test('options may not carry a question mark or a token glyph', () => {
  assert.equal(parseFork(`${VISIBLE}\n⧁FORK:the one who laughs?|the one who waits⧁`, VISIBLE), null);
});
test('a visible text that is only a question has no telling -> dropped', () => {
  const v = 'Do you follow the one who laughs, or the one who waits?';
  assert.equal(parseFork(`${v}\n⧁FORK:the one who laughs|the one who waits⧁`, v), null);
});

test('stripForkTokens removes every token and leaves the rest', () => {
  assert.equal(stripForkTokens(`a⧁FORK:x|y⧁b⧁FORK:z|w⧁c`), 'abc');
  assert.equal(stripForkTokens('no token'), 'no token');
});

test('lastQuestion agrees with the client splitQuestion', () => {
  for (const t of [VISIBLE, 'Just a telling.', 'Q?', 'Telling.\n\nWhat stays?"', 'One. Two? Three. Four?']) {
    assert.equal(lastQuestion(t), splitQuestion(t).question, t);
  }
});

test('forkAllowed needs moreToCome, not myth-first, welfare clear', () => {
  const ok = { moreToCome: true, mythFirst: false, welfareClear: true };
  assert.equal(forkAllowed(ok), true);
  assert.equal(forkAllowed({ ...ok, moreToCome: false }), false);
  assert.equal(forkAllowed({ ...ok, mythFirst: true }), false);
  assert.equal(forkAllowed({ ...ok, welfareClear: false }), false);
});

test('prompt: non-final segments carry the fork clause; the final one does not', () => {
  for (let i = 0; i < SEGMENT_MAX - 1; i++) {
    const c = segmentedDeliveryClause(i);
    assert.ok(c.includes('⧁FORK:'), 'segment ' + i);
    assert.ok(c.includes('at most once'));
    assert.ok(/another tradition/i.test(c));
  }
  const last = segmentedDeliveryClause(SEGMENT_MAX - 1);
  assert.ok(!last.includes('FORK'));
  assert.equal(forkClause(true), '');
});
test('prompt: the clause is form-only and names no lineage vocabulary', () => {
  const c = forkClause(false);
  for (const w of ['nahual', 'orí', 'tikkun', 'Norns', 'Pythia', 'maqam', 'wu wei']) assert.ok(!c.includes(w), w);
});

console.log(`\n${passed} passed`);
