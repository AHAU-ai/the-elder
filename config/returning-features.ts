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

// R2/R3 (ADR-0015): the seeker's carry (a looking practice and/or one line in
// their own words). Strictly narrower than trajectory: it needs every
// trajectory gate AND its own flag, so R1 can be lit without it.
export function carryEnabled(): boolean {
  return trajectoryEnabled() && process.env.ELDER_CARRY_ENABLED === "true";
}
