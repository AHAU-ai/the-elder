/**
 * narrativeRegister.ts
 *
 * Persistence for the age-tiered narrative register (docs/age-register-spec.md).
 * Mirrors mythLedger.ts's fail-closed shape: any DB error here must never
 * break the reading response it's attached to.
 *
 * HARD CONSTRAINT (spec §9, COPPA mitigation — treat as a legal-risk
 * invariant, not an ordinary validation rule): the 'child' tier must NEVER
 * be written to a persistent/DB-backed record, for any user, signed in or
 * not. setNarrativeRegister() below is the enforcement boundary — it
 * rejects/no-ops on 'child' rather than relying on callers to never pass
 * it. A child-register seeker's selection lives client-side only (React
 * state / sessionStorage in Threshold.tsx), regardless of auth status, and
 * is re-chosen each sitting. This module is never the place 'child' is
 * allowed to reach.
 *
 * Also gated behind NARRATIVE_REGISTER_CHILD_ENABLED (spec §11): even
 * offering the child tier as a selectable option in onboarding/the switch
 * is held behind this flag, defaulting to false, until legal + clinical
 * sign-off happens. See docs/age-register-spec.md §11 for what remains
 * open.
 *
 * The env flag alone is deliberately NOT sufficient to enable the child
 * tier -- see isChildTierEnabled() below. "Flipping the flag is a legal
 * decision, not a deploy decision" (spec §11) is enforced here, not just
 * stated: isChildTierEnabled() also requires a recorded "approved" in
 * lib/compliance/signoff-status.json (coppaChildTier), which only a human
 * editing that file after real legal review can produce. See
 * docs/signoff/coppa-legal-review-packet.md.
 */

import { neon } from '@neondatabase/serverless';
import { isApproved } from './compliance/signoffStatus';

const sql = neon(process.env.DATABASE_URL!);

export type PersistableNarrativeRegister = 'young_adult' | 'adult';
export type NarrativeRegister = 'child' | PersistableNarrativeRegister;

export const DEFAULT_NARRATIVE_REGISTER: PersistableNarrativeRegister = 'adult';

/**
 * Whether the child tier may even be offered as a selectable option.
 * Requires BOTH the env flag AND a recorded legal sign-off (see module
 * header) -- setting the env var in a deploy config is not enough on its
 * own to turn this on.
 */
export function isChildTierEnabled(): boolean {
  return process.env.NARRATIVE_REGISTER_CHILD_ENABLED === 'true' && isApproved('coppaChildTier');
}

/** A signed-in user's stored register, defaulting to 'adult' when unset or on any failure. */
export async function getNarrativeRegister(userId: number): Promise<PersistableNarrativeRegister> {
  try {
    const rows = await sql`
      SELECT narrative_register FROM elder_user WHERE id = ${userId} LIMIT 1
    `;
    const value = rows[0]?.narrative_register;
    return value === 'young_adult' ? 'young_adult' : DEFAULT_NARRATIVE_REGISTER;
  } catch {
    return DEFAULT_NARRATIVE_REGISTER;
  }
}

/**
 * Set a signed-in user's stored register. HARD NO-OP on 'child' — see the
 * module-level comment. Only 'young_adult' and 'adult' ever reach the DB.
 * Fails closed (swallows DB errors) like mythLedger.ts.
 */
export async function setNarrativeRegister(
  userId: number,
  register: NarrativeRegister
): Promise<void> {
  if (register !== 'young_adult' && register !== 'adult') {
    // 'child' (or anything else unrecognized) never persists. Silent no-op
    // by design — this is the enforcement boundary, not a place to throw.
    return;
  }
  try {
    await sql`
      UPDATE elder_user SET narrative_register = ${register} WHERE id = ${userId}
    `;
  } catch {
    // fail closed — never break the caller over a persistence hiccup
  }
}
