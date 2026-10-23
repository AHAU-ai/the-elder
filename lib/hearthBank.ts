// lib/hearthBank.ts
//
// The banked fire (M5, docs/inhabiting-the-elder.md). After a long absence the
// hearth is banked, not out: a little lower when the seeker arrives, then it
// catches over a few seconds. There is NO text about it, ever. A seeker who
// returns after a week and one who returns after a day simply see slightly
// different fires.
//
// What this is not:
//   - Not a streak, not a debt, not a consequence. The floor is "clearly lit":
//     the veil is capped so even a month's absence never reads as a dead fire.
//   - Not a reward for frequency: under BANK_FREE_DAYS there is no bank at all,
//     and the difference between two days and three weeks is deliberately
//     subtle enough to need noticing.
//   - Not data. The last-seen time lives in this browser's localStorage and
//     goes nowhere. It claims nothing about WHO; a cleared or shared device
//     just sees a fire that is fully lit.
//   - Not for reduced-motion seekers: with no motion there is no "catching",
//     and a permanently dim fire would be a penalty, so they see it lit.
//
// Cut condition (stated in the design doc, repeated here so it travels with the
// code): if this reads as reproach even once in testing, M5 is removed, not
// softened.

export const BANK_KEY = 'elder_hearth_seen_v1';

const DAY_MS = 24 * 60 * 60 * 1000;
/** Under this long away: no bank at all. */
export const BANK_FREE_DAYS = 2;
/** At or past this long away: the deepest the bank ever goes. */
export const BANK_FULL_DAYS = 21;
/** Veil opacity at full bank. Capped low on purpose: always clearly lit. */
export const BANK_VEIL_MAX = 0.28;
/** After arriving, how long the bank holds before the fire begins to catch. */
export const RELIGHT_DELAY_MS = 1200;
/** How long the catching takes. Slow: arrival, not loading. */
export const RELIGHT_MS = 9000;

const smooth = (t: number) => {
  const x = t < 0 ? 0 : t > 1 ? 1 : t;
  return x * x * (3 - 2 * x);
};

/** 0 = fully lit .. 1 = deepest bank, from how long the seeker has been away. */
export function bankLevel(gapMs: number): number {
  if (!Number.isFinite(gapMs) || gapMs <= BANK_FREE_DAYS * DAY_MS) return 0;
  return smooth((gapMs - BANK_FREE_DAYS * DAY_MS) / ((BANK_FULL_DAYS - BANK_FREE_DAYS) * DAY_MS));
}

/** The opacity of the dimming veil at a given bank level. */
export function bankVeilOpacity(level: number): number {
  const l = level < 0 ? 0 : level > 1 ? 1 : level;
  return l * BANK_VEIL_MAX;
}

/** Last time this browser was at the fire (epoch ms), or null if never/unreadable. */
export function readHearthSeen(): number | null {
  try {
    const raw = window.localStorage.getItem(BANK_KEY);
    if (raw === null) return null;
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? n : null;
  } catch {
    return null; // blocked storage: fully lit
  }
}

export function touchHearthSeen(nowMs: number): void {
  try {
    window.localStorage.setItem(BANK_KEY, String(nowMs));
  } catch { /* storage unavailable: the fire is simply always lit */ }
}
