// lib/hearthHour.ts
//
// The hearth knows the hour. A pure model of how the room's ambient light
// leans over the course of the seeker's own local day -- nothing else.
//
// What this is NOT, deliberately (docs/inhabiting-the-elder.md, M1):
//   - Not lunar, seasonal or calendrical. The lineages disagree about
//     calendars; an hour on the seeker's own clock belongs to none of them.
//   - Not a prompt to do anything. It never reads as "go to sleep" or "stay
//     up": the floor/ceiling below keep the room clearly lit at every hour.
//   - Not data. The hour is read on the device and never leaves it.
//
// glow  -- how much the warm light pools at the foot of the screen (0..1)
// veil  -- how much the far room dims (0..1, capped well under legibility)

export interface HearthTone {
  glow: number;
  veil: number;
}

/** The room never reads as dim or out: the glow never falls below this... */
export const GLOW_FLOOR = 0.3;
/** ...and the veil never darkens past this. */
export const VEIL_CEILING = 0.12;

// [hour, glow, veil] -- night pools warm and low, dawn spreads wide, midday
// is the plainest the fire ever looks. Wraps at 24 (first anchor == last).
const ANCHORS: ReadonlyArray<readonly [number, number, number]> = [
  [0,    0.85, 0.10],
  [4.5,  0.65, 0.08],
  [6.5,  0.90, 0.02],
  [9,    0.50, 0.00],
  [13,   0.30, 0.00],
  [17,   0.50, 0.00],
  [19.5, 0.85, 0.03],
  [22,   0.90, 0.09],
  [24,   0.85, 0.10],
];

const clamp = (x: number, lo: number, hi: number) => (x < lo ? lo : x > hi ? hi : x);
const ease = (t: number) => t * t * (3 - 2 * t);

/** Tone at a fractional local hour (0 <= h < 24; out-of-range wraps). */
export function hearthToneAt(hour: number): HearthTone {
  const h = ((hour % 24) + 24) % 24;
  for (let i = 0; i < ANCHORS.length - 1; i++) {
    const [h0, g0, v0] = ANCHORS[i];
    const [h1, g1, v1] = ANCHORS[i + 1];
    if (h >= h0 && h <= h1) {
      const t = ease((h - h0) / (h1 - h0));
      return {
        glow: clamp(g0 + (g1 - g0) * t, GLOW_FLOOR, 1),
        veil: clamp(v0 + (v1 - v0) * t, 0, VEIL_CEILING),
      };
    }
  }
  return { glow: GLOW_FLOOR, veil: 0 };
}

/** Fractional hour on the seeker's own clock. */
export function localHour(d: Date): number {
  return d.getHours() + d.getMinutes() / 60;
}
