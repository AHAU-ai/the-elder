import assert from 'node:assert/strict';
import { FRAME_MS, MAX_STEP_MS, stepMs, frameScale, stepPolar, type PolarMote } from './vortexMotion';

function ok(name: string, fn: () => void) {
  fn();
  console.log(`  ok  ${name}`);
}

/** Run a mote for `totalMs` of real time at a given refresh rate. */
function run(hz: number, totalMs: number, disperseAt = 2300) {
  const m: PolarMote = { a: 0.4, r: 180, w: 1.3, vr: -0.2 };
  const dt = 1000 / hz;
  for (let t = 0; t < totalMs; t += dt) {
    const d = Math.min(1, Math.max(0, (t - disperseAt) / 1500));
    stepPolar(m, frameScale(dt), d * d * (3 - 2 * d), 390);
  }
  return m;
}

ok('a step is worth one frame at 60Hz, half at 120Hz, two at 30Hz', () => {
  assert.ok(Math.abs(frameScale(FRAME_MS) - 1) < 1e-9);
  assert.ok(Math.abs(frameScale(FRAME_MS / 2) - 0.5) < 1e-9);
  assert.ok(Math.abs(frameScale(FRAME_MS * 2) - 2) < 1e-9);
});

ok('a stalled frame is clamped: a backgrounded tab cannot fling a mote', () => {
  assert.equal(stepMs(60_000), MAX_STEP_MS);
  assert.ok(frameScale(60_000) <= MAX_STEP_MS / FRAME_MS + 1e-9);
});

ok('bad time values never move a mote (negative, zero, NaN)', () => {
  assert.equal(stepMs(-5), 0);
  assert.equal(stepMs(0), 0);
  assert.equal(stepMs(NaN), 0);
  const m: PolarMote = { a: 1, r: 100, w: 1, vr: 0.3 };
  stepPolar(m, frameScale(NaN), 0, 390);
  assert.deepEqual([m.a, m.r], [1, 100]);
});

ok('the same 3.5s of real time lands in (nearly) the same place at 30, 60 and 120Hz', () => {
  const ref = run(60, 3500);
  for (const hz of [30, 120, 144]) {
    const m = run(hz, 3500);
    assert.ok(Math.abs(m.a - ref.a) / Math.abs(ref.a) < 0.04, `${hz}Hz angle ${m.a} vs ${ref.a}`);
    assert.ok(Math.abs(m.r - ref.r) / ref.r < 0.04, `${hz}Hz radius ${m.r} vs ${ref.r}`);
  }
});

ok('the old frame-counted motion was NOT rate-independent (why this module exists)', () => {
  // 3.5s at 120Hz = 420 frames vs 210 at 60Hz; per-frame increments double the turn.
  const frames = (hz: number) => { const m: PolarMote = { a: 0, r: 180, w: 1.3, vr: 0 }; for (let i = 0; i < hz * 3.5; i++) stepPolar(m, 1, 0, 390); return m.a; };
  assert.ok(frames(120) > frames(60) * 1.8);
});

ok('inward/outward drift while holding moves by time, not by frames', () => {
  const m60: PolarMote = { a: 0, r: 300, w: 0, vr: -0.4 };
  const m120: PolarMote = { a: 0, r: 300, w: 0, vr: -0.4 };
  for (let i = 0; i < 60; i++) stepPolar(m60, frameScale(1000 / 60), 0, 390);
  for (let i = 0; i < 120; i++) stepPolar(m120, frameScale(1000 / 120), 0, 390);
  assert.ok(Math.abs(m60.r - m120.r) < 0.01, `${m60.r} vs ${m120.r}`);
});

console.log('vortexMotion: all passed');
