import assert from 'node:assert/strict';
import {
  HAPTIC_FLOOR, HAPTIC_GAP_MS, HAPTIC_MAX_ON_MS, HAPTIC_MIN_ON_MS, HAPTIC_WINDOW_MS,
  buzzPattern, createHapticBuzz, swellFactor, type HapticBuzzDeps,
} from './portalHaptics';

function ok(name: string, fn: () => void) { fn(); console.log(`  ok  ${name}`); }

ok('no buzz at or below the floor, and for nonsense', () => {
  assert.deepEqual(buzzPattern(0), []);
  assert.deepEqual(buzzPattern(HAPTIC_FLOOR), []);
  assert.deepEqual(buzzPattern(-1), []);
  assert.deepEqual(buzzPattern(NaN), []);
  assert.deepEqual(buzzPattern(Infinity), []);
});
ok('a pattern is whole positive numbers, alternating on/off, starting and ending on "on"', () => {
  for (const x of [0.1, 0.3, 0.5, 0.8, 1, 5]) {
    const p = buzzPattern(x);
    assert.ok(p.length >= 1 && p.length % 2 === 1, `odd length (ends on an on-pulse) at ${x}`);
    assert.ok(p.every(n => Number.isInteger(n) && n > 0), `whole, positive at ${x}`);
    p.forEach((n, i) => { if (i % 2 === 1) assert.equal(n, HAPTIC_GAP_MS); else assert.ok(n >= HAPTIC_MIN_ON_MS && n <= HAPTIC_MAX_ON_MS); });
  }
});
ok('a stronger moment means longer pulses, never longer gaps (the hum swells, it does not speed up)', () => {
  const soft = buzzPattern(0.2)[0];
  const strong = buzzPattern(1)[0];
  assert.ok(strong > soft);
  assert.equal(strong, HAPTIC_MAX_ON_MS);
  assert.equal(buzzPattern(1.7)[0], HAPTIC_MAX_ON_MS, 'intensity above 1 is clamped');
});
ok('the pulses fit the window and never run past it', () => {
  for (const x of [0.1, 0.5, 1]) {
    const p = buzzPattern(x);
    assert.ok(p.reduce((a, b) => a + b, 0) <= HAPTIC_WINDOW_MS, `${x}`);
  }
  assert.ok(buzzPattern(1, 50).length >= 1, 'a tiny window still gives one pulse');
});
ok('it is soft: never a long continuous run, and under half of every second is "on"', () => {
  for (const x of [0.2, 0.6, 1]) {
    const p = buzzPattern(x);
    const onTotal = p.filter((_, i) => i % 2 === 0).reduce((a, b) => a + b, 0);
    assert.ok(Math.max(...p.filter((_, i) => i % 2 === 0)) <= HAPTIC_MAX_ON_MS, 'no single long pulse');
    assert.ok(onTotal < HAPTIC_WINDOW_MS / 2, `duty ${onTotal}/${HAPTIC_WINDOW_MS}`);
  }
});
ok("the swell factor follows the drone's own LFO: 0.41..1, one cycle per breath", () => {
  const cycle = 10000;
  let lo = Infinity, hi = -Infinity;
  for (let t = 0; t <= 10; t += 0.05) { const v = swellFactor(t, cycle); lo = Math.min(lo, v); hi = Math.max(hi, v); }
  assert.ok(Math.abs(lo - 0.42 / 1.02) < 0.01 && Math.abs(hi - 1) < 0.01, `${lo} ${hi}`);
  assert.ok(Math.abs(swellFactor(0, cycle) - 0.72 / 1.02) < 1e-9);
  assert.ok(Math.abs(swellFactor(10, cycle) - swellFactor(0, cycle)) < 1e-9, 'periodic');
});

// ── the lifecycle, with fake timers and a fake motor ──
function rig(over: Partial<{ sounding: boolean; visible: boolean; reduced: boolean; intensity: number; throws: boolean }> = {}) {
  const s = { sounding: true, visible: true, reduced: false, intensity: 0.6, throws: false, ...over };
  const calls: Array<number | number[]> = [];
  let tickFn: (() => void) | null = null;
  const cleared: unknown[] = [];
  const deps: HapticBuzzDeps = {
    vibrate: (p) => { if (s.throws) throw new Error('no motor'); calls.push(p); return true; },
    isSounding: () => s.sounding,
    intensity: () => s.intensity,
    reducedMotion: () => s.reduced,
    isVisible: () => s.visible,
    setInterval: (fn) => { tickFn = fn; return 'h1'; },
    clearInterval: (h) => { cleared.push(h); tickFn = null; },
  };
  return { s, calls, cleared, deps, tick: () => tickFn?.(), hasTimer: () => tickFn !== null };
}
const isPattern = (c: number | number[]): c is number[] => Array.isArray(c);

ok('while sounding it buzzes at once and again every window', () => {
  const r = rig(); const b = createHapticBuzz(r.deps);
  b.start();
  assert.equal(r.calls.length, 1); assert.ok(isPattern(r.calls[0]) && r.calls[0].length > 1);
  r.tick(); assert.equal(r.calls.length, 2);
  b.stop();
});
ok('it never buzzes while the drone is locked, muted or yielded (not sounding)', () => {
  const r = rig({ sounding: false }); const b = createHapticBuzz(r.deps);
  b.start(); r.tick(); r.tick();
  assert.equal(r.calls.length, 0, 'nothing was ever sent to the motor');
  b.stop();
});
ok('muting while it buzzes cancels the vibration at the next tick, once', () => {
  const r = rig(); const b = createHapticBuzz(r.deps);
  b.start(); r.s.sounding = false; r.tick(); r.tick();
  assert.deepEqual(r.calls[r.calls.length - 1], 0);
  assert.equal(r.calls.filter(c => c === 0).length, 1, 'cancelled once, not on every tick');
  r.s.sounding = true; r.tick();
  assert.ok(isPattern(r.calls[r.calls.length - 1]), 'and it resumes when the sound does');
  b.stop();
});
ok('prefers-reduced-motion and a hidden tab silence it', () => {
  for (const o of [{ reduced: true }, { visible: false }]) {
    const r = rig(o); const b = createHapticBuzz(r.deps);
    b.start(); r.tick();
    assert.equal(r.calls.length, 0, JSON.stringify(o));
    b.stop();
  }
});
ok('a faint moment is silent, not a flicker', () => {
  const r = rig({ intensity: 0.05 }); const b = createHapticBuzz(r.deps);
  b.start(); r.tick();
  assert.equal(r.calls.length, 0);
  b.stop();
});
ok('stop() cancels the vibration in progress, clears the timer, and is safe twice', () => {
  const r = rig(); const b = createHapticBuzz(r.deps);
  b.start();
  b.stop(); b.stop();
  assert.deepEqual(r.calls[r.calls.length - 1], 0);
  assert.equal(r.cleared.length, 1);
  assert.equal(r.hasTimer(), false);
  assert.equal(r.calls.filter(c => c === 0).length, 1);
});
ok('start() is idempotent: one timer', () => {
  const r = rig(); const b = createHapticBuzz(r.deps);
  b.start(); const n = r.calls.length; b.start();
  assert.equal(r.calls.length, n);
  b.stop();
});
ok('a platform whose vibrate throws, or an intensity that throws, never breaks the page', () => {
  const r = rig({ throws: true }); const b = createHapticBuzz(r.deps);
  b.start(); r.tick(); b.stop();
  const r2 = rig(); r2.deps.intensity = () => { throw new Error('boom'); };
  const b2 = createHapticBuzz(r2.deps);
  b2.start(); r2.tick(); b2.stop();
  assert.equal(r2.calls.length, 0);
});

console.log('portalHaptics tests passed');
