/**
 * tierLedger.ts
 *
 * Persistence for Tiered Membership (specs/tiered-membership-spec.md,
 * migrations/023_tier_membership.sql). Mirrors narrativeRegister.ts's
 * fail-closed-to-default shape: any DB error here must never break the
 * request it's attached to, and always resolves to the least-privileged
 * tier ('seeker') on failure -- never fail OPEN into a paid tier.
 *
 * "Freeze, don't hide" (spec cross-cutting rule 2): getEffectiveTier()
 * never mutates `tier` back to 'seeker' when a subscription lapses. It only
 * computes what the caller is entitled to THIS request. The stored `tier`
 * column stays at its last-paid value (billing's own record of what the
 * seeker signed up for); tier_expires_at passing is what actually
 * downgrades entitlement. Existing rows already written under the old
 * entitled tier are untouched either way -- persistence gating happens at
 * write time in the ledgers that own those rows, not by deleting or hiding
 * anything here.
 */

import { neon, type NeonQueryFunction } from '@neondatabase/serverless';
import type { Tier } from '@/config/entitlements';

let _sql: NeonQueryFunction<false, false> | null = null;
function sql(strings: TemplateStringsArray, ...values: unknown[]) {
  if (!_sql) _sql = neon(process.env.DATABASE_URL!);
  return _sql(strings, ...values);
}

export const DEFAULT_TIER: Tier = 'seeker';

function isTier(value: unknown): value is Tier {
  return value === 'seeker' || value === 'kept' || value === 'council';
}

export interface TierRecord {
  tier: Tier;
  tierExpiresAt: Date | null;
  seekerDeepenUsed: boolean;
  seekerCouncilUsed: boolean;
}

/**
 * Raw stored tier state -- NOT entitlement-adjusted. Callers that need to
 * know what the seeker is actually entitled to right now should use
 * getEffectiveTier() instead; this is for billing/account-surface code that
 * needs the seeker's own record of what they last subscribed to.
 */
export async function getTierRecord(userId: number): Promise<TierRecord> {
  try {
    const rows = await sql`
      SELECT tier, tier_expires_at, seeker_deepen_used, seeker_council_used
      FROM elder_user WHERE id = ${userId} LIMIT 1
    `;
    const row = rows[0];
    if (!row) {
      return { tier: DEFAULT_TIER, tierExpiresAt: null, seekerDeepenUsed: false, seekerCouncilUsed: false };
    }
    return {
      tier: isTier(row.tier) ? row.tier : DEFAULT_TIER,
      tierExpiresAt: row.tier_expires_at ? new Date(row.tier_expires_at) : null,
      seekerDeepenUsed: row.seeker_deepen_used === true,
      seekerCouncilUsed: row.seeker_council_used === true,
    };
  } catch (err) {
    console.error('[tierLedger] getTierRecord DB error, failing to seeker:', err);
    return { tier: DEFAULT_TIER, tierExpiresAt: null, seekerDeepenUsed: false, seekerCouncilUsed: false };
  }
}

/**
 * What the seeker is entitled to RIGHT NOW. Seeker itself never expires.
 * Kept/Council fall back to 'seeker' once tier_expires_at has passed --
 * this is the enforcement point for "freeze, don't hide": nothing here
 * deletes or hides prior writes, it only stops this request from being
 * treated as still-paid.
 */
export async function getEffectiveTier(userId: number, now: Date = new Date()): Promise<Tier> {
  const record = await getTierRecord(userId);
  if (record.tier === 'seeker') return 'seeker';
  if (record.tierExpiresAt && record.tierExpiresAt.getTime() <= now.getTime()) return 'seeker';
  return record.tier;
}

/**
 * Set a signed-in user's tier and (for a fixed-term paid tier) its expiry.
 * Billing-webhook-facing, not called from the reading path. Fails closed
 * (swallows DB errors) like narrativeRegister.ts's setNarrativeRegister.
 */
export async function setTier(userId: number, tier: Tier, expiresAt: Date | null): Promise<void> {
  try {
    await sql`
      UPDATE elder_user
      SET tier = ${tier}, tier_expires_at = ${expiresAt ? expiresAt.toISOString() : null}
      WHERE id = ${userId}
    `;
  } catch (err) {
    console.error('[tierLedger] setTier DB error:', err);
  }
}

/** Marks the Seeker's one-time free deepen as spent. Fails closed (silent). */
export async function markSeekerDeepenUsed(userId: number): Promise<void> {
  try {
    await sql`UPDATE elder_user SET seeker_deepen_used = true WHERE id = ${userId}`;
  } catch (err) {
    console.error('[tierLedger] markSeekerDeepenUsed DB error:', err);
  }
}

/** Marks the Seeker's one-time free Council Mode pairing as spent. Fails closed (silent). */
export async function markSeekerCouncilUsed(userId: number): Promise<void> {
  try {
    await sql`UPDATE elder_user SET seeker_council_used = true WHERE id = ${userId}`;
  } catch (err) {
    console.error('[tierLedger] markSeekerCouncilUsed DB error:', err);
  }
}
