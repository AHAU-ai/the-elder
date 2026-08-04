// lib/ambientBreathTone.ts
//
// A soft, low ambient pad synced to BREATH_PHASES, played only while
// the seeker is waiting on a reading and only if they've already
// opted into ambient sound (the existing soundEnabled toggle that
// already gates FireAtmosphere — no new preference, no new toggle).
//
// Follows the same lightweight Web Audio pattern as playLineageTone
// in enhancements.ts: create on demand, fail silent if AudioContext
// is blocked, never throw into the render path.

import { BREATH_PHASES, BREATH_CYCLE_MS } from './breathTiming';

let ctx: AudioContext | null = null;
let osc: OscillatorNode | null = null;
let gain: GainNode | null = null;
let cycleTimer: ReturnType<typeof setInterval> | null = null;

// Reference count, not a boolean. Threshold.tsx renders BreathingWait at
// two sites gated by the same `isLoading` flag (the main panel and the
// thread/continued-conversation panel) — both can be mounted at once
// once a seeker has had one follow-up exchange. Without counting callers,
// whichever instance unmounts first would kill the tone for the other
// still-mounted instance.
let refCount = 0;

function scheduleOneCycle() {
  if (!ctx || !gain) return;
  const now = ctx.currentTime;
  let t = now;

  gain.gain.cancelScheduledValues(now);
  gain.gain.setValueAtTime(0.0001, t);

  for (const phase of BREATH_PHASES) {
    const durSec = phase.duration / 1000;
    if (phase.name === 'inhale') {
      gain.gain.linearRampToValueAtTime(0.045, t + durSec);
    } else if (phase.name === 'exhale') {
      gain.gain.linearRampToValueAtTime(0.0001, t + durSec);
    }
    // hold / rest phases: no ramp, gain stays at whatever it reached
    t += durSec;
  }
}

export function startBreathTone(): void {
  refCount++;
  if (refCount > 1) return; // another caller already has it running

  try {
    if (!ctx) ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();

    if (osc) return; // already running (defensive; refCount should prevent this)

    osc = ctx.createOscillator();
    gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(128, ctx.currentTime); // low, unobtrusive
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();

    scheduleOneCycle();
    cycleTimer = setInterval(scheduleOneCycle, BREATH_CYCLE_MS);
  } catch {
    // AudioContext blocked or unavailable — silent fail, matches
    // the rest of the app's audio-enhancement error handling
  }
}

export function stopBreathTone(): void {
  refCount = Math.max(0, refCount - 1);
  if (refCount > 0) return; // at least one other caller still needs it running

  try {
    if (cycleTimer) {
      clearInterval(cycleTimer);
      cycleTimer = null;
    }
    if (gain && ctx) {
      gain.gain.cancelScheduledValues(ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.0001, ctx.currentTime + 0.3);
    }
    if (osc) {
      const o = osc;
      setTimeout(() => { try { o.stop(); o.disconnect(); } catch {} }, 350);
      osc = null;
    }
    gain = null;
  } catch {
    // never let cleanup throw
  }
}

// A single, one-shot exhale — not a cycling loop like startBreathTone.
// Meant for the Threshold Letter's closing ring contraction (scale
// 1.5 -> 1 over 4s): the loading wait already breathes audibly via
// startBreathTone's inhale/exhale cycle, but that ends the moment a
// reading arrives, leaving the final exhale on close silent. This
// gives that last breath its own note, timed to the same 4s the ring
// takes to settle. Independent of refCount/startBreathTone/stopBreathTone
// entirely — it opens and closes its own short-lived oscillator so it
// can never interact with (or get cut short by) an unrelated loading
// tone that happens to still be winding down.
export function playClosingExhaleTone(durationMs: number = 4000): void {
  try {
    const localCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const localOsc = localCtx.createOscillator();
    const localGain = localCtx.createGain();
    const durSec = durationMs / 1000;

    localOsc.type = 'sine';
    localOsc.frequency.setValueAtTime(112, localCtx.currentTime); // a touch lower/warmer than the loading tone's 128Hz — a settling, not a repeat
    localGain.gain.setValueAtTime(0.0001, localCtx.currentTime);
    localOsc.connect(localGain);
    localGain.connect(localCtx.destination);

    localOsc.start();
    // Brief rise, then a slow fade matching the ring's own 4s settle.
    localGain.gain.linearRampToValueAtTime(0.05, localCtx.currentTime + 0.6);
    localGain.gain.linearRampToValueAtTime(0.0001, localCtx.currentTime + durSec);

    setTimeout(() => {
      try { localOsc.stop(); localOsc.disconnect(); localGain.disconnect(); localCtx.close(); } catch {}
    }, durationMs + 100);
  } catch {
    // AudioContext blocked or unavailable — silent fail, same as startBreathTone
  }
}
