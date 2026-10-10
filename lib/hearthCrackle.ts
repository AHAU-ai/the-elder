// lib/hearthCrackle.ts
//
// The hearth's crackle -- how a real wood fire sounds, built from Web Audio
// primitives with no audio files.
//
// Why the old crackle read as synthetic, and what each part below does
// about it:
//   * Snaps were band-limited noise with a fairly high Q, so each one rang
//     like a small tonal "blip". A real crackle is a near-instant broadband
//     impulse with a very fast decay. -> renderGrain(): a pool of
//     pre-rendered impulse grains (varied brightness, 0.4-5 ms decay).
//   * Wood pops were a gliding triangle oscillator -- a bubble, not wood.
//     -> playPop(): a short strike exciting a few inharmonic resonances
//     (a struck stick/log), with no pitch glide.
//   * Timing was a uniform random delay, which sounds metronomic. Fire
//     comes in bursts and lulls, and kindling fragments into runs of ticks.
//     -> planCrackle(): a clustered point process whose rate follows a
//     slowly drifting "activity" level, with heavy-tailed loudness (many
//     tiny ticks, a few loud snaps, rare pops).
//   * Everything sat behind a 4.2 kHz lowpass with no high "hiss", and the
//     bed breathed on two plain sine LFOs. -> three depth buses (near, mid,
//     far: louder and brighter close, darker and wetter far), a pink
//     "flame flutter" layer, a white "hiss" layer, and bed levels driven by
//     the same activity signal as the crackle so the whole fire flares and
//     settles together instead of on a clock.
//
// The planner and grain/noise generators are pure (seedable rng, no audio
// context), so they are unit-tested and the real synth can be rendered
// offline; createHearthVoices() is the only part that touches Web Audio.

export type Rng = () => number;

/** Small deterministic rng (mulberry32) for tests and offline renders. */
export function seededRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/* ── Grains ────────────────────────────────────────────────────────────── */

/** Pool layout: indices [0, TICK_GRAINS) are fine ticks, the rest are snaps. */
export const TICK_GRAINS = 16;
export const GRAIN_COUNT = 32;

/**
 * One crackle impulse: a few sparse spikes followed by a very fast-decaying
 * noise burst, brightened by a first-difference tilt. Peak-normalised to 1.
 */
export function renderGrain(index: number, sampleRate: number, rng: Rng) {
  const isSnap = index >= TICK_GRAINS;
  const tau = isSnap ? 0.0015 + rng() * 0.0035 : 0.0004 + rng() * 0.0012; // decay const, s
  const len = Math.max(16, Math.min(Math.floor(sampleRate * 0.04), Math.ceil(sampleRate * tau * 9)));
  const out = new Float32Array(len);
  const alpha = 0.3 + rng() * 0.7;                 // brightness: 1 = white, lower = duller
  const attack = Math.max(1, Math.floor(sampleRate * 0.00015)); // ~0.15 ms: no DC click
  let lp = 0;
  let prevLp = 0;
  for (let i = 0; i < len; i++) {
    const x = rng() * 2 - 1;
    lp += alpha * (x - lp);
    const y = lp + 0.6 * (lp - prevLp);            // lean toward the top end
    prevLp = lp;
    out[i] = y * Math.exp(-i / sampleRate / tau) * Math.min(1, i / attack);
  }
  // The fine structure of a real crackle: one to three sharp sparks in its first 3 ms.
  const spikes = 1 + Math.floor(rng() * 3);
  for (let k = 0; k < spikes; k++) {
    const at = 2 + Math.floor(rng() * sampleRate * 0.003);
    if (at < len) out[at] += (rng() < 0.5 ? -1 : 1) * 1.8 * Math.exp(-at / sampleRate / tau);
  }
  let peak = 0;
  for (let i = 0; i < len; i++) peak = Math.max(peak, Math.abs(out[i]));
  const norm = peak > 0 ? 1 / peak : 1;
  for (let i = 0; i < len; i++) out[i] *= norm;
  return out;
}

export type NoiseColor = 'white' | 'pink' | 'brown';

/**
 * Seamlessly loopable noise of `len` samples. Generates len + fade samples and
 * equal-power crossfades the extra tail into the head, so the loop point
 * continues exactly where the original stream would have.
 */
export function makeLoopData(len: number, color: NoiseColor, rng: Rng, fade: number) {
  const total = len + fade;
  const x = new Float32Array(total);
  let b0 = 0, b1 = 0, b2 = 0, brown = 0;
  for (let i = 0; i < total; i++) {
    const w = rng() * 2 - 1;
    if (color === 'white') {
      x[i] = w;
    } else if (color === 'pink') {
      // Paul Kellet's economy pink filter
      b0 = 0.99765 * b0 + w * 0.099046;
      b1 = 0.963 * b1 + w * 0.2965164;
      b2 = 0.57 * b2 + w * 1.0526913;
      x[i] = (b0 + b1 + b2 + w * 0.1848) * 0.2;
    } else {
      brown = (brown + 0.02 * w) / 1.02;
      x[i] = brown;
    }
  }
  const out = new Float32Array(len);
  for (let i = 0; i < len; i++) out[i] = x[i];
  for (let i = 0; i < fade; i++) {
    const t = i / fade;
    out[i] = x[i] * Math.sqrt(t) + x[len + i] * Math.sqrt(1 - t);
  }
  let peak = 0;
  for (let i = 0; i < len; i++) peak = Math.max(peak, Math.abs(out[i]));
  const norm = peak > 0 ? 0.9 / peak : 1;
  for (let i = 0; i < len; i++) out[i] *= norm;
  return out;
}

/* ── Planner (pure) ────────────────────────────────────────────────────── */

export type CrackleKind = 'tick' | 'snap' | 'pop';

export interface CrackleEvent {
  /** Absolute time on the audio clock, seconds. */
  t: number;
  kind: CrackleKind;
  /** 0..1 loudness, heavy-tailed: mostly small, occasionally large. */
  amp: number;
  /** -1..1, centre-weighted. */
  pan: number;
  /** 0 near, 1 mid, 2 far. */
  depth: 0 | 1 | 2;
  /** Index into the grain pool. */
  grain: number;
  /** Playback-rate jitter for the grain. */
  rate: number;
  /** Pop body fundamental, Hz (pops only). */
  f0: number;
}

export interface PlannerState {
  /** 0..1, how lively the fire is right now. Drifts slowly; also drives the bed. */
  activity: number;
  target: number;
  retargetAt: number;
  /** Time of the next primary event to plan. */
  nextT: number;
  lastT: number;
}

const LAMBDA_MIN = 3;   // primary events per second at the calmest
const LAMBDA_MAX = 17;  // ... and at the liveliest
const ACTIVITY_TAU = 1.1;

export function createPlanner(t0: number, rng: Rng): PlannerState {
  const target = 0.12 + 0.88 * Math.pow(rng(), 1.4);
  return { activity: 0.4, target, retargetAt: t0 + 1, nextT: t0, lastT: t0 };
}

function makeEvent(t: number, kind: CrackleKind, amp: number, pan: number, depth: 0 | 1 | 2, rng: Rng): CrackleEvent {
  const grain = kind === 'tick'
    ? Math.floor(rng() * TICK_GRAINS)
    : TICK_GRAINS + Math.floor(rng() * (GRAIN_COUNT - TICK_GRAINS));
  const rate = kind === 'tick' ? 0.85 + rng() * 0.5 : kind === 'snap' ? 0.75 + rng() * 0.45 : 0.9 + rng() * 0.3;
  const f0 = 110 * Math.pow(4.2, rng());          // 110-462 Hz, log-uniform
  return { t, kind, amp: clamp(amp, 0.02, 1), pan: clamp(pan, -1, 1), depth, grain, rate, f0 };
}

/**
 * Plan every crackle event whose primary time falls before `until`, advancing
 * the planner. Follow-on ticks of a cluster may land a few ms past `until`.
 * The caller keeps `state.nextT` at or after the audio clock's "now".
 */
export function planCrackle(s: PlannerState, until: number, rng: Rng): CrackleEvent[] {
  const events: CrackleEvent[] = [];
  while (s.nextT < until) {
    const t = s.nextT;
    const dt = Math.max(0, t - s.lastT);
    s.lastT = t;
    if (t >= s.retargetAt) {
      s.target = 0.12 + 0.88 * Math.pow(rng(), 1.4);
      s.retargetAt = t + 0.8 + rng() * 2.2;
    }
    s.activity += (s.target - s.activity) * (1 - Math.exp(-dt / ACTIVITY_TAU));

    const r = rng();
    // ~2.5% pops (about one every 3-4 s at typical activity), ~27% snaps, the rest ticks.
    const kind: CrackleKind = r < 0.025 ? 'pop' : r < 0.30 ? 'snap' : 'tick';
    const u = rng();
    const live = 0.8 + 0.2 * s.activity;
    const amp = (kind === 'pop'
      ? 0.45 + 0.55 * Math.pow(rng(), 0.8)
      : kind === 'snap'
        ? 0.12 + 0.55 * Math.pow(u, 2.2)
        : 0.03 + 0.30 * Math.pow(u, 2.8)) * live;
    const d = rng();
    const depth: 0 | 1 | 2 = kind === 'pop'
      ? (d < 0.7 ? 0 : 1)
      : (d < 0.5 ? 0 : d < 0.85 ? 1 : 2);
    const pan = ((rng() + rng() + rng()) / 1.5 - 1) * 0.8;
    const parent = makeEvent(t, kind, amp, pan, depth, rng);
    events.push(parent);

    // Kindling fragments: a quick run of ticks (and the odd snap) after the main event.
    const clusterP = kind === 'pop' ? 0.35 : kind === 'snap' ? 0.25 : 0.12;
    if (rng() < clusterP) {
      const n = 1 + Math.floor(rng() * 4);
      let ct = t;
      for (let i = 1; i <= n; i++) {
        ct += Math.max(0.003, -Math.log(1 - rng()) * 0.016);
        const childKind: CrackleKind = rng() < 0.7 ? 'tick' : 'snap';
        const childAmp = parent.amp * Math.pow(0.55, i) * (0.6 + rng() * 0.5);
        events.push(makeEvent(ct, childKind, childAmp, parent.pan + (rng() - 0.5) * 0.16, parent.depth, rng));
      }
    }

    const lambda = LAMBDA_MIN + (LAMBDA_MAX - LAMBDA_MIN) * s.activity;
    s.nextT = t + -Math.log(1 - rng()) / lambda;
  }
  events.sort((a, b) => a.t - b.t);
  return events;
}

/* ── Safety ceiling ────────────────────────────────────────────────────── */

/**
 * Transfer curve for a WaveShaperNode used as a safety ceiling: exactly
 * unity (y = x) up to `knee`, then a smooth tanh roll-off that never exceeds
 * knee + (1 - knee) * tanh(1) (~0.87 for the default). Crackle loudness is
 * deliberately heavy-tailed -- the odd big pop -- and this guarantees it can
 * never startle, least of all on headphones. Unlike a DynamicsCompressorNode
 * it has NO makeup gain, so everything below the knee (the drone, the drum,
 * the bed) comes out bit-for-bit as before.
 */
export function softClipCurve(knee = 0.45, points = 2049) {
  const curve = new Float32Array(points);
  for (let i = 0; i < points; i++) {
    const x = (i / (points - 1)) * 2 - 1;
    const a = Math.abs(x);
    const y = a <= knee ? a : knee + (1 - knee) * Math.tanh((a - knee) / (1 - knee));
    curve[i] = x < 0 ? -y : y;
  }
  return curve;
}

/* ── Voices (Web Audio) ────────────────────────────────────────────────── */

export interface VoiceIO {
  /** Dry output (the hearth's master gain). Crackle and hiss go here directly. */
  dry: AudioNode;
  /** Reverb input (the hearth room). */
  wet: AudioNode;
  /** The warm bed chain (low-passed, with a woody bloom) for roar and hush. */
  bed: AudioNode;
}

export interface HearthVoices {
  play(ev: CrackleEvent): void;
  /** Drive the bed from the planner's activity. Cheap; call as often as the planner ticks. */
  updateBed(activity: number, now: number): void;
  stop(): void;
}

// Depth buses: near is full-range and mostly dry; far is quieter, duller, wetter.
const DEPTHS = [
  { gain: 1.0,  lp: 11000, send: 0.10 },
  { gain: 0.66, lp: 6200,  send: 0.28 },
  { gain: 0.40, lp: 3400,  send: 0.55 },
] as const;

// Struck-log resonances: [frequency ratio, Q, relative level]. Free-bar-like
// ratios (1 : 2.76 : 5.40) give a woody, inharmonic "tok" rather than a note.
const POP_MODES = [
  [1.0,  18, 1.0],
  [2.76, 24, 0.55],
  [5.4,  30, 0.28],
] as const;

// Levels, tuned by offline render (see the PR notes): crackle sits clearly
// above the bed but well under the limiter.
const CRACKLE_LEVEL = 0.75;
const MODE_MAKEUP = 7;
const FLUTTER_LEVEL = 0.10;
const HISS_LEVEL = 0.022;   // per channel; the two channels are independent noise

export function createHearthVoices(ctx: BaseAudioContext, io: VoiceIO, rng: Rng): HearthVoices {
  const sr = ctx.sampleRate;

  // Grain pool.
  const grains: AudioBuffer[] = [];
  for (let i = 0; i < GRAIN_COUNT; i++) {
    const d = renderGrain(i, sr, rng);
    const b = ctx.createBuffer(1, d.length, sr);
    b.copyToChannel(d, 0);
    grains.push(b);
  }

  // Depth buses.
  const buses: GainNode[] = DEPTHS.map(cfg => {
    const input = ctx.createGain();
    input.gain.value = cfg.gain;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = cfg.lp;
    lp.Q.value = 0.5;
    const send = ctx.createGain();
    send.gain.value = cfg.send;
    input.connect(lp);
    lp.connect(io.dry);
    lp.connect(send);
    send.connect(io.wet);
    return input;
  });

  function route(ev: CrackleEvent, level: number): GainNode {
    const out = ctx.createGain();
    out.gain.value = ev.amp * level;
    if (typeof ctx.createStereoPanner === 'function') {
      const p = ctx.createStereoPanner();
      p.pan.value = ev.pan;
      out.connect(p);
      p.connect(buses[ev.depth]);
    } else {
      out.connect(buses[ev.depth]);
    }
    return out;
  }

  function playGrain(ev: CrackleEvent, grain: number, rate: number, level: number) {
    const src = ctx.createBufferSource();
    src.buffer = grains[grain];
    src.playbackRate.value = rate;
    src.connect(route(ev, level));
    src.start(ev.t);
  }

  function playPop(ev: CrackleEvent) {
    // Body: a soft strike excites the log's resonances.
    const out = route(ev, CRACKLE_LEVEL);
    const excite = ctx.createBufferSource();
    excite.buffer = grains[TICK_GRAINS + (ev.grain % (GRAIN_COUNT - TICK_GRAINS))];
    excite.playbackRate.value = 0.55 + (ev.rate - 0.9) * 0.8;
    for (const [ratio, q, lvl] of POP_MODES) {
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = ev.f0 * ratio;
      bp.Q.value = q;
      const g = ctx.createGain();
      g.gain.value = lvl * MODE_MAKEUP;
      excite.connect(bp);
      bp.connect(g);
      g.connect(out);
    }
    excite.start(ev.t);
    // The sharp crack on top of the body.
    playGrain(ev, ev.grain, ev.rate, CRACKLE_LEVEL * 0.9);
  }

  // The bed.
  const loops: AudioBufferSourceNode[] = [];
  function loopSource(color: NoiseColor, seconds: number): AudioBufferSourceNode {
    const len = Math.floor(sr * seconds);
    const data = makeLoopData(len, color, rng, Math.floor(sr * 0.25));
    const buf = ctx.createBuffer(1, len, sr);
    buf.copyToChannel(data, 0);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    src.playbackRate.value = 0.92 + rng() * 0.16;
    loops.push(src);
    return src;
  }
  function layer(color: NoiseColor, seconds: number, type: BiquadFilterType, freq: number, q: number, base: number, dest: AudioNode): GainNode {
    const src = loopSource(color, seconds);
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = ctx.createGain();
    g.gain.value = base;
    src.connect(f);
    f.connect(g);
    g.connect(dest);
    return g;
  }

  const t0 = ctx.currentTime;
  const bedOut = ctx.createGain();            // fades in over 4 s, as the fire catches
  bedOut.gain.setValueAtTime(0, t0);
  bedOut.gain.linearRampToValueAtTime(0.16, t0 + 4);
  bedOut.connect(io.bed);

  const roar = layer('brown', 6, 'lowpass', 320, 0.7, 0.55, bedOut);      // deep warm roar
  const hush = layer('brown', 6, 'bandpass', 900, 0.6, 0.16, bedOut);     // soft licking hush
  // Flame flutter: two independent noise sources left and right, so it
  // surrounds the listener instead of sitting in the middle.
  const flutters = [-0.5, 0.5].map(pan => {
    if (typeof ctx.createStereoPanner !== 'function') return layer('pink', 4, 'bandpass', 1250, 0.8, 0, bedOut);
    const p = ctx.createStereoPanner();
    p.pan.value = pan;
    p.connect(bedOut);
    return layer('pink', 4, 'bandpass', 1250, 0.8, 0, p);
  });

  // Hiss (steam and escaping gas): high and airy, bypasses the warm lowpass.
  // Two independent white-noise channels hard-ish left and right -- real room
  // hiss reaches each ear differently, and this is most of the sense of space.
  const hissSend = ctx.createGain();
  hissSend.gain.value = 0.2;
  hissSend.connect(io.wet);
  const hisses = [-0.9, 0.9].map(pan => {
    const src = loopSource('white', 3);
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 2600;
    hp.Q.value = 0.5;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 9000;
    lp.Q.value = 0.5;
    const g = ctx.createGain();
    g.gain.value = 0;
    src.connect(hp);
    hp.connect(lp);
    lp.connect(g);
    if (typeof ctx.createStereoPanner === 'function') {
      const p = ctx.createStereoPanner();
      p.pan.value = pan;
      g.connect(p);
      p.connect(io.dry);
      p.connect(hissSend);
    } else {
      g.connect(io.dry);
      g.connect(hissSend);
    }
    return g;
  });

  for (const l of loops) l.start();

  let nextBed = 0;
  let nextFlutter = 0;
  let nextHiss = 0;
  function updateBed(activity: number, now: number) {
    const a = clamp(activity, 0, 1);
    if (now >= nextBed) {                      // slow layers: no need to automate every tick
      nextBed = now + 0.3;
      roar.gain.setTargetAtTime(0.55 * (0.62 + 0.80 * a), now, 0.35);
      hush.gain.setTargetAtTime(0.16 * (0.60 + 0.85 * a), now, 0.30);
    }
    if (now >= nextFlutter) {                  // irregular flutter, never a fixed LFO
      nextFlutter = now + 0.06 + rng() * 0.09;
      for (const f of flutters) {
        f.gain.setTargetAtTime((0.2 + 0.8 * Math.pow(rng(), 1.3)) * (0.35 + 0.9 * a) * FLUTTER_LEVEL, now, 0.03);
      }
    }
    if (now >= nextHiss) {
      nextHiss = now + 0.4 + rng() * 0.9;
      for (const h of hisses) {
        h.gain.setTargetAtTime(HISS_LEVEL * (0.25 + a * a * (0.6 + rng() * 0.8)), now, 0.25);
      }
    }
  }

  return {
    play(ev) {
      if (ev.kind === 'pop') playPop(ev);
      else playGrain(ev, ev.grain, ev.rate, CRACKLE_LEVEL * (ev.kind === 'snap' ? 1 : 0.8));
    },
    updateBed,
    stop() {
      for (const l of loops) { try { l.stop(); } catch { /* already stopped */ } }
    },
  };
}
