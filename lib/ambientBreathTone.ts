// lib/ambientBreathTone.ts
//
// A soft, rolling heartbeat drum (lub-dub) played only while the seeker
// is waiting on a reading and only if they've already opted into ambient
// sound (the existing soundEnabled toggle that already gates
// FireAtmosphere -- no new preference, no new toggle). It replaces the
// earlier steady sine "beep"; the export names are unchanged so callers
// (BreathingWait) need no edits. The drum's level swells and settles with
// BREATH_PHASES, so the heart still breathes with the seeker.
//
// Deliberately uses its own AudioContext and scheduler, separate from
// lib/heartbeatDrum.ts: that module's ref-counting is shared with the
// reveal (OracleResponse takes over its existing ref), and a wait that
// unmounts mid-handoff must never be able to cut the reveal's drum short.
//
// Same fail-silent pattern as the rest of the app's audio: create on
// demand, never throw into the render path.

import { BREATH_PHASES, BREATH_CYCLE_MS } from './breathTiming';

const WAIT_BPM = 96;            // a touch quicker than resting: the fire is being asked
const LUB_DUB_GAP_SEC = 0.15;
const LUB_FREQ = 96;
const DUB_FREQ = 76;
const LUB_GAIN = 0.2;
const DUB_GAIN = 0.13;
const SCHEDULE_AHEAD_SEC = 0.2;
const TICK_MS = 50;
const BREATH_LOW = 0.5;         // drum level at the bottom of the breath
const BREATH_HIGH = 1.0;        // drum level at the top of the inhale

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let breathGain: GainNode | null = null;
let tickTimer: ReturnType<typeof setInterval> | null = null;
let cycleTimer: ReturnType<typeof setInterval> | null = null;
let nextBeat = 0;

// Reference count, not a boolean. Threshold.tsx renders BreathingWait at
// two sites gated by the same `isLoading` flag (the main panel and the
// thread/continued-conversation panel) -- both can be mounted at once
// once a seeker has had one follow-up exchange. Without counting callers,
// whichever instance unmounts first would kill the drum for the other
// still-mounted instance.
let refCount = 0;

function scheduleOneCycle() {
  if (!ctx || !breathGain) return;
  const now = ctx.currentTime;
  let t = now;

  breathGain.gain.cancelScheduledValues(now);
  breathGain.gain.setValueAtTime(BREATH_LOW, t);

  for (const phase of BREATH_PHASES) {
    const durSec = phase.duration / 1000;
    if (phase.name === 'inhale') {
      breathGain.gain.linearRampToValueAtTime(BREATH_HIGH, t + durSec);
    } else if (phase.name === 'exhale') {
      breathGain.gain.linearRampToValueAtTime(BREATH_LOW, t + durSec);
    }
    // hold / rest phases: no ramp, gain stays at whatever it reached
    t += durSec;
  }
}

// One drum stroke: a sine body whose pitch drops (the skin relaxing after
// the strike) plus a very short filtered noise tick for the stick.
function stroke(time: number, freq: number, gain: number) {
  if (!ctx || !breathGain) return;
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(freq, time);
  osc.frequency.exponentialRampToValueAtTime(freq * 0.7, time + 0.2);
  const env = ctx.createGain();
  env.gain.setValueAtTime(0, time);
  env.gain.linearRampToValueAtTime(gain, time + 0.01);
  env.gain.exponentialRampToValueAtTime(0.0001, time + 0.3);
  osc.connect(env);
  env.connect(breathGain);
  osc.start(time);
  osc.stop(time + 0.32);

  const len = Math.floor(ctx.sampleRate * 0.012);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  const click = ctx.createBufferSource();
  click.buffer = buf;
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.setValueAtTime(180, time);
  bp.Q.setValueAtTime(0.8, time);
  const cg = ctx.createGain();
  cg.gain.setValueAtTime(gain * 0.3, time);
  cg.gain.exponentialRampToValueAtTime(0.0001, time + 0.03);
  click.connect(bp);
  bp.connect(cg);
  cg.connect(breathGain);
  click.start(time);
  click.stop(time + 0.04);
}

function scheduler() {
  if (!ctx) return;
  while (nextBeat < ctx.currentTime + SCHEDULE_AHEAD_SEC) {
    stroke(nextBeat, LUB_FREQ, LUB_GAIN);
    stroke(nextBeat + LUB_DUB_GAP_SEC, DUB_FREQ, DUB_GAIN);
    // Tiny human drift (+/-10ms) so the roll doesn't feel mechanical.
    nextBeat += 60 / WAIT_BPM + (Math.random() * 0.02 - 0.01);
  }
}

export function startBreathTone(): void {
  refCount++;
  if (refCount > 1) return; // another caller already has it running

  try {
    if (!ctx) {
      ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      master = ctx.createGain();
      master.gain.setValueAtTime(1, ctx.currentTime);
      master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();

    if (tickTimer) return; // already running (defensive; refCount should prevent this)

    breathGain = ctx.createGain();
    breathGain.gain.setValueAtTime(BREATH_LOW, ctx.currentTime);
    breathGain.connect(master!);
    master!.gain.cancelScheduledValues(ctx.currentTime);
    master!.gain.setValueAtTime(1, ctx.currentTime);

    scheduleOneCycle();
    cycleTimer = setInterval(scheduleOneCycle, BREATH_CYCLE_MS);
    nextBeat = ctx.currentTime + 0.1;
    scheduler();
    tickTimer = setInterval(scheduler, TICK_MS);
  } catch {
    // AudioContext blocked or unavailable -- silent fail, matches
    // the rest of the app's audio-enhancement error handling
  }
}

export function stopBreathTone(): void {
  refCount = Math.max(0, refCount - 1);
  if (refCount > 0) return; // at least one other caller still needs it running

  try {
    if (tickTimer) { clearInterval(tickTimer); tickTimer = null; }
    if (cycleTimer) { clearInterval(cycleTimer); cycleTimer = null; }
    if (master && ctx) {
      // Let the last stroke ring out, then fade; strokes already
      // scheduled are at most SCHEDULE_AHEAD_SEC in the future.
      master.gain.cancelScheduledValues(ctx.currentTime);
      master.gain.setValueAtTime(master.gain.value, ctx.currentTime);
      master.gain.linearRampToValueAtTime(0.0001, ctx.currentTime + 0.35);
    }
    breathGain = null;
  } catch {
    // never let cleanup throw
  }
}

// A single, one-shot closing heartbeat -- not a cycling loop like
// startBreathTone. Meant for the Threshold Letter's closing ring
// contraction (scale 1.5 -> 1 over 4s): the heart slows and fades as the
// ring settles, replacing the old sustained sine hum. Independent of
// refCount/startBreathTone/stopBreathTone entirely -- it opens and closes
// its own short-lived AudioContext so it can never interact with (or get
// cut short by) any other sound that happens to still be winding down.
export function playClosingExhaleTone(durationMs: number = 4000): void {
  try {
    const c = new (window.AudioContext || (window as any).webkitAudioContext)();
    c.resume().catch(() => {});
    const durSec = durationMs / 1000;
    const start = c.currentTime + 0.05;
    const end = start + durSec;

    const stroke = (time: number, freq: number, peak: number) => {
      const osc = c.createOscillator();
      const g = c.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, time);
      osc.frequency.exponentialRampToValueAtTime(freq * 0.7, time + 0.2);
      g.gain.setValueAtTime(0, time);
      g.gain.linearRampToValueAtTime(peak, time + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0005, time + 0.3);
      osc.connect(g);
      g.connect(c.destination);
      osc.start(time);
      osc.stop(time + 0.32);
    };

    // Beats slow (gap grows 16% each time) and fade across the settle.
    let t = start;
    let gap = 0.62;
    while (t < end - 0.3) {
      const fade = Math.max(0, 1 - (t - start) / durSec);
      stroke(t,        96, 0.2 * fade);
      stroke(t + 0.15, 76, 0.13 * fade);
      t += gap;
      gap *= 1.16;
    }

    setTimeout(() => {
      try { c.close(); } catch {}
    }, durationMs + 600);
  } catch {
    // AudioContext blocked or unavailable -- silent fail, same as startBreathTone
  }
}
