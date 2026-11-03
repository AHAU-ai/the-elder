// Run: tsx lib/fireOffering.test.ts
import assert from 'node:assert/strict';
import { tryOffer, INITIAL_OFFERING, OFFERING_MIN_GAP_MS, OFFERING_MAX_PER_SITTING } from './fireOffering';

let passed = 0;
function test(name: string, fn: () => void) {
  try { fn(); passed++; console.log('  ok  ' + name); }
  catch (e) { console.error('FAIL ' + name + '\n', e); process.exit(1); }
}
test('first offering accepted', () => {
  const r = tryOffer(INITIAL_OFFERING, 1000);
  assert.equal(r.accepted, true);
  assert.deepEqual(r.state, { count: 1, lastAt: 1000 });
});
test('rapid second tap rejected, state unchanged', () => {
  const a = tryOffer(INITIAL_OFFERING, 1000).state;
  const r = tryOffer(a, 1000 + OFFERING_MIN_GAP_MS - 1);
  assert.equal(r.accepted, false);
  assert.deepEqual(r.state, a);
});
test('accepted again after the gap', () => {
  const a = tryOffer(INITIAL_OFFERING, 1000).state;
  assert.equal(tryOffer(a, 1000 + OFFERING_MIN_GAP_MS).accepted, true);
});
test('capped per sitting', () => {
  let s = INITIAL_OFFERING; let t = 0;
  for (let i = 0; i < OFFERING_MAX_PER_SITTING; i++) { const r = tryOffer(s, t); assert.ok(r.accepted); s = r.state; t += OFFERING_MIN_GAP_MS; }
  assert.equal(tryOffer(s, t + 100000).accepted, false);
});
console.log(`\n${passed} passed`);
