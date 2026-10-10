import assert from 'node:assert/strict';
import { mulberry32, makeNoise, fbm, traceVeins, TEX_W, TEX_H } from './portalTexture';

function ok(name: string, fn: () => void) {
  fn();
  console.log(`  ok  ${name}`);
}

ok('the seeded generator is deterministic and in [0, 1)', () => {
  const a = mulberry32(42), b = mulberry32(42);
  for (let i = 0; i < 200; i++) {
    const x = a();
    assert.equal(x, b());
    assert.ok(x >= 0 && x < 1);
  }
  assert.notEqual(mulberry32(1)(), mulberry32(2)());
});

ok('value noise and fbm stay in [0, 1] and are smooth', () => {
  const n = makeNoise(7);
  let prev = fbm(n, 0, 0, 4);
  for (let i = 1; i < 500; i++) {
    const v = fbm(n, i * 0.013, i * 0.007, 4);
    assert.ok(v >= 0 && v <= 1, `out of range at ${i}: ${v}`);
    assert.ok(Math.abs(v - prev) < 0.2, 'no jumps between near neighbours');
    prev = v;
  }
});

ok('the light veins are deterministic for a seed and differ between seeds', () => {
  const a = traceVeins(123), b = traceVeins(123), c = traceVeins(124);
  assert.deepEqual(a, b);
  assert.notDeepEqual(a, c);
});

ok('every vein point is finite and inside the texture', () => {
  const veins = traceVeins(0x5eed1e);
  assert.ok(veins.length >= 15, `expected many threads, got ${veins.length}`);
  for (const v of veins) {
    assert.ok(v.pts.length > 3);
    for (const [x, y] of v.pts) {
      assert.ok(Number.isFinite(x) && Number.isFinite(y));
      assert.ok(x >= 0 && x <= TEX_W && y >= 0 && y <= TEX_H, `(${x}, ${y}) outside`);
    }
  }
});

ok('trunks leave the seam edge; branches only deepen to a bounded depth', () => {
  const veins = traceVeins(0x5eed1e);
  for (const v of veins) {
    assert.ok(v.depth >= 0 && v.depth <= 3);
    if (v.depth === 0) assert.ok(v.pts[0][0] > TEX_W - 10, 'a trunk starts at the seam');
  }
  assert.ok(veins.some((v) => v.depth > 0), 'some threads fork');
});

console.log('portalTexture: all passed');
