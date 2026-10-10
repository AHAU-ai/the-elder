import assert from 'node:assert/strict';
import {
  seededRng, renderGrain, makeLoopData, createPlanner, planCrackle, softClipCurve,
  TICK_GRAINS, GRAIN_COUNT, type CrackleEvent,
} from './hearthCrackle';

const SR = 44100;

// ── rng ────────────────────────────────────────────────────────────────────
{
  const a = seededRng(42), b = seededRng(42), c = seededRng(43);
  const sa = Array.from({ length: 50 }, a), sb = Array.from({ length: 50 }, b), sc = Array.from({ length: 50 }, c);
  assert.deepEqual(sa, sb, 'same seed, same stream');
  assert.notDeepEqual(sa, sc, 'different seed, different stream');
  assert.ok(sa.every(v => v >= 0 && v < 1), 'values in [0,1)');
}

// ── grains ─────────────────────────────────────────────────────────────────
{
  const rng = seededRng(7);
  let tickLen = 0, snapLen = 0;
  for (let i = 0; i < GRAIN_COUNT; i++) {
    const g = renderGrain(i, SR, rng);
    assert.ok(g.length >= 16 && g.length <= Math.floor(SR * 0.04), `grain ${i} length in bounds`);
    let peak = 0, early = 0, total = 0;
    for (let k = 0; k < g.length; k++) {
      assert.ok(Number.isFinite(g[k]), `grain ${i} finite`);
      peak = Math.max(peak, Math.abs(g[k]));
      const e = g[k] * g[k];
      total += e;
      if (k < g.length / 4) early += e;
    }
    assert.ok(Math.abs(peak - 1) < 1e-5, `grain ${i} peak-normalised (got ${peak})`);
    // A crackle is an impulse, not a tone: nearly all its energy is up front.
    assert.ok(early / total > 0.7, `grain ${i} decays fast (early energy ${(early / total).toFixed(2)})`);
    // ...and it does not start from a hard DC step (soft ~0.15 ms attack).
    assert.ok(Math.abs(g[0]) < 0.05, `grain ${i} starts near zero`);
    if (i < TICK_GRAINS) tickLen += g.length; else snapLen += g.length;
  }
  assert.ok(tickLen / TICK_GRAINS < snapLen / (GRAIN_COUNT - TICK_GRAINS), 'ticks are shorter than snaps on average');
  assert.deepEqual(renderGrain(20, SR, seededRng(5)), renderGrain(20, SR, seededRng(5)), 'grain is deterministic per seed');
}

// ── loop noise: normalised, and the loop seam is continuous ────────────────
for (const color of ['white', 'pink', 'brown'] as const) {
  const len = SR * 2, fade = Math.floor(SR * 0.25);
  const d = makeLoopData(len, color, seededRng(11), fade);
  assert.equal(d.length, len);
  let peak = 0, stepSq = 0;
  for (let i = 0; i < len; i++) {
    assert.ok(Number.isFinite(d[i]));
    peak = Math.max(peak, Math.abs(d[i]));
    if (i > 0) stepSq += (d[i] - d[i - 1]) ** 2;
  }
  assert.ok(Math.abs(peak - 0.9) < 1e-5, `${color} peak is 0.9 (got ${peak})`);
  // The jump across the loop point must look like any other sample-to-sample
  // step -- no click when the buffer wraps.
  const typicalStep = Math.sqrt(stepSq / (len - 1));
  assert.ok(Math.abs(d[0] - d[len - 1]) < 6 * typicalStep, `${color} loop seam is continuous`);
}

// ── planner ────────────────────────────────────────────────────────────────
function plan(seed: number, seconds: number) {
  const rng = seededRng(seed);
  const s = createPlanner(0, rng);
  const events = planCrackle(s, seconds, rng);
  return { s, events, rng };
}

{
  const SECS = 600;
  const { s, events } = plan(1, SECS);

  assert.ok(events.length > 0);
  for (let i = 0; i < events.length; i++) {
    const e = events[i];
    assert.ok(e.t >= 0 && Number.isFinite(e.t), 'time is sane');
    if (i > 0) assert.ok(e.t >= events[i - 1].t, 'sorted by time');
    assert.ok(e.amp >= 0.02 && e.amp <= 1, `amp in range (${e.amp})`);
    assert.ok(e.pan >= -1 && e.pan <= 1, 'pan in range');
    assert.ok(e.depth === 0 || e.depth === 1 || e.depth === 2, 'depth is a bus');
    assert.ok(Number.isInteger(e.grain) && e.grain >= 0 && e.grain < GRAIN_COUNT, 'grain index in pool');
    assert.equal(e.grain < TICK_GRAINS, e.kind === 'tick', `grain class matches kind (${e.kind}, ${e.grain})`);
    assert.ok(e.rate > 0.7 && e.rate < 1.4, 'rate jitter in range');
    assert.ok(e.f0 >= 110 && e.f0 <= 462, 'pop fundamental in range');
  }
  assert.ok(s.nextT >= SECS, 'planner advanced to the window end');
  assert.ok(s.activity >= 0 && s.activity <= 1, 'activity stays in [0,1]');

  // Busy but not frantic.
  const rate = events.length / SECS;
  assert.ok(rate > 6 && rate < 35, `events/sec plausible (${rate.toFixed(1)})`);

  // Pops are rare: roughly one every few seconds.
  const pops = events.filter(e => e.kind === 'pop').length / SECS;
  assert.ok(pops > 0.1 && pops < 0.6, `pops/sec plausible (${pops.toFixed(2)})`);

  // Heavy-tailed loudness: mostly small, occasionally large.
  const amps = events.map(e => e.amp).sort((a, b) => a - b);
  const median = amps[Math.floor(amps.length / 2)];
  const loud = amps.filter(a => a > 0.5).length / amps.length;
  assert.ok(median < 0.2, `median amp is small (${median.toFixed(3)})`);
  assert.ok(loud > 0.005 && loud < 0.1, `a few loud events (${(loud * 100).toFixed(1)}%)`);

  // Bursty, not metronomic: counts in 250 ms bins are over-dispersed
  // (Fano factor 1 would be a plain Poisson stream; steady ticking is < 1).
  const bins = new Array(Math.floor(SECS / 0.25)).fill(0);
  for (const e of events) { const b = Math.floor(e.t / 0.25); if (b < bins.length) bins[b]++; }
  const mean = bins.reduce((a, b) => a + b, 0) / bins.length;
  const variance = bins.reduce((a, b) => a + (b - mean) ** 2, 0) / bins.length;
  assert.ok(variance / mean > 1.4, `bursty arrivals (Fano ${(variance / mean).toFixed(2)})`);

  // Lulls and flares: activity genuinely moves, rather than sitting at one level.
  const rng = seededRng(2);
  const ps = createPlanner(0, rng);
  const acts: number[] = [];
  for (let t = 1; t <= 300; t++) { planCrackle(ps, t, rng); acts.push(ps.activity); }
  const am = acts.reduce((a, b) => a + b, 0) / acts.length;
  const asd = Math.sqrt(acts.reduce((a, b) => a + (b - am) ** 2, 0) / acts.length);
  assert.ok(asd > 0.1, `activity varies over time (sd ${asd.toFixed(3)})`);
  assert.ok(Math.min(...acts) < 0.35 && Math.max(...acts) > 0.6, 'activity visits both lulls and flares');
}

// Determinism, and chunked planning (as the real 45 ms scheduler does) matches one-shot.
{
  const a = plan(9, 60).events;
  const b = plan(9, 60).events;
  assert.deepEqual(a, b, 'same seed, same fire');

  const rng = seededRng(9);
  const s = createPlanner(0, rng);
  const chunked: CrackleEvent[] = [];
  for (let t = 0.045; t < 60 + 0.045; t += 0.045) chunked.push(...planCrackle(s, Math.min(t, 60), rng));
  chunked.push(...planCrackle(s, 60, rng));
  chunked.sort((x, y) => x.t - y.t);
  assert.deepEqual(chunked, a, 'chunked planning equals one-shot planning (no state drift, no dupes)');
}

// ── safety ceiling: unity below the knee, bounded above, no makeup gain ──────
{
  const knee = 0.45;
  const c = softClipCurve(knee, 2049);
  assert.equal(c.length, 2049);
  let prev = -Infinity;
  for (let i = 0; i < c.length; i++) {
    const x = (i / (c.length - 1)) * 2 - 1;
    assert.ok(c[i] >= prev - 1e-9, 'monotonic');
    prev = c[i];
    if (Math.abs(x) <= knee) assert.ok(Math.abs(c[i] - x) < 1e-6, `exactly unity below the knee at x=${x.toFixed(3)}`);
    assert.ok(Math.abs(c[i]) <= knee + (1 - knee) * Math.tanh(1) + 1e-6, 'bounded by the ceiling');
  }
  assert.ok(Math.abs(c[0] + c[c.length - 1]) < 1e-6, 'odd-symmetric');
  assert.ok(c[c.length - 1] < 0.9, 'the ceiling sits below full scale');
}

console.log('hearthCrackle.test: ok');
