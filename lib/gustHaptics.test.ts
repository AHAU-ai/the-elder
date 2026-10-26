import assert from 'node:assert/strict';
import { gustEnvelope, gustPattern, gustTicks, createGustHaptics, GUST_MS, type GustHapticDeps } from './gustHaptics';

function ok(name: string, fn: () => void) { fn(); console.log(`  ok  ${name}`); }

ok('the envelope rises fast, holds, and dies away to nothing', () => {
  assert.equal(gustEnvelope(0), 0);
  assert.equal(gustEnvelope(400), 1);
  assert.ok(gustEnvelope(1200) > 0 && gustEnvelope(1200) < 1);
  assert.equal(gustEnvelope(GUST_MS), 0);
  assert.equal(gustEnvelope(-50), 0);
});

ok('the pattern is whole positive numbers, starts and ends on a pulse, and lasts about the gust', () => {
  const p = gustPattern();
  assert.ok(p.length >= 9 && p.length % 2 === 1);
  for (const n of p) assert.ok(Number.isInteger(n) && n > 0, `bad entry ${n}`);
  const total = p.reduce((a, b) => a + b, 0);
  assert.ok(total > 1000 && total <= GUST_MS + 60, `total ${total}`);
});

ok('the pulses are longest at the peak and shortest in the tail (the swell is felt)', () => {
  const p = gustPattern();
  const ons = p.filter((_, i) => i % 2 === 0);
  const peak = Math.max(...ons);
  assert.ok(peak >= 36);
  const peakAt = ons.indexOf(peak);
  assert.ok(peakAt > 1 && peakAt < ons.length - 3, 'the peak is in the middle, not at either end');
  assert.ok(ons[ons.length - 1] < peak / 2);
});

ok('ticks are dense at the peak and sparse in the tail, and stay inside the gust', () => {
  const t = gustTicks();
  assert.ok(t.length > 10);
  for (let i = 1; i < t.length; i++) assert.ok(t[i] > t[i - 1]);
  assert.ok(t[t.length - 1] < GUST_MS);
  const gapEarly = t[3] - t[2], gapLate = t[t.length - 1] - t[t.length - 2];
  assert.ok(gapLate > gapEarly * 2);
});

function deps(over: Partial<GustHapticDeps> = {}) {
  const log: { vib: unknown[]; ticks: number; timers: { fn: () => void; ms: number; live: boolean }[] } = { vib: [], ticks: 0, timers: [] };
  const d: GustHapticDeps = {
    vibrate: (p) => { log.vib.push(p); return true; },
    tick: () => { log.ticks++; },
    reducedMotion: () => false,
    isVisible: () => true,
    setTimeout: (fn, ms) => { const t = { fn, ms, live: true }; log.timers.push(t); return t; },
    clearTimeout: (h) => { (h as { live: boolean }).live = false; },
    ...over,
  };
  return { d, log };
}

ok('fire vibrates once with the gust pattern; a second fire while running does nothing', () => {
  const { d, log } = deps();
  const g = createGustHaptics(d);
  g.fire(); g.fire();
  assert.equal(log.vib.length, 1);
  assert.deepEqual(log.vib[0], gustPattern());
});

ok('cancel stops the motor and the timers', () => {
  const { d, log } = deps();
  const g = createGustHaptics(d);
  g.fire(); g.cancel();
  assert.deepEqual(log.vib[log.vib.length - 1], 0);
  assert.ok(log.timers.every(t => !t.live));
  g.cancel();   // twice is fine
});

ok('reduced motion and a hidden tab: nothing at all', () => {
  for (const over of [{ reducedMotion: () => true }, { isVisible: () => false }]) {
    const { d, log } = deps(over);
    createGustHaptics(d).fire();
    assert.equal(log.vib.length, 0); assert.equal(log.ticks, 0); assert.equal(log.timers.length, 0);
  }
});

ok('without the Vibration API it falls back to ticks, on the envelope\'s schedule', () => {
  const { d, log } = deps({ vibrate: null });
  createGustHaptics(d).fire();
  const sched = log.timers.slice(0, -1).map(t => t.ms);
  assert.deepEqual(sched, gustTicks());
  log.timers.slice(0, -1).forEach(t => t.fn());
  assert.equal(log.ticks, sched.length);
});

ok('a platform that throws is silent, not an error', () => {
  const { d } = deps({ vibrate: () => { throw new Error('no'); } });
  createGustHaptics(d).fire();
  const { d: d2 } = deps({ vibrate: null, tick: () => { throw new Error('no'); } });
  const g = createGustHaptics(d2); g.fire();
});

ok('with neither vibrate nor tick: nothing, no error', () => {
  const { d, log } = deps({ vibrate: null, tick: null });
  createGustHaptics(d).fire();
  assert.equal(log.timers.length, 0);
});
