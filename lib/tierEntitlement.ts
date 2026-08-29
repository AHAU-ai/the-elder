/**
 * tierEntitlement.ts
 *
 * §Tiered Membership — server-side entitlement gate, mirroring
 * consentLedger.ts's checkConsent shape (module header, discriminated-union
 * result, fail-closed try/catch). Unlike checkConsent's current
 * "informational only" state in app/api/divine/route.ts, this gate DOES
 * block: entitlement is a billing boundary, not a governance record, and a
 * client can't be trusted to self-report its own tier (spec cross-cutting
 * rule 1: "Never trust client-side tier state").
 *
 * Anonymous (no sessionUserId) callers are always treated as Seeker with no
 * one-time grants remaining -- the one-time "taste" grants and the daily
 * counter are both tied to an account row, so a signed-out seeker gets the
 * daily cap only (via IP, at the route's existing rate-limit choke point)
 * and never the deepen/council taste, consistent with "no persistence"
 * already meaning no account-tied state exists for them.
 */

import type { Tier } from '@/config/entitlements';
import { SEEKER_DAILY_READINGS, KEPT_COUNCIL_PAIRINGS_PER_WEEK } from '@/config/entitlements';
import { getEffectiveTier, getTierRecord, markSeekerDeepenUsed, markSeekerCouncilUsed } from './tierLedger';
import { checkRateLimitDB } from './rateLimitLedger';

export type TierAction = 'primary_reading' | 'deepen' | 'council_pairing';

export type TierEntitlementResult =
  | { allowed: true; tier: Tier }
  | { allowed: false; tier: Tier; reason: 'daily_cap' | 'weekly_cap' | 'taste_used' | 'error' };

const SEEKER_READING_KEY_PREFIX = 'tier:seeker-reading:';
const KEPT_COUNCIL_KEY_PREFIX = 'tier:kept-council:';
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Check whether a signed-in seeker may take `action`, and record the
 * one-time/daily consumption when it's allowed. Fails closed: any DB error
 * blocks the action (reason 'error'), same posture as checkConsent — an
 * unreadable ledger must never be read as "unlimited access".
 */
export async function checkTierEntitlement(
  userId: number | null,
  action: TierAction
): Promise<TierEntitlementResult> {
  if (!userId) {
    // Anonymous: Seeker with no taste grants. Daily reading cap is enforced
    // by the route's existing IP-keyed checkRateLimit call, not here.
    if (action === 'primary_reading') return { allowed: true, tier: 'seeker' };
    return { allowed: false, tier: 'seeker', reason: 'taste_used' };
  }

  try {
    const tier = await getEffectiveTier(userId);
    if (tier !== 'seeker') {
      // Kept/Council: uncapped primary readings and full deepen per the
      // spec. Council pairing is uncapped for Council but capped at
      // KEPT_COUNCIL_PAIRINGS_PER_WEEK (5/week) for Kept -- same
      // rolling-window bucket mechanism as the Seeker daily cap, just a
      // 7-day window and a per-tier key so a Kept seeker's count doesn't
      // collide with (or get reset by) their own Seeker-era usage.
      if (tier === 'kept' && action === 'council_pairing') {
        const key = `${KEPT_COUNCIL_KEY_PREFIX}${userId}`;
        const rl = await checkRateLimitDB(key, KEPT_COUNCIL_PAIRINGS_PER_WEEK, WEEK_MS);
        return rl.allowed
          ? { allowed: true, tier }
          : { allowed: false, tier, reason: 'weekly_cap' };
      }
      return { allowed: true, tier };
    }

    if (action === 'primary_reading') {
      const key = `${SEEKER_READING_KEY_PREFIX}${userId}`;
      const rl = await checkRateLimitDB(key, SEEKER_DAILY_READINGS);
      return rl.allowed
        ? { allowed: true, tier: 'seeker' }
        : { allowed: false, tier: 'seeker', reason: 'daily_cap' };
    }

    const record = await getTierRecord(userId);
    if (action === 'deepen') {
      if (record.seekerDeepenUsed) return { allowed: false, tier: 'seeker', reason: 'taste_used' };
      await markSeekerDeepenUsed(userId);
      return { allowed: true, tier: 'seeker' };
    }

    // action === 'council_pairing'
    if (record.seekerCouncilUsed) return { allowed: false, tier: 'seeker', reason: 'taste_used' };
    await markSeekerCouncilUsed(userId);
    return { allowed: true, tier: 'seeker' };
  } catch (err) {
    console.error('[tierEntitlement] DB error, failing closed:', err);
    return { allowed: false, tier: 'seeker', reason: 'error' };
  }
}
