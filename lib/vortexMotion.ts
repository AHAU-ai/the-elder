// lib/vortexMotion.ts
//
// The arrival's swirl of light (app/components/BreathGate.tsx) used to count
// in *frames*: a start delay of up to 40 frames, a 14-frame fade-in, a turn of
// so many radians per frame. That ties what the visitor sees to how fast their
// device draws. A 120Hz phone turned the vortex twice as fast; a phone in Low
// Power Mode (about 30fps) turned it at half speed and started it late; a
// struggling device (a few fps) waited whole seconds for motes that the
// time-based "open out" had already dispersed, so the vortex never showed.
//
// Everything here is in milliseconds. `frameScale` converts a real elapsed time
// into "how many 60Hz frames' worth of motion this was", clamped so a stalled
// frame (backgrounded tab, long task) cannot fling a mote across the screen.
// Pure; tested in vortexMotion.test.ts.

export const FRAME_MS = 1000 / 60;
/** A single step is never longer than this, whatever the real gap was. */
export const MAX_STEP_MS = 50;

/** Length of this step in ms, clamped to [0, MAX_STEP_MS]. */
export function stepMs(dtMs: number): number {
  if (!(dtMs > 0)) return 0;
  return Math.min(dtMs, MAX_STEP_MS);
}

/** How many 60Hz frames of motion a step of `dtMs` is worth (0 .. ~3). */
export function frameScale(dtMs: number): number {
  return stepMs(dtMs) / FRAME_MS;
}

export interface PolarMote {
  a: number;   // angle around the centre of the screen (rad)
  r: number;   // distance from the centre (px)
  w: number;   // angular speed factor (signed)
  vr: number;  // outward speed while the vortex holds (px per 60Hz frame)
}

/**
 * Advance one mote by `k` frame-equivalents. Fast and tight in the heart, slow
 * at the rim (a galaxy turning); while `disperse` (0..1) rises it opens gently
 * outward. `scale` is the shorter side of the screen.
 */
export function stepPolar(m: PolarMote, k: number, disperse: number, scale: number): void {
  m.a += ((m.w * 0.03) / (1 + m.r / (scale * 0.3))) * k;
  m.r += (m.vr + disperse * (0.9 + m.r * 0.012)) * k;
}
