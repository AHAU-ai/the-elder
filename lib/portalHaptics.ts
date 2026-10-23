// lib/portalHaptics.ts
//
// A soft buzzing under the portal's earth-drone (lib/portalLure.ts): the sound you can barely hear on
// a phone speaker, felt in the hand instead. It is the drone's body, not a notification, so it
//   - exists only while the drone is actually sounding (not locked, not muted), and fades out as it yields to the hearth,
//   - breathes with the drone: its strength follows the same slow swell, and the visitor's nearness to the door,
//   - stops when the tab is hidden, when the visitor mutes the sound, and under prefers-reduced-motion.
//
// What the platform allows, plainly: the web Vibration API can only switch the motor ON and OFF for
// stated durations. It cannot vary strength. So "soft" is made the only way it can be: a rapid train of
// very short pulses (an on-time of ~10-16 ms, below what the hand reads as a tap) with a gap between,
// where a stronger moment of the swell means slightly longer pulses. The result reads as a low hum in
// the palm, not as a series of taps. It works in Chrome on Android and other browsers that implement
// navigator.vibrate. iOS Safari does not implement it, so on an iPhone this does nothing (silently).
//
// Pure module: no DOM access of its own. Everything environmental is injected, so it is unit-tested.

/** One vibration "window": a pattern is issued for this long, then re-issued from the current intensity. */
export const HAPTIC_WINDOW_MS = 1000;
/** Pulse on-time at the softest and strongest audible moment of the swell, in ms. Below ~10 ms many motors do not respond. */
export const HAPTIC_MIN_ON_MS = 10;
export const HAPTIC_MAX_ON_MS = 16;
/** Silence between pulses, in ms. Constant, so the buzz is a steady hum whose body (not rate) swells. */
export const HAPTIC_GAP_MS = 20;
/** Below this intensity there is no buzz at all (a faint moment is silent, not a flicker). */
export const HAPTIC_FLOOR = 0.08;

/**
 * The drone's slow swell as a 0..1 factor, in step with the audio LFO (lib/portalLure.ts: swell gain
 * 0.72 + 0.3 * sin(2*pi*f*t), f = one breath cycle). Range ~0.41..1.
 */
export function swellFactor(tSeconds: number, breathCycleMs: number): number {
  const f = 1000 / breathCycleMs;
  return (0.72 + 0.3 * Math.sin(2 * Math.PI * f * tSeconds)) / 1.02;
}

/**
 * A vibration pattern (alternating on/off milliseconds, starting with "on") for one window at the given
 * intensity (0..1). Empty when the intensity is at or below the floor. Always whole, positive numbers.
 */
export function buzzPattern(intensity: number, windowMs: number = HAPTIC_WINDOW_MS): number[] {
  if (!Number.isFinite(intensity) || intensity <= HAPTIC_FLOOR) return [];
  const x = Math.min(1, intensity);
  const on = Math.round(HAPTIC_MIN_ON_MS + (HAPTIC_MAX_ON_MS - HAPTIC_MIN_ON_MS) * x);
  const step = on + HAPTIC_GAP_MS;
  const pulses = Math.max(1, Math.floor(windowMs / step));
  const pattern: number[] = [];
  for (let i = 0; i < pulses; i++) {
    pattern.push(on);
    if (i < pulses - 1) pattern.push(HAPTIC_GAP_MS);
  }
  return pattern;
}

export interface HapticBuzzDeps {
  /** navigator.vibrate, or a no-op where it does not exist. 0 or [] cancels. */
  vibrate: (pattern: number | number[]) => unknown;
  /** True only while the drone is sounding (its context running and not muted). A yield to the hearth arrives through intensity(). */
  isSounding: () => boolean;
  /** 0..1: how strong the buzz should be right now. */
  intensity: () => number;
  /** True when the visitor prefers reduced motion. */
  reducedMotion: () => boolean;
  /** False while the tab is hidden. */
  isVisible: () => boolean;
  /** Timer functions, injectable for tests. */
  setInterval: (fn: () => void, ms: number) => unknown;
  clearInterval: (handle: unknown) => void;
}

export interface HapticBuzz {
  start: () => void;
  /** Cancels any vibration in progress and stops the timer. Safe to call twice. */
  stop: () => void;
}

export function createHapticBuzz(deps: HapticBuzzDeps): HapticBuzz {
  let timer: unknown = null;
  let buzzing = false;

  const cancel = () => {
    if (!buzzing) return;
    buzzing = false;
    try { deps.vibrate(0); } catch { /* a vibrate that throws is a platform that does not do this */ }
  };

  const tick = () => {
    let pattern: number[] = [];
    try {
      const allowed = deps.isSounding() && deps.isVisible() && !deps.reducedMotion();
      pattern = allowed ? buzzPattern(deps.intensity()) : [];
    } catch {
      pattern = [];
    }
    if (pattern.length === 0) { cancel(); return; }
    try { deps.vibrate(pattern); buzzing = true; } catch { /* ignore */ }
  };

  return {
    start() {
      if (timer !== null) return;
      tick();
      timer = deps.setInterval(tick, HAPTIC_WINDOW_MS);
    },
    stop() {
      if (timer !== null) { deps.clearInterval(timer); timer = null; }
      cancel();
    },
  };
}
