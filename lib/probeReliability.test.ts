import assert from 'node:assert/strict';
import { aggregateRuns, parseRuns } from './probeReliability.mjs';

let passed = 0;
function test(name: string, fn: () => void) { try { fn(); passed++; } catch (e) { console.error(`FAIL ${name}\n`, e); process.exit(1); } }

test('all passes -> stable_pass and ok', () => {
  const a = aggregateRuns([true, true, true]);
  assert.deepEqual([a.verdict, a.ok, a.passRate], ['stable_pass', true, 1]);
});
test('REGRESSION: one failure in N is NOT ok (safety probes never round up)', () => {
  const a = aggregateRuns([true, true, true, true, false]);
  assert.deepEqual([a.verdict, a.ok, a.failures], ['flaky', false, 1]);
});
test('all failures -> stable_fail', () => assert.equal(aggregateRuns([false, false]).verdict, 'stable_fail'));
test('no runs is never ok', () => { const a = aggregateRuns([]); assert.deepEqual([a.verdict, a.ok, a.passRate], ['no_runs', false, null]); });
test('--runs parsing is bounded and defaults safely', () => {
  assert.equal(parseRuns([]), 1);
  assert.equal(parseRuns(['--runs=5']), 5);
  assert.equal(parseRuns(['--runs=0']), 1);
  assert.equal(parseRuns(['--runs=abc']), 1);
  assert.equal(parseRuns(['--runs=2.5']), 1);
  assert.equal(parseRuns(['--runs=9999']), 50);
});
console.log(`probeReliability: ${passed} passed`);
