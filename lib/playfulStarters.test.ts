// Run: tsx lib/playfulStarters.test.ts
import assert from 'node:assert/strict';
import { PLAYFUL_STARTERS_EN, playfulStartersFor, pickPlayfulStarters } from './playfulStarters';
import { TRADITION_MAP } from './traditions';
import { LINEAGES } from './lineages';

let passed = 0;
function test(name: string, fn: () => void) {
  try { fn(); passed++; console.log('  ok  ' + name); }
  catch (e) { console.error('FAIL ' + name + '\n', e); process.exit(1); }
}
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

test('english only', () => {
  assert.ok(playfulStartersFor('en').length >= 6);
  for (const l of ['es', 'de', 'ja', 'zh', 'ki', 'fr']) assert.deepEqual(playfulStartersFor(l), []);
});
test('unique, non-empty, short, questions', () => {
  assert.equal(new Set(PLAYFUL_STARTERS_EN).size, PLAYFUL_STARTERS_EN.length);
  for (const s of PLAYFUL_STARTERS_EN) {
    assert.ok(s.trim().length > 0 && s.length <= 90, s);
    assert.ok(s.endsWith('?'), s);
  }
});
test('lineage-neutral: no tradition canon term or lineage label appears', () => {
  const terms = new Set<string>();
  for (const t of Object.values(TRADITION_MAP) as any[]) {
    for (const a of t?.canonAnchors ?? []) terms.add(String(a));
  }
  for (const l of Object.values(LINEAGES) as any[]) {
    for (const v of [l?.label, l?.tradition]) if (typeof v === 'string' && v.length > 3) terms.add(v);
  }
  for (const s of PLAYFUL_STARTERS_EN) {
    for (const term of terms) {
      if (term.length < 4) continue;
      assert.ok(!new RegExp('\\b' + esc(term) + '\\b', 'i').test(s), `"${s}" contains "${term}"`);
    }
  }
});
test('pick: n distinct, from pool', () => {
  const p = pickPlayfulStarters(PLAYFUL_STARTERS_EN, 3);
  assert.equal(p.length, 3);
  assert.equal(new Set(p).size, 3);
  for (const s of p) assert.ok(PLAYFUL_STARTERS_EN.includes(s));
});
test('pick: "another" prefers fresh lines', () => {
  const first = pickPlayfulStarters(PLAYFUL_STARTERS_EN, 3);
  const next = pickPlayfulStarters(PLAYFUL_STARTERS_EN, 3, first);
  for (const s of next) assert.ok(!first.includes(s));
});
test('pick: small pool falls back to excluded, never throws', () => {
  const pool = ['a?', 'b?'];
  assert.deepEqual(pickPlayfulStarters(pool, 3, ['a?']).sort(), ['a?', 'b?']);
  assert.deepEqual(pickPlayfulStarters([], 3), []);
  assert.deepEqual(pickPlayfulStarters(pool, 0), []);
});
console.log(`\n${passed} passed`);
