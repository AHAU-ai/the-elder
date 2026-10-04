// config/returning-features.ts
// Governance-enforced flags for the returning-visitor feature.
//
// The intelligence (trajectory) layer is DESIGNED BUT NOT LIT until:
//   1. Shalom ratifies the synthetic-intimacy ceiling (Makeover v2 Appendix B)
//   2. The §1.5 marker-confirmation mechanism is implemented
//   3. The GK-007 CI suite is green
// Vincent's lineage sign-off (2026-06-28) is recorded but does NOT alone flip this.
// Flipping ELDER_TRAJECTORY is a GOVERNANCE action, not an engineering one.

export const FEATURES = {
  RETURNING_VISITOR: true,
  ELDER_TRAJECTORY: process.env.ELDER_TRAJECTORY_ENABLED === "true",
  CHARGE_MEMORY: false,
  HEARTH_RESPONDS_TO_MOVEMENT: false,
} as const;

export function trajectoryEnabled(): boolean {
  if (!FEATURES.ELDER_TRAJECTORY) return false;
  if (process.env.MARKER_CONFIRMATION_READY !== "true") return false; // §1.5 gate
  if (process.env.CEILING_RATIFIED !== "true") return false;          // Appendix B gate
  return true;
}

// Figure Continuity (docs/figure-continuity-spec.md v0.2, guard G7): a returning
// seeker may continue as their confirmed mythic figure and pair people and
// situations in their own life with characters in that figure's home myth.
// Same governance posture as the trajectory layer above: DESIGNED BUT NOT LIT.
// Flipping FIGURE_CONTINUITY_ENABLED is a GOVERNANCE action, not an engineering
// one, and not part of any PR. Read at call time (not frozen into FEATURES) so
// every gate is testable; a production env change redeploys. Three conditions
// must all hold:
//   1. FIGURE_CONTINUITY_ENABLED=true            -- the deliberate flip
//   2. MARKER_CONFIRMATION_READY=true            -- the figure is a seeker-confirmed
//      marker (section 1.5), the same gate the trajectory layer reads
//   3. FIGURE_CONTINUITY_RELEASE_VERIFIED=true   -- the release and removal paths
//      (spec G12) were verified end to end on a deployment
export function figureContinuityEnabled(): boolean {
  if (process.env.FIGURE_CONTINUITY_ENABLED !== "true") return false;        // the deliberate flip
  if (process.env.MARKER_CONFIRMATION_READY !== "true") return false;     // section 1.5 gate
  if (process.env.FIGURE_CONTINUITY_RELEASE_VERIFIED !== "true") return false; // G12 gate
  return true;
}

// Myth-first Readings (docs/myth-first-spec.md, decision D16): a new seeker's
// first Reading is told in the order myth, figure, return instead of opening
// on their situation. Returning seekers keep today's Reading.
// Same governance posture as the layers above: DESIGNED BUT NOT LIT. Flipping
// MYTH_FIRST_ENABLED is a GOVERNANCE action, not an engineering one, and not
// part of any PR. The pre-flip checklist is in the spec (MF-8): the voice
// reviews for the whole-delivery voices (maya, greek, sufi) are recorded, the
// distress-tier gate is verified on a deployment, and the flag is first set
// for a single test account. Read at call time (not frozen into FEATURES) so
// it is testable; a production env change redeploys.
export function mythFirstEnabled(): boolean {
  return process.env.MYTH_FIRST_ENABLED === "true";
}
