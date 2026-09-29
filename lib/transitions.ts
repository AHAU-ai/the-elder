// lib/transitions.ts
//
// One shared timing/easing pair for every NAVIGATIONAL screen-to-screen
// transition in the app (a phase changing, a tab switching, one screen
// handing off to the next) -- found, during the transition-consistency
// audit, to have at least 9 different bespoke duration/easing pairs
// doing the same job across Threshold.tsx, LineageSelector.tsx,
// CouncilTabs.tsx, ThresholdLetter.tsx, and BreathGate.tsx, none of
// them coordinated with each other.
//
// Deliberately NOT used for ceremonial content PACING that happens to
// also animate opacity -- OracleResponse's word-by-word reveal and
// ThresholdLetter's multi-second per-beat cadence are intentional,
// slow, and unrelated to navigation; collapsing those into "just
// another transition" would flatten deliberate ceremonial timing into
// generic UI chrome. This governs screen swaps, not reveals.

export const TRANSITION_MS = 700;
export const TRANSITION_EASING = 'ease';

// Once a seeker has been through the opening sequence in this tab
// (the same elder_breathed flag BreathGate's own skip already uses),
// every subsequent navigational transition compresses -- consistency
// of the timing RELATIONSHIP matters more than the absolute number for
// someone who has already seen this many times and wants their
// reading, not another slow fade.
export const TRANSITION_MS_RETURNING = 350;

export function hasBreathedThisTab(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return sessionStorage.getItem('elder_breathed') === '1';
  } catch {
    return false;
  }
}

/** The duration to use for a navigational transition right now -- compressed
 *  once this tab has already been through the opening sequence once. */
export function transitionMs(): number {
  return hasBreathedThisTab() ? TRANSITION_MS_RETURNING : TRANSITION_MS;
}

// ── Exit ──────────────────────────────────────────────────────────────
// PhaseFade only ever faded the incoming screen in, so a navigation was
// "old screen vanishes instantly, then the new one fades in" -- a hard cut
// to empty between beats. The exit is the matching half: the outgoing screen
// fades out first. Deliberately shorter than the entrance (leaving should be
// quick, arriving should be unhurried), and compressed the same way for a
// returning seeker.
export const TRANSITION_EXIT_MS = 320;
export const TRANSITION_EXIT_MS_RETURNING = 180;

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** How long the outgoing screen takes to fade out before a phase swap.
 *  0 under prefers-reduced-motion: the swap is immediate, no held delay. */
export function transitionExitMs(): number {
  if (prefersReducedMotion()) return 0;
  return hasBreathedThisTab() ? TRANSITION_EXIT_MS_RETURNING : TRANSITION_EXIT_MS;
}
