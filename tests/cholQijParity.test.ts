/**
 * Calendar parity: the TypeScript engine must agree with the independent Python
 * reference (scripts/generate-chol-qij-fixture.py) on all 500 golden dates, and
 * obey the calendar's own invariants. A drift here silently changes who a seeker is told they are.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { computeCruzMaya, computeVenusPhase } from '../lib/chol-qij';
import { NAHUALES } from '../lib/nahuales';

const golden = JSON.parse(readFileSync(join(__dirname, 'fixtures', 'chol-qij-golden.json'), 'utf8')) as {
  names: string[]; rows: Array<Record<string, any>>;
};
const pos = (name: string) => NAHUALES.findIndex((x) => x.name === name);
const local = (iso: string) => { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d); };

let passed = 0;
function test(name: string, fn: () => void) {
  try { fn(); passed++; } catch (e) { console.error(`FAIL ${name}\n`, e); process.exit(1); }
}

test('nahual order matches the reference once orthography is stripped', () => {
  const norm = (x: string) => x.toLowerCase().replace(/[^a-z]/g, '');
  assert.deepEqual(NAHUALES.map((n) => norm(n.name)), golden.names.map(norm));
});

test('fixture is the expected size', () => assert.equal(golden.rows.length, 500));

test('all 500 golden dates match the Python reference (cruz + venus)', () => {
  for (const r of golden.rows) {
    const c = computeCruzMaya(local(r.date));
    for (const k of ['center', 'origin', 'destiny', 'paternal', 'maternal'] as const) {
      assert.deepEqual({ number: c[k].number, idx: pos(c[k].nahual.name) }, { number: r[k].number, idx: r[k].idx }, `${r.date} ${k}`);
    }
    assert.equal(computeVenusPhase(local(r.date)), r.venus, `${r.date} venus`);
  }
});

test('anchor: 2020-04-22 is 5 Kawoq', () => {
  const c = computeCruzMaya(local('2020-04-22')).center;
  assert.deepEqual({ n: c.number, k: c.nahual.name }, { n: 5, k: 'Kawoq' });
});

test('known long-count date: 2012-12-21 is 4 Ajpu', () => {
  const c = computeCruzMaya(local('2012-12-21')).center;
  assert.deepEqual({ n: c.number, k: c.nahual.name }, { n: 4, k: 'Ajpu' });
});

test('the 260-day cycle repeats exactly', () => {
  for (const iso of ['1950-03-07', '1987-11-30', '2004-02-29', '2031-08-15']) {
    const a = computeCruzMaya(local(iso)).center;
    const d = local(iso); d.setDate(d.getDate() + 260);
    const b = computeCruzMaya(d).center;
    assert.deepEqual([b.number, b.nahual.name], [a.number, a.nahual.name], iso);
  }
});

test('invariants: number 1..13, nahual known, consecutive days advance by one', () => {
  let prev: { number: number; idx: number } | null = null;
  const d = local('2019-12-25');
  for (let i = 0; i < 600; i++) {
    const c = computeCruzMaya(d).center;
    assert.ok(c.number >= 1 && c.number <= 13);
    const ix = NAHUALES.findIndex((n) => n.name === c.nahual.name);
    assert.ok(ix >= 0);
    if (prev) {
      assert.equal(c.number, (prev.number % 13) + 1);
      assert.equal(ix, (prev.idx + 1) % 20);
    }
    prev = { number: c.number, idx: ix }; d.setDate(d.getDate() + 1);
  }
});

test('cruz arm offsets: origin -8, destiny +8, paternal -6, maternal +6 nahual positions', () => {
  const idx = (n: string) => NAHUALES.findIndex((x) => x.name === n);
  const mod = (x: number) => ((x % 20) + 20) % 20;
  for (const r of golden.rows.slice(0, 100)) {
    const c = computeCruzMaya(local(r.date)), ci = idx(c.center.nahual.name);
    assert.equal(idx(c.origin.nahual.name), mod(ci - 8));
    assert.equal(idx(c.destiny.nahual.name), mod(ci + 8));
    assert.equal(idx(c.paternal.nahual.name), mod(ci - 6));
    assert.equal(idx(c.maternal.nahual.name), mod(ci + 6));
  }
});

console.log(`cholQijParity: ${passed} passed`);
