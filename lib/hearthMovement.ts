// lib/hearthMovement.ts
//
// Axis 4 (docs/axis-4-hearth-movement.md). The fire carries a trace of the
// seeker's movement and says nothing about it. Pure and client-safe: this file
// knows the five movement names only as strings so the mapping can be tested;
// the enum itself never leaves the server (RT-2).
//
// The floor, in code:
//   - WARM-ONLY. warmth is in [0, WARMTH_MAX]; no movement dims, veils, slows
//     or stills the fire. Neutral is the floor.
//   - COARSE. Three values for five movements. Descending and Circling share
//     one, so the fire cannot tell a seeker they are circling.
//   - SUBTLE. WARMTH_MAX is a fraction of the glow layer's own maximum.

export const WARMTH_MAX = 0.06;

const WARMTH: Record<string, number> = {
  ARRIVING: 0,
  RANGING: 0,
  DESCENDING: 0.04,
  CIRCLING: 0.04,
  CROSSING: 0.06,
};

/** Warmth for a movement. Anything unknown is neutral, never a guess. */
export function warmthFor(movement: string): number {
  const w = WARMTH[movement];
  return typeof w === 'number' && w >= 0 && w <= WARMTH_MAX ? w : 0;
}

/** What the client may apply: a finite number clamped to [0, WARMTH_MAX]. */
export function clampWarmth(raw: unknown): number {
  const n = typeof raw === 'number' ? raw : Number(raw);
  if (!Number.isFinite(n)) return 0;
  return n < 0 ? 0 : n > WARMTH_MAX ? WARMTH_MAX : n;
}
