// lib/fireOffering.ts
//
// "Feed the fire": a seeker on the lineage-select page may offer incense, which
// bumps the same pulse a question does (a brief flare, one more trace in the
// smoke veil). Pure rate-limit so a rapid-tapping seeker cannot machine-gun the
// pulse or pile the smoke veil to its ceiling in seconds. Nothing is persisted
// and nothing is sent to a server.

export const OFFERING_MIN_GAP_MS = 1400;  // just under the flare's 2600ms decay: one offering "lands" before the next
export const OFFERING_MAX_PER_SITTING = 5;

export interface OfferingState { count: number; lastAt: number | null }
export const INITIAL_OFFERING: OfferingState = { count: 0, lastAt: null };

/** Whether an offering at `now` is accepted, and the resulting state. */
export function tryOffer(state: OfferingState, now: number): { accepted: boolean; state: OfferingState } {
  if (state.count >= OFFERING_MAX_PER_SITTING) return { accepted: false, state };
  if (state.lastAt !== null && now - state.lastAt < OFFERING_MIN_GAP_MS) return { accepted: false, state };
  return { accepted: true, state: { count: state.count + 1, lastAt: now } };
}
