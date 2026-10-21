import assert from 'node:assert/strict';
import { mulberry32, makeNoise, fbm } from './portalTexture';

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

console.log('portalTexture: all passed');
