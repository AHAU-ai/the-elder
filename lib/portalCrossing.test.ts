import assert from 'node:assert/strict';
import {
  HOLD_MS,
  AUTO_MS,
  RECEDE_MS,
  TAP_MS,
  COMMIT_AT,
  MAX_DT_MS,
  stepProgress,
  modeAfterRelease,
  doorFrame,
} from './portalCrossing';

function ok(name: string, fn: () => void) {
  fn();
  console.log(`  ok  ${name}`);
}

ok('a continuous hold crosses in about HOLD_MS, never early', () => {
  let p = 0;
  let t = 0;
  while (p < 1 && t < HOLD_MS * 2) {
    p = stepProgress(p, 'pushing', 16);
    t += 16;
  }
  assert.ok(p >= 1);
  assert.ok(t >= HOLD_MS - 16 && t <= HOLD_MS + 16, `crossed at ${t}ms`);
});

ok('the tap path takes AUTO_MS and is a touch slower than a hold', () => {
  assert.ok(AUTO_MS > HOLD_MS);
  let p = 0;
  let t = 0;
  while (p < 1) { p = stepProgress(p, 'auto', 16); t += 16; }
  assert.ok(Math.abs(t - AUTO_MS) <= 16);
});

ok('receding eases the door shut and floors at 0', () => {
  let p = 0.5;
  for (let t = 0; t < RECEDE_MS * 2; t += 16) p = stepProgress(p, 'receding', 16);
  assert.equal(p, 0);
});

ok('idle and crossed do not move the door', () => {
  assert.equal(stepProgress(0.4, 'idle', 50), 0.4);
  assert.equal(stepProgress(1, 'crossed', 50), 1);
});

ok('a backgrounded tab cannot teleport the door', () => {
  const p = stepProgress(0, 'pushing', 60_000);
  assert.ok(p <= MAX_DT_MS / HOLD_MS + 1e-9);
});

ok('reduced motion shortens the auto crossing', () => {
  let p = 0, t = 0;
  while (p < 1) { p = stepProgress(p, 'auto', 16, true); t += 16; }
  assert.ok(t < AUTO_MS / 2);
});

ok('release: a tap carries through; a late release carries through; an early release eases shut', () => {
  assert.equal(modeAfterRelease(0.02, TAP_MS - 1), 'auto');
  assert.equal(modeAfterRelease(COMMIT_AT, 2000), 'auto');
  assert.equal(modeAfterRelease(COMMIT_AT - 0.01, 2000), 'receding');
  assert.equal(modeAfterRelease(0, 2000), 'idle');
  assert.equal(modeAfterRelease(1, 2000), 'crossed');
});

ok('doorFrame is bounded and monotone in the directions that matter', () => {
  let prev = doorFrame(0);
  assert.equal(prev.open, 0);
  assert.equal(prev.scale, 1);
  assert.equal(prev.room, 1);
  assert.equal(prev.bloom, 0);
  for (let i = 1; i <= 100; i++) {
    const f = doorFrame(i / 100);
    for (const k of ['open', 'warm', 'room', 'embers', 'bloom'] as const) {
      assert.ok(f[k] >= 0 && f[k] <= 1, `${k} out of range at ${i}`);
    }
    assert.ok(f.open >= prev.open - 1e-9, 'open must not shrink');
    assert.ok(f.warm >= prev.warm - 1e-9, 'warm must not fall');
    assert.ok(f.scale >= prev.scale - 1e-9, 'camera only pushes forward');
    assert.ok(f.room <= prev.room + 1e-9, 'the cold room only fades');
    prev = f;
  }
  const end = doorFrame(1);
  assert.equal(end.room, 0);
  assert.equal(end.bloom, 1);
  assert.ok(end.scale > 5);
});

ok('the narration beat turns over once the door is clearly ajar', () => {
  assert.equal(doorFrame(0.05).beat, 'room');
  assert.equal(doorFrame(0.5).beat, 'crossing');
});

ok('reduced motion: no swing, no push, no particles -- only a dissolve', () => {
  for (let i = 0; i <= 20; i++) {
    const f = doorFrame(i / 20, true);
    assert.equal(f.open, 0);
    assert.equal(f.scale, 1);
    assert.equal(f.embers, 0);
    assert.equal(f.bloom, 0);
  }
  assert.equal(doorFrame(0, true).room, 1);
  assert.equal(doorFrame(1, true).room, 0);
});

console.log('portalCrossing: all passed');
