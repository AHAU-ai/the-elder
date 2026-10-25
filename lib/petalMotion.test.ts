import assert from 'node:assert/strict';
import { frameScale } from './vortexMotion';
import { stepFall, gustX, follow, isOffScreen, TERMINAL_VY, type FallingPetal } from './petalMotion';

function ok(name: string, fn: () => void) {
  fn();
  console.log(`  ok  ${name}`);
}

const mk = (): FallingPetal => ({ x: 200, y: 100, vx: 3, vy: -1.2, swayPh: 0.7, swaySp: 0.02, sway: 0.5 });

/** Fall for `totalMs` of real time at `hz`, with a fixed wind. */
function fall(hz: number, totalMs: number, wind = 0) {
  const p = mk();
  const dt = 1000 / hz;
  let age = 0;
  for (let t = 0; t < totalMs; t += dt) { const k = frameScale(dt); age += k; stepFall(p, k, age, wind); }
  return p;
}

ok('drag is rate-independent: closing a gap over the same time gives the same fraction', () => {
  assert.ok(Math.abs(follow(0.04, 60) - (1 - Math.pow(0.96, 60))) < 1e-12);
  const a = 1 - (1 - follow(0.04, 1)) ** 120;       // 120 frames at 60Hz
  const b = 1 - (1 - follow(0.04, 2)) ** 60;        // the same time at 30Hz
  assert.ok(Math.abs(a - b) < 1e-9);
  assert.equal(follow(0.04, 0), 0);
  assert.equal(follow(0.04, -3), 0);
});

ok('the same 4s of real time lands in (nearly) the same place at 30, 60 and 120Hz', () => {
  const ref = fall(60, 4000, 1.4);
  for (const hz of [30, 120, 144]) {
    const p = fall(hz, 4000, 1.4);
    assert.ok(Math.abs(p.y - ref.y) / Math.abs(ref.y) < 0.03, `${hz}Hz y ${p.y} vs ${ref.y}`);
    assert.ok(Math.abs(p.x - ref.x) / Math.abs(ref.x) < 0.04, `${hz}Hz x ${p.x} vs ${ref.x}`);
  }
});

ok('a petal thrown upward by the spiral slows, turns and floats down', () => {
  const p = mk(); let age = 0; let peak = p.y;
  for (let i = 0; i < 600; i++) { age += 1; stepFall(p, 1, age, 0); peak = Math.min(peak, p.y); }
  assert.ok(peak < 100, 'it first rose');
  assert.ok(p.y > 100, 'then it came down past where it began');
  assert.ok(p.vy > 0 && p.vy <= TERMINAL_VY + 1e-9);
});

ok('every petal leaves the bottom of an 844px screen within 12 seconds, with or without wind', () => {
  for (const wind of [0, 2.4, -2.4]) {
    const p = mk(); let age = 0; let t = 0;
    while (!isOffScreen(p, 20, 390, 844) && t < 12000) { age += 1; t += 1000 / 60; stepFall(p, 1, age, wind * Math.sin(t / 520)); }
    assert.ok(isOffScreen(p, 20, 390, 844), `wind ${wind}: still on screen at ${t}ms (y=${p.y})`);
    assert.ok(t < 12000);
  }
});

ok('the gust swells, holds and dies away; it is quiet at the start and the end', () => {
  assert.equal(gustX(0, 0), 0);
  assert.equal(gustX(4000, 1.3), 0);
  let peak = 0; for (let t = 0; t <= 4000; t += 20) peak = Math.max(peak, Math.abs(gustX(t, 0)));
  assert.ok(peak > 1.5 && peak <= 2.4 + 1e-9, `peak ${peak}`);
});

ok('the gust pushes both ways and differs by petal (turbulence, not a conveyor belt)', () => {
  let pos = false, neg = false;
  for (let t = 600; t < 2600; t += 20) { const g = gustX(t, 0); if (g > 0.3) pos = true; if (g < -0.3) neg = true; }
  assert.ok(pos && neg);
  assert.notEqual(gustX(1500, 0).toFixed(3), gustX(1500, 2.1).toFixed(3));
});

ok('a stalled frame cannot fling a petal: one clamped step moves it at most ~3 frames of travel', () => {
  const p = mk(); const x0 = p.x, y0 = p.y;
  stepFall(p, frameScale(60_000), 1, 2.4);
  assert.ok(Math.abs(p.x - x0) < 40 && Math.abs(p.y - y0) < 40, `${p.x - x0}, ${p.y - y0}`);
});

ok('bad time never moves a petal (NaN, negative)', () => {
  for (const bad of [NaN, -5, 0]) {
    const p = mk(); const before = JSON.stringify(p);
    stepFall(p, frameScale(bad), 1, 2); 
    assert.equal(JSON.stringify(p), before);
  }
});

console.log('petalMotion: all passed');
