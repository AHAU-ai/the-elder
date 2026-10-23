// lib/portalCrossing.ts
//
// The pure model behind the portal door (app/components/PortalGate.tsx).
// No DOM, no audio, no React -- just how far the door is open and what that
// looks like, so the feel of the crossing can be unit-tested and tuned in
// one place instead of buried in an animation loop.
//
// The door is a single number, progress 0..1:
//   - pressing and holding pushes it open ('pushing')
//   - a quick tap carries it the whole way on its own ('auto') -- the
//     always-available path for anyone who cannot or would rather not hold
//   - letting go early eases it shut again ('receding'), no penalty
//   - letting go past COMMIT_AT carries it through: once you are past the
//     coats, you are in
//
// Everything visual is derived from progress by doorFrame(); the component
// only writes those numbers to CSS custom properties.

export type DoorMode = 'idle' | 'pushing' | 'auto' | 'receding' | 'crossed';

/** Continuous hold, closed -> crossed. */
export const HOLD_MS = 2600;
/** Tap path, closed -> crossed. A touch slower than a perfect hold: unhurried. */
export const AUTO_MS = 2800;
/** Release early: how long the door takes to ease back to closed. */
export const RECEDE_MS = 1500;
/** A press shorter than this is a tap, not the start of a hold. */
export const TAP_MS = 240;
/** Letting go at or beyond this carries the door through. */
export const COMMIT_AT = 0.8;
/** Reduced-motion crossing: no push, just a gentle dissolve. */
export const REDUCED_MS = 900;
/** A stalled or backgrounded frame must not teleport the door. Generous
 *  enough that a slow device (even ~5fps) still crosses in real time rather
 *  than in slow motion; tight enough that a long stall moves it < 15%. */
export const MAX_DT_MS = 400;

export function clamp01(x: number): number {
  return x < 0 ? 0 : x > 1 ? 1 : x;
}

export function smoothstep(a: number, b: number, x: number): number {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
}

/** Advance door progress by dtMs under the given mode. */
export function stepProgress(p: number, mode: DoorMode, dtMs: number, reduced = false): number {
  const dt = Math.max(0, Math.min(dtMs, MAX_DT_MS));
  switch (mode) {
    case 'pushing':
      return clamp01(p + dt / HOLD_MS);
    case 'auto':
      return clamp01(p + dt / (reduced ? REDUCED_MS : AUTO_MS));
    case 'receding':
      return clamp01(p - dt / RECEDE_MS);
    default:
      return clamp01(p);
  }
}

/** What happens when a press ends. */
export function modeAfterRelease(p: number, pressMs: number): DoorMode {
  if (p >= 1) return 'crossed';
  if (pressMs < TAP_MS) return 'auto';
  if (p >= COMMIT_AT) return 'auto';
  return p > 0 ? 'receding' : 'idle';
}

export interface DoorFrame {
  /** 0..1 -- how far the two leaves have swung away (1 = fully open). */
  open: number;
  /** Camera push toward the door: 1 = resting, grows as you step through. */
  scale: number;
  /** 0..1 -- the cold room giving way to warmth (text colour, light cast). */
  warm: number;
  /** 0..1 -- opacity of the cold room itself; falls to 0 at the very end. */
  room: number;
  /** 0..1 -- how densely embers stream out of the doorway. */
  embers: number;
  /** 0..1 -- the white-gold flare at the moment of crossing. */
  bloom: number;
  /** Which narration beat the progress has reached. */
  beat: 'room' | 'crossing';
}

/** Everything visual, as a pure function of door progress. */
export function doorFrame(p: number, reduced = false): DoorFrame {
  const q = clamp01(p);
  if (reduced) {
    // No swing, no push, no particles: the room simply dissolves to the fire.
    return {
      open: 0,
      scale: 1,
      warm: smoothstep(0, 0.9, q),
      room: 1 - smoothstep(0.1, 1, q),
      embers: 0,
      bloom: 0,
      beat: q >= 0.3 ? 'crossing' : 'room',
    };
  }
  return {
    // The door resists at first (a stuck, heavy door), then yields.
    open: smoothstep(0.06, 0.9, q),
    // The camera only commits forward once the door is clearly ajar.
    scale: 1 + 8.5 * Math.pow(smoothstep(0.34, 1, q), 2.2),
    warm: smoothstep(0.08, 0.92, q),
    // Belt and braces: even if the CSS mask were unsupported, the room still
    // dissolves, so the crossing can never strand anyone behind a wall.
    room: 1 - smoothstep(0.82, 1, q),
    embers: smoothstep(0.12, 0.7, q),
    bloom: smoothstep(0.84, 1, q),
    beat: q >= 0.28 ? 'crossing' : 'room',
  };
}
