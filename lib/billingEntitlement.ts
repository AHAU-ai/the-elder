/**
 * billingEntitlement.ts
 *
 * Pure mapping from a Stripe subscription status to what billing writes onto
 * elder_user (docs/stripe-billing-model.md, status table). No DB, no Stripe
 * client, so every row of the table is unit-testable.
 *
 * Billing only ever writes `tier` and `tier_expires_at`. Lapse is expiry
 * passing, never a write back to 'seeker' (freeze, don't hide).
 */

import type { PaidTier } from '@/config/billing';

const DAY_MS = 24 * 60 * 60 * 1000;

export type EntitlementDecision =
  | { kind: 'grant'; tier: PaidTier; expiresAt: Date }
  | { kind: 'expire'; tier: PaidTier; expiresAt: Date }
  | { kind: 'keep' }
  | { kind: 'none' };

export function decideEntitlement(input: {
  status: string;
  tier: PaidTier;
  periodEnd: Date;
  slackDays: number;
  now: Date;
}): EntitlementDecision {
  const { status, tier, periodEnd, slackDays, now } = input;
  switch (status) {
    case 'active':
    case 'trialing':
      return { kind: 'grant', tier, expiresAt: new Date(periodEnd.getTime() + slackDays * DAY_MS) };
    case 'past_due':
      return { kind: 'keep' };
    case 'unpaid':
    case 'paused':
    case 'canceled':
      return { kind: 'expire', tier, expiresAt: now };
    default:
      // incomplete, incomplete_expired, and any status Stripe adds later:
      // grant nothing.
      return { kind: 'none' };
  }
}
