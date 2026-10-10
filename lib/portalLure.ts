// lib/portalLure.ts
//
// The voice at the door. A sound that is there before anything is asked of the
// visitor: one low, breathy earth-drone, like wind moving through a long pipe.
// A deep fundamental (A1, 55 Hz) with a second voice an octave up, a slow
// sweeping resonance that makes it breathe and "speak" without words, a little
// air, and an exhale at the start. It swells with the breath, grows louder and
// brighter as the visitor's pointer nears the door, and hands to the hearth
// (enhancements.ts) as the door opens.
//
// What it is NOT, on purpose:
//   - Not a choir or an organ: there are no stacked fifths, no vowel filters
//     and no vibrato (those are what made the first version sound like a
//     church). It is one pitch.
//   - Not any tradition's instrument. It does not imitate a particular
//     instrument or carry a particular instrument's signature (lip-buzz
//     timbre, rhythmic overtone accents). No third, so no mode. The Dreamtime
//     lineage and its instruments are not drawn on (see lib/lineages.ts
//     forbiddenMoves); a lineage-specific threshold sound would need lineage
//     sign-off before it ships.
//
// Why it is built the way it is: the hearth's own drone is three pure 110 Hz
// sines at a gain of ~0.05 -- a laptop or phone speaker barely reproduces
// 110 Hz and the level is far below a room's noise floor, so it is effectively
// inaudible. A 55 Hz fundamental is felt on a good speaker and invisible on a
// small one, so the energy that small speakers CAN play (the 5th-20th
// harmonics, 300 Hz - 1.2 kHz) is carried by a sawtooth through a slowly
// sweeping, broad resonance; the whole is then held down by a limiter. Its
// octave voice is exactly the hearth drone's root (110 Hz), so the hand-off is
// the same pitch.
//
// What the browser allows: no page may start sound before the visitor has
// interacted with it (click, tap, key). start() builds the voice and tries;
// if the context is still locked, it sounds the moment resume() is called from
// a gesture. The caller owns the gesture listeners and a visible control.
//
// Touch: where the device allows it, the drone also hums in the hand as a soft buzzing vibration
// (lib/portalHaptics.ts). It breathes with the same swell, grows as the visitor nears the door, fades as the
// hearth takes over, and is silent whenever the sound is muted or locked, the tab is hidden, or the visitor
// prefers reduced motion. It follows the sound's own mute choice; there is no separate switch.
//
// Web Audio only; no files. Safe to construct and call on the server (no-ops).

import { BREATH_CYCLE_MS } from './breathTiming';
import { createHapticBuzz, swellFactor } from './portalHaptics';

export type LureState = 'locked' | 'on' | 'off';

export interface PortalLure {
  /** Build the voice and try to start (idempotent). */
  start: () => void;
  /** Call from a user gesture: unlocks a suspended context. */
  resume: () => void;
  /** 'locked' = waiting for a gesture; 'on' = sounding; 'off' = muted by the visitor. */
  getState: () => LureState;
  /** Called whenever getState() changes. Returns an unsubscribe. */
  subscribe: (cb: (s: LureState) => void) => () => void;
  /** 0..1: how near the visitor is to the door. Louder and brighter as it rises. */
  setProximity: (p: number) => void;
  /** 0..1: how far the hearth has taken over; 1 = silent. */
  setYield: (y: number) => void;
  setMuted: (muted: boolean) => void;
  /** Fade out and release the context. */
  stop: () => void;
  /** Debug/verification: RMS and peak in dBFS of what is actually leaving the voice. */
  meter: () => { rmsDb: number; peakDb: number };
  /** Debug/verification: share of the output's power in [<150 Hz, 150-300, 300-1500, >1500 Hz]. */
  bands: () => [number, number, number, number];
}

/** The overall ceiling. The voice is limited after this, so it can never be loud. */
export const LURE_LEVEL = 0.36;
/** Fade-in once the context is running. Slow: it is an arrival, not a sound effect. */
export const LURE_FADE_IN_S = 4.5;

/** The fundamental (A1) and the octave voice (A2 = the hearth drone's root). */
const F0 = 55;
/** How long the opening exhale takes: the pitch settles down a semitone. */
const EXHALE_S = 7;

const noopLure: PortalLure = {
  start: () => {}, resume: () => {}, getState: () => 'locked', subscribe: () => () => {},
  setProximity: () => {}, setYield: () => {}, setMuted: () => {}, stop: () => {},
  meter: () => ({ rmsDb: -Infinity, peakDb: -Infinity }),
  bands: () => [0, 0, 0, 0],
};

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);

export function createPortalLure(): PortalLure {
  if (typeof window === 'undefined') return noopLure;
  const AC: typeof AudioContext | undefined =
    window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return noopLure;

  let ctx: AudioContext | null = null;
  let muted = false;
  let stopped = false;
  let started = false;
  const subs = new Set<(s: LureState) => void>();
  const timers: number[] = [];
  const sources: Array<OscillatorNode | AudioBufferSourceNode> = [];
  let proxGain: GainNode | null = null;
  let tone: BiquadFilterNode | null = null;
  let vibDepth: GainNode | null = null;
  let sweepDepth: GainNode | null = null;
  let yieldGain: GainNode | null = null;
  let muteGain: GainNode | null = null;
  let analyser: AnalyserNode | null = null;
  let lastState: LureState | null = null;
  let prox = 0;      // 0..1, kept so the buzz can follow the visitor's nearness
  let yielded = 0;   // 0..1, how far the hearth has taken over

  const state = (): LureState => (muted ? 'off' : ctx && ctx.state === 'running' ? 'on' : 'locked');
  const notify = () => {
    const s = state();
    if (s === lastState) return;
    lastState = s;
    subs.forEach((cb) => cb(s));
  };

  // The hum in the hand. Everything environmental is handed in, so the buzz itself stays testable.
  const buzz = createHapticBuzz({
    vibrate: (pattern) => (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function' ? navigator.vibrate(pattern) : false),
    isSounding: () => state() === 'on',
    // Same shape as the audio: the baseline rises with nearness (0.18..1), rides the breath swell, and fades with the yield.
    intensity: () => (0.18 + 0.82 * prox) * swellFactor(ctx ? ctx.currentTime : 0, BREATH_CYCLE_MS) * (1 - yielded),
    reducedMotion: () => typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    isVisible: () => typeof document === 'undefined' || document.visibilityState !== 'hidden',
    setInterval: (fn, ms) => window.setInterval(fn, ms),
    clearInterval: (h) => window.clearInterval(h as number),
  });

  function build() {
    const c = new AC!();
    ctx = c;
    c.onstatechange = notify;

    const master = c.createGain();
    master.gain.setValueAtTime(0, c.currentTime);
    // Scheduled now, it plays out from the moment the context is running.
    master.gain.linearRampToValueAtTime(LURE_LEVEL, c.currentTime + LURE_FADE_IN_S);

    const limiter = c.createDynamicsCompressor();
    limiter.threshold.value = -10; limiter.knee.value = 8; limiter.ratio.value = 10;
    limiter.attack.value = 0.01; limiter.release.value = 0.3;
    master.connect(limiter);
    limiter.connect(c.destination);
    analyser = c.createAnalyser();
    analyser.fftSize = 2048;
    limiter.connect(analyser);

    muteGain = c.createGain(); muteGain.gain.value = muted ? 0 : 1;
    yieldGain = c.createGain(); yieldGain.gain.value = 1;
    proxGain = c.createGain(); proxGain.gain.value = 0.18;
    tone = c.createBiquadFilter(); tone.type = 'lowpass'; tone.frequency.value = 1000; tone.Q.value = 0.5;
    const swell = c.createGain(); swell.gain.value = 0.72;
    tone.connect(swell); swell.connect(proxGain); proxGain.connect(yieldGain);
    yieldGain.connect(muteGain); muteGain.connect(master);

    // One saw voice through a broad, slowly sweeping resonance: the sweep is what
    // makes a low drone breathe and "speak". Broad (low Q) on purpose: a narrow
    // resonance sounds like a vowel, and a vowel sounds like a choir.
    const voiceBus = c.createGain(); voiceBus.gain.value = 1;
    const dry = c.createGain(); dry.gain.value = 0.55;        // the body: the low harmonics
    voiceBus.connect(dry); dry.connect(tone);

    const sweepA = c.createOscillator(); sweepA.frequency.value = 1000 / (BREATH_CYCLE_MS / 3);
    const sweepB = c.createOscillator(); sweepB.frequency.value = 1000 / (BREATH_CYCLE_MS / 2.2);
    sweepDepth = c.createGain(); sweepDepth.gain.value = 170;
    const sweepDepthB = c.createGain(); sweepDepthB.gain.value = 260;
    sweepA.connect(sweepDepth); sweepB.connect(sweepDepthB);
    sources.push(sweepA, sweepB);
    const res: Array<[number, number, GainNode]> = [[520, 0.85, sweepDepth], [1150, 0.55, sweepDepthB]];
    for (const [f, gain, depth] of res) {
      const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = f; bp.Q.value = 2.4;
      depth.connect(bp.frequency);
      const g = c.createGain(); g.gain.value = gain * 1.5;
      voiceBus.connect(bp); bp.connect(g); g.connect(tone);
    }

    // Drift: a very slow, tiny wander in pitch, so it is alive and never wobbles
    // (a fast vibrato is what makes a voice sound sung).
    const drift = c.createOscillator(); drift.frequency.value = 0.11;
    vibDepth = c.createGain(); vibDepth.gain.value = 3;
    drift.connect(vibDepth);
    sources.push(drift);

    // The swell follows the breath: one slow cycle, in step with the seam's own.
    const swellLfo = c.createOscillator();
    swellLfo.frequency.value = 1000 / BREATH_CYCLE_MS;
    const swellDepth = c.createGain(); swellDepth.gain.value = 0.3;
    swellLfo.connect(swellDepth); swellDepth.connect(swell.gain);
    sources.push(swellLfo);

    // Voices: the fundamental as a detuned pair (slow beating, warmth) and its octave.
    const voice = (f: number, g: number, cents: number[]) => {
      const ng = c.createGain(); ng.gain.value = g;
      ng.connect(voiceBus);
      for (const ct of cents) {
        const o = c.createOscillator();
        o.type = 'sawtooth';
        o.detune.value = ct;
        // The exhale: it begins a semitone high and settles onto the pitch.
        o.frequency.setValueAtTime(f * Math.pow(2, 1 / 12), c.currentTime);
        o.frequency.exponentialRampToValueAtTime(f, c.currentTime + EXHALE_S);
        vibDepth!.connect(o.detune);
        o.connect(ng);
        sources.push(o);
      }
    };
    voice(F0, 0.55, [-8, 8]);
    voice(F0 * 2, 0.3, [0]);

    // Air: breath in the pipe, low and soft, so it is a presence and not a tone.
    const len = c.sampleRate * 2;
    const buf = c.createBuffer(1, len, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const noise = c.createBufferSource(); noise.buffer = buf; noise.loop = true;
    const nbp = c.createBiquadFilter(); nbp.type = 'bandpass'; nbp.frequency.value = 650; nbp.Q.value = 0.6;
    const ng2 = c.createGain(); ng2.gain.value = 0.07;
    noise.connect(nbp); nbp.connect(ng2); ng2.connect(tone);
    sources.push(noise);

    sources.forEach((src) => src.start());
  }

  const api: PortalLure = {
    start() {
      if (started || stopped) return;
      started = true;
      try { build(); } catch { stopped = true; return; }
      ctx!.resume().catch(() => {});
      buzz.start();
      notify();
    },
    resume() {
      if (stopped) return;
      if (!started) api.start();
      if (ctx && ctx.state === 'suspended') ctx.resume().then(notify).catch(() => {});
    },
    getState: state,
    subscribe(cb) { subs.add(cb); return () => { subs.delete(cb); }; },
    setProximity(p) {
      prox = clamp01(p);
      if (!ctx || !proxGain || !tone || !vibDepth) return;
      const x = clamp01(p), t = ctx.currentTime;
      proxGain.gain.setTargetAtTime(0.18 + 0.82 * x, t, 0.45);
      tone.frequency.setTargetAtTime(900 + 2700 * x, t, 0.45);
      vibDepth.gain.setTargetAtTime(3 + 3 * x, t, 0.6);
      sweepDepth?.gain.setTargetAtTime(170 + 130 * x, t, 0.6);
    },
    setYield(y) {
      yielded = clamp01(y);
      if (!ctx || !yieldGain) return;
      yieldGain.gain.setTargetAtTime(1 - clamp01(y), ctx.currentTime, 0.25);
    },
    setMuted(m) {
      muted = m;
      // The hand goes quiet the instant the ear does, and returns with it.
      if (m) buzz.stop(); else if (started && !stopped) buzz.start();
      if (ctx && muteGain) muteGain.gain.setTargetAtTime(m ? 0 : 1, ctx.currentTime, 0.3);
      notify();
    },
    stop() {
      if (stopped) return;
      stopped = true;
      buzz.stop();
      timers.forEach((t) => window.clearTimeout(t));
      const c = ctx;
      if (!c) return;
      try { muteGain?.gain.setTargetAtTime(0, c.currentTime, 0.2); } catch { /* ignore */ }
      window.setTimeout(() => {
        sources.forEach((s) => { try { s.stop(); } catch { /* ignore */ } });
        c.close().catch(() => {});
      }, 900);
      subs.clear();
    },
    bands() {
      if (!analyser || !ctx) return [0, 0, 0, 0];
      const bins = new Float32Array(analyser.frequencyBinCount);
      analyser.getFloatFrequencyData(bins); // dB
      const hz = ctx.sampleRate / analyser.fftSize;
      const edges = [150, 300, 1500];
      const pw: [number, number, number, number] = [0, 0, 0, 0];
      for (let i = 1; i < bins.length; i++) {
        const f = i * hz;
        const k = f < edges[0] ? 0 : f < edges[1] ? 1 : f < edges[2] ? 2 : 3;
        pw[k] += Math.pow(10, bins[i] / 10);
      }
      const total = pw[0] + pw[1] + pw[2] + pw[3] || 1;
      return [pw[0] / total, pw[1] / total, pw[2] / total, pw[3] / total];
    },
    meter() {
      if (!analyser) return { rmsDb: -Infinity, peakDb: -Infinity };
      const data = new Float32Array(analyser.fftSize);
      analyser.getFloatTimeDomainData(data);
      let sum = 0, peak = 0;
      for (let i = 0; i < data.length; i++) { const a = Math.abs(data[i]); sum += data[i] * data[i]; if (a > peak) peak = a; }
      const rms = Math.sqrt(sum / data.length);
      return { rmsDb: 20 * Math.log10(rms || 1e-9), peakDb: 20 * Math.log10(peak || 1e-9) };
    },
  };
  return api;
}

/* ── the visitor's choice, remembered on this device ── */

const PREF_KEY = 'elder_portal_sound';

/** True unless the visitor has turned the landing sound off. */
export function readSoundPref(): boolean {
  try { return window.localStorage.getItem(PREF_KEY) !== 'off'; } catch { return true; }
}

export function writeSoundPref(on: boolean): void {
  try { window.localStorage.setItem(PREF_KEY, on ? 'on' : 'off'); } catch { /* ignore */ }
}
