// config/billing.ts
// Maps Stripe price ids onto the existing Tier type (docs/stripe-billing-model.md).
// Pure and env-driven: price ids differ between Stripe test and live mode, so
// nothing here is hardcoded. Env is read at call time, not module scope, so a
// missing variable can never break the build.

import type { Tier } from '@/config/entitlements';

export type Interval = 'month' | 'year';
export type PaidTier = Exclude<Tier, 'seeker'>;

const PLANS = [
  { env: 'STRIPE_PRICE_KEPT_MONTHLY', tier: 'kept', interval: 'month' },
  { env: 'STRIPE_PRICE_KEPT_ANNUAL', tier: 'kept', interval: 'year' },
  { env: 'STRIPE_PRICE_COUNCIL_MONTHLY', tier: 'council', interval: 'month' },
  { env: 'STRIPE_PRICE_COUNCIL_ANNUAL', tier: 'council', interval: 'year' },
] as const;

export function planFromPriceId(
  priceId: string,
): { tier: PaidTier; interval: Interval } | null {
  for (const p of PLANS) {
    const id = process.env[p.env];
    if (id && id === priceId) return { tier: p.tier, interval: p.interval };
  }
  return null; // callers must log this loudly; an unknown price is never silent
}

export function priceIdForPlan(tier: PaidTier, interval: Interval): string | null {
  const plan = PLANS.find((p) => p.tier === tier && p.interval === interval);
  return (plan && process.env[plan.env]) || null;
}

/** Council has no feature behind it yet; it is only purchasable when explicitly switched on. */
export function isCouncilPurchasable(): boolean {
  return process.env.COUNCIL_PURCHASABLE === 'true';
}

/** Checkout stays off until the pre-charge fixes in the billing doc have shipped. */
export function isCheckoutEnabled(): boolean {
  return process.env.STRIPE_CHECKOUT_ENABLED === 'true';
}

export const DEFAULT_BILLING_SLACK_DAYS = 3;

export function billingSlackDays(): number {
  const n = Number(process.env.BILLING_SLACK_DAYS);
  return Number.isFinite(n) && n >= 0 && n <= 14 ? n : DEFAULT_BILLING_SLACK_DAYS;
}

/** Names of required billing env vars that are missing. Empty array means ready. */
export function missingBillingEnv(): string[] {
  return ['DATABASE_URL', 'STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET'].filter(
    (k) => !process.env[k],
  );
}
