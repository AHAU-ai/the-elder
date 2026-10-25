// lib/petalMotion.ts
//
// How a white petal moves once the gust lets go of it. The arrival's spiral
// (lib/vortexMotion.ts) carries petals round with the lights; at a per-petal
// moment the spiral releases them and they are caught by wind that gusts one
// way and the other, then dies away, and they drift down and out of the bottom
// of the screen. The lights do the opposite: they lift and become the fire's
// sparks (BreathGate).
//
// Like the vortex this is in time, not frames: every step takes `k`, the number
// of 60Hz frames' worth of time that passed (vortexMotion.frameScale), and the
// drag is written so that the result is the same at 30, 60 or 120Hz. Pure.

/** What a petal's fall settles to (px per 60Hz frame, about 180 px/s): a drift, not a drop,
 *  quick enough that the flurry has left the screen about when the breath begins. */
export const TERMINAL_VY = 3.0;
/** How quickly sideways speed follows the wind (fraction per 60Hz frame). */
export const WIND_FOLLOW = 0.04;
/** How quickly vertical speed settles to the drift (fraction per 60Hz frame). */
export const FALL_FOLLOW = 0.02;

export interface FallingPetal {
  x: number; y: number;          // position (px)
  vx: number; vy: number;        // velocity (px per 60Hz frame); +y is down
  swayPh: number; swaySp: number; sway: number;   // gentle side-to-side flutter
}

/** Fraction to close of a gap after `k` frames when each frame closes `f` of it. */
export function follow(f: number, k: number): number {
  return 1 - Math.pow(1 - f, Math.max(0, k));
}

/**
 * Advance a released petal by `k` frame-equivalents. `ageFrames` is how long
 * since it was released, in 60Hz frames (drives the flutter). `windX` is the
 * wind's sideways speed right now, in px per frame (it may be negative).
 */
export function stepFall(p: FallingPetal, k: number, ageFrames: number, windX: number): void {
  p.vx += (windX - p.vx) * follow(WIND_FOLLOW, k);
  p.vy += (TERMINAL_VY - p.vy) * follow(FALL_FOLLOW, k);
  p.x += (p.vx + Math.cos(ageFrames * p.swaySp + p.swayPh) * p.sway) * k;
  p.y += p.vy * k;
}

/**
 * The gust. A swell that rises, holds and dies away (`elapsedMs` since the
 * arrival began), pushing first one way and then the other, a little
 * differently for each petal (`ph`), so the flurry reads as turbulence and not
 * as a conveyor belt. Returns px per 60Hz frame.
 */
export function gustX(elapsedMs: number, ph: number): number {
  const rise = smooth(400, 1000, elapsedMs);
  const fall = 1 - smooth(2000, 3800, elapsedMs);
  return 2.4 * rise * fall * Math.sin(elapsedMs / 520 + ph * 0.6);
}

function smooth(a: number, b: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

/** True once a petal is fully past any edge it can leave by (it is never seen again). */
export function isOffScreen(p: { x: number; y: number }, size: number, w: number, h: number): boolean {
  return p.y > h + size * 2 || p.x < -size * 3 || p.x > w + size * 3;
}
