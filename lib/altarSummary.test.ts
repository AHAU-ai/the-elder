// lib/altarSummary.test.ts
import assert from 'node:assert/strict';
import { summarize, tally, wilson, weekStart, versionKey, versionShifts, formatSummary, RELIABLE_MIN_DECISIVE, type SignalRow } from './altarSummary';

let passed = 0;
function test(name: string, fn: () => void) {
  try { fn(); passed++; } catch (e) { console.error(`FAIL ${name}\n`, e); process.exit(1); }
}
const near = (a: number, b: number, eps = 1e-3) => assert.ok(Math.abs(a - b) < eps, `${a} !~ ${b}`);

const V1 = { contract_version: 'c1', model_version: 'm1', corpus_version: 'k1' };
const V2 = { contract_version: 'c2', model_version: 'm1', corpus_version: 'k1' };
const row = (signal: string, created_at: string, v: object = V1, lineage = 'maya'): SignalRow =>
  ({ lineage, signal, created_at, ...v });
const many = (signal: string, n: number, created_at: string, v: object = V1, lineage = 'maya') =>
  Array.from({ length: n }, () => row(signal, created_at, v, lineage));

test('wilson interval matches the textbook value (5 of 10 -> 0.237..0.763)', () => {
  const ci = wilson(5, 10)!;
  near(ci[0], 0.2366); near(ci[1], 0.7634);
});

test('wilson is sane at the edges and refuses nonsense', () => {
  const zero = wilson(0, 10)!; assert.equal(zero[0], 0); assert.ok(zero[1] > 0 && zero[1] < 0.35);
  const all = wilson(10, 10)!; assert.equal(all[1], 1); assert.ok(all[0] > 0.65);
  assert.equal(wilson(0, 0), null);
  assert.equal(wilson(3, 2), null);
});

test('land rate excludes "sitting" from the denominator', () => {
  const t = tally(many('landed', 3, '2026-11-02').concat(many('did_not_land', 1, '2026-11-02'), many('sitting', 6, '2026-11-02')));
  assert.equal(t.total, 10);
  assert.equal(t.decisive, 4);
  assert.equal(t.landRate, 0.75);
});

test('REGRESSION: a pile of "sitting" is not a failure and not a success', () => {
  const t = tally(many('sitting', 20, '2026-11-02'));
  assert.equal(t.landRate, null);
  assert.equal(t.ci, null);
  assert.equal(t.reliable, false);
});

test('unknown signal values are ignored, not miscounted', () => {
  assert.deepEqual(tally([{ signal: 'bogus' }, { signal: '' }]).total, 0);
});

test('a rate is "reliable" only once enough decisive answers exist', () => {
  assert.equal(tally(many('landed', RELIABLE_MIN_DECISIVE - 1, '2026-11-02')).reliable, false);
  assert.equal(tally(many('landed', RELIABLE_MIN_DECISIVE, '2026-11-02')).reliable, true);
});

test('weeks start on Monday (UTC), including across a month boundary and for Sundays', () => {
  assert.equal(weekStart('2026-11-01T23:00:00Z'), '2026-10-26'); // Sunday belongs to the prior Monday
  assert.equal(weekStart('2026-11-02T00:00:00Z'), '2026-11-02'); // Monday
  assert.equal(weekStart(new Date('2026-11-04T12:00:00Z')), '2026-11-02');
});

test('rows with no provenance group as "unattributed", never merged into a real version', () => {
  assert.equal(versionKey({}), 'unattributed');
  assert.equal(versionKey({ contract_version: 'c1' }), 'contract=c1 model=? corpus=?');
});

test('REGRESSION: a clearly worse version is flagged; overlap is "no clear change"; thin data is "insufficient"', () => {
  const before = summarize([
    ...many('landed', 40, '2026-10-01', V1), ...many('did_not_land', 10, '2026-10-01', V1),
    ...many('landed', 8, '2026-10-20', V2), ...many('did_not_land', 42, '2026-10-20', V2),
  ]);
  assert.deepEqual(before.shifts.map((s) => s.verdict), ['worse']);

  const overlap = summarize([
    ...many('landed', 12, '2026-10-01', V1), ...many('did_not_land', 8, '2026-10-01', V1),
    ...many('landed', 10, '2026-10-20', V2), ...many('did_not_land', 10, '2026-10-20', V2),
  ]);
  assert.deepEqual(overlap.shifts.map((s) => s.verdict), ['no_clear_change']);

  const thin = summarize([
    ...many('landed', 40, '2026-10-01', V1), ...many('did_not_land', 10, '2026-10-01', V1),
    ...many('did_not_land', 3, '2026-10-20', V2),
  ]);
  assert.deepEqual(thin.shifts.map((s) => s.verdict), ['insufficient_data']);

  const better = summarize([
    ...many('landed', 8, '2026-10-01', V1), ...many('did_not_land', 42, '2026-10-01', V1),
    ...many('landed', 40, '2026-10-20', V2), ...many('did_not_land', 10, '2026-10-20', V2),
  ]);
  assert.deepEqual(better.shifts.map((s) => s.verdict), ['better']);
});

test('unattributed rows never take part in a version comparison', () => {
  const g = summarize([
    ...many('landed', 30, '2026-10-01', {}), ...many('landed', 30, '2026-10-05', V1), ...many('did_not_land', 20, '2026-10-05', V1),
  ]);
  assert.deepEqual(g.shifts, []);
  assert.ok(g.byVersion.some((v) => v.key === 'unattributed'));
});

test('versions are ordered by when each was first seen, not by name', () => {
  const g = summarize([row('landed', '2026-10-20', V2), row('landed', '2026-10-01', V1)]);
  assert.deepEqual(g.byVersion.map((v) => v.key.split(' ')[0]), ['contract=c1', 'contract=c2']);
});

test('summary is built from anonymous columns only: no user id can appear in it', () => {
  const s = JSON.stringify(summarize([{ ...row('landed', '2026-11-02'), user_id: 42 } as SignalRow]));
  assert.doesNotMatch(s, /user_id|42/);
});

test('text rendering warns when a rate is too thin to act on and never calls sitting a miss', () => {
  const text = formatSummary(summarize([...many('landed', 3, '2026-11-02'), ...many('sitting', 2, '2026-11-02')]));
  assert.match(text, /too few to act on/);
  assert.match(text, /"sitting" is not counted as a miss/);
  assert.match(text, /landed 3 · sitting 2 · passed 0/);
});

test('empty input yields an empty, well-formed summary', () => {
  const s = summarize([]);
  assert.equal(s.overall.total, 0);
  assert.deepEqual(s.byVersion, []);
  assert.deepEqual(s.shifts, []);
  assert.ok(formatSummary(s).includes('no decisive answers yet'));
});

console.log(`altarSummary: ${passed} passed`);
