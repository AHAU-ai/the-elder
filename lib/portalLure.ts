// lib/portalLure.ts
//
// The siren at the door. A voice that is there before anything is asked of the
// visitor: a low choir-like drone built from open fifths and octaves (no
// third, so it belongs to no mode or tradition), slowly swelling with the
// breath, with a slow rising-and-falling "call" in its upper voices. It grows
// louder and brighter as the visitor's pointer nears the door, and gives way
// to the hearth (enhancements.ts) as the door opens.
//
// Why a new voice instead of the hearth's own drone: that one is three pure
// sines at 110 Hz and a gain of ~0.05 -- a laptop or phone speaker barely
// reproduces 110 Hz and the level is far below a room's noise floor, so it is
// effectively inaudible. This one is built to be heard: harmonically rich
// (sawtooth voices through vowel-like formant filters, so the energy sits at
// 500 Hz - 2.5 kHz where small speakers work), and then held down by a limiter.
//
// What the browser allows: no page may start sound before the visitor has
// interacted with it (click, tap, key). start() builds the voice and tries;
// if the context is still locked, it sounds the moment resume() is called from
// a gesture. The caller owns the gesture listeners and a visible control.
//
// Web Audio only; no files. Safe to construct and call on the server (no-ops).

import { BREATH_CYCLE_MS } from './breathTiming';

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
}

/** The overall ceiling. The voice is limited after this, so it can never be loud. */
export const LURE_LEVEL = 0.8;
/** Fade-in once the context is running. Slow: it is an arrival, not a sound effect. */
export const LURE_FADE_IN_S = 4.5;

interface Note { f: number; g: number; wail: number }
// A3 E4 A4 E5: open fifths and octaves. `wail` = semitones the voice leans up
// during a call (0 = the root stays put and holds the drone).
const NOTES: Note[] = [
  { f: 220.0, g: 0.34, wail: 0 },
  { f: 329.63, g: 0.26, wail: 2 },
  { f: 440.0, g: 0.20, wail: 2 },
  { f: 659.26, g: 0.09, wail: 3 },
];

const FORMANTS: Array<{ f: number; q: number; g: number }> = [
  { f: 730, q: 9, g: 1.0 },   // "ah"
  { f: 1090, q: 10, g: 0.7 },
  { f: 2440, q: 12, g: 0.32 },
];

const noopLure: PortalLure = {
  start: () => {}, resume: () => {}, getState: () => 'locked', subscribe: () => () => {},
  setProximity: () => {}, setYield: () => {}, setMuted: () => {}, stop: () => {},
  meter: () => ({ rmsDb: -Infinity, peakDb: -Infinity }),
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
  let yieldGain: GainNode | null = null;
  let muteGain: GainNode | null = null;
  let analyser: AnalyserNode | null = null;
  let lastState: LureState | null = null;

  const state = (): LureState => (muted ? 'off' : ctx && ctx.state === 'running' ? 'on' : 'locked');
  const notify = () => {
    const s = state();
    if (s === lastState) return;
    lastState = s;
    subs.forEach((cb) => cb(s));
  };

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
    proxGain = c.createGain(); proxGain.gain.value = 0.4;
    tone = c.createBiquadFilter(); tone.type = 'lowpass'; tone.frequency.value = 1100; tone.Q.value = 0.5;
    const swell = c.createGain(); swell.gain.value = 0.72;
    tone.connect(swell); swell.connect(proxGain); proxGain.connect(yieldGain);
    yieldGain.connect(muteGain); muteGain.connect(master);

    // The voices go through vowel-like formants (plus a little dry signal).
    const voiceBus = c.createGain(); voiceBus.gain.value = 1;
    const dry = c.createGain(); dry.gain.value = 0.22;
    voiceBus.connect(dry); dry.connect(tone);
    for (const fm of FORMANTS) {
      const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = fm.f; bp.Q.value = fm.q;
      const g = c.createGain(); g.gain.value = fm.g * 1.6;
      voiceBus.connect(bp); bp.connect(g); g.connect(tone);
    }

    // Vibrato: one slow LFO bending every voice by a few cents.
    const vib = c.createOscillator(); vib.frequency.value = 5.1;
    vibDepth = c.createGain(); vibDepth.gain.value = 4;
    vib.connect(vibDepth);
    sources.push(vib);

    // The swell follows the breath (half its cycle, so it reads as a call).
    const swellLfo = c.createOscillator();
    swellLfo.frequency.value = 1000 / (BREATH_CYCLE_MS / 2);
    const swellDepth = c.createGain(); swellDepth.gain.value = 0.26;
    swellLfo.connect(swellDepth); swellDepth.connect(swell.gain);
    sources.push(swellLfo);

    // Voices: two detuned saws per note, a chorus of one.
    const voices: Array<{ note: Note; oscs: OscillatorNode[] }> = NOTES.map((note) => {
      const ng = c.createGain(); ng.gain.value = note.g * 0.5;
      ng.connect(voiceBus);
      const oscs = [-7, 7].map((cents) => {
        const o = c.createOscillator();
        o.type = 'sawtooth';
        o.frequency.value = note.f;
        o.detune.value = cents;
        vibDepth!.connect(o.detune);
        o.connect(ng);
        sources.push(o);
        return o;
      });
      return { note, oscs };
    });

    // A breath of air under it, so it is a presence and not a tone.
    const len = c.sampleRate * 2;
    const buf = c.createBuffer(1, len, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const noise = c.createBufferSource(); noise.buffer = buf; noise.loop = true;
    const nbp = c.createBiquadFilter(); nbp.type = 'bandpass'; nbp.frequency.value = 1700; nbp.Q.value = 0.7;
    const ng2 = c.createGain(); ng2.gain.value = 0.05;
    noise.connect(nbp); nbp.connect(ng2); ng2.connect(tone);
    sources.push(noise);

    sources.forEach((s) => s.start());

    // The call: every breath-cycle-ish the upper voices lean up a step or two
    // and settle back, like something calling across water.
    const scheduleCall = () => {
      if (stopped || !ctx) return;
      const t = ctx.currentTime;
      for (const v of voices) {
        if (!v.note.wail) continue;
        const up = v.note.f * Math.pow(2, v.note.wail / 12);
        for (const o of v.oscs) {
          o.frequency.cancelScheduledValues(t);
          o.frequency.setTargetAtTime(up, t, 0.55);
          o.frequency.setTargetAtTime(v.note.f, t + 2.6, 0.9);
        }
      }
      timers.push(window.setTimeout(scheduleCall, BREATH_CYCLE_MS / 2 + 900 + Math.random() * 1600));
    };
    timers.push(window.setTimeout(scheduleCall, 2500));
  }

  const api: PortalLure = {
    start() {
      if (started || stopped) return;
      started = true;
      try { build(); } catch { stopped = true; return; }
      ctx!.resume().catch(() => {});
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
      if (!ctx || !proxGain || !tone || !vibDepth) return;
      const x = clamp01(p), t = ctx.currentTime;
      proxGain.gain.setTargetAtTime(0.4 + 0.6 * x, t, 0.45);
      tone.frequency.setTargetAtTime(900 + 2700 * x, t, 0.45);
      vibDepth.gain.setTargetAtTime(4 + 8 * x, t, 0.6);
    },
    setYield(y) {
      if (!ctx || !yieldGain) return;
      yieldGain.gain.setTargetAtTime(1 - clamp01(y), ctx.currentTime, 0.25);
    },
    setMuted(m) {
      muted = m;
      if (ctx && muteGain) muteGain.gain.setTargetAtTime(m ? 0 : 1, ctx.currentTime, 0.3);
      notify();
    },
    stop() {
      if (stopped) return;
      stopped = true;
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
