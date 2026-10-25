import assert from 'node:assert/strict';
import { blossomPetals, BLOSSOM_PETALS } from './petalDraw';

function ok(name: string, fn: () => void) { fn(); console.log(`  ok  ${name}`); }
const jit = Array.from({ length: BLOSSOM_PETALS }, (_, i) => Math.sin(i * 2.3));

ok('a blossom has the declared number of petals, all above its base', () => {
  const ps = blossomPetals(100, 300, 40, 1, jit);
  assert.equal(ps.length, BLOSSOM_PETALS);
  for (const p of ps) assert.ok(p.y < 300);
});
ok('a bud is narrower and shorter than an open flower, petals fanning wider as it opens', () => {
  const bud = blossomPetals(0, 0, 40, 0, jit), full = blossomPetals(0, 0, 40, 1, jit);
  const span = (a: typeof bud) => Math.max(...a.map(p => p.x)) - Math.min(...a.map(p => p.x));
  assert.ok(span(full) > span(bud) * 2);
  assert.ok(full[0].len > bud[0].len);
  assert.ok(full[0].flip > bud[0].flip);
});
ok('open is clamped and never produces NaN', () => {
  for (const o of [-3, 0, 0.5, 1, 9]) for (const p of blossomPetals(5, 5, 20, o, jit)) {
    assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.rot) && p.len > 0);
  }
});
ok('jitter makes petals uneven: no two same-layer petals are mirror images', () => {
  const ps = blossomPetals(0, 0, 40, 1, jit).filter(p => p.layer === 0);
  assert.ok(Math.abs(ps[0].rot + ps[3].rot) > 1e-3);
  assert.ok(Math.abs(ps[0].len - ps[3].len) > 1e-3);
});
ok('missing jitter still works', () => {
  assert.equal(blossomPetals(0, 0, 10, 0.5, []).length, BLOSSOM_PETALS);
});
