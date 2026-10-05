/**
 * stripeSync.ts — re-applies one Stripe subscription onto The Elder's
 * entitlement (docs/stripe-billing-model.md, "Webhook and access check").
 *
 * Current Stripe state always wins: the webhook and the daily reconcile both
 * pass a freshly retrieved subscription through here, so duplicate and
 * out-of-order events cannot leave stale state. Idempotent by construction.
 *
 * Throws on any store failure (the caller returns 500 so Stripe retries).
 * Never writes is_tester, never touches anything but tier / tier_expires_at
 * (via the store) and the elder_billing row.
 */
import type Stripe from 'stripe';
import { planFromPriceId, billingSlackDays } from '@/config/billing';
import { decideEntitlement } from './billingEntitlement';
import type { BillingStore } from './billingStore';

export type SyncOutcome =
  | 'granted'
  | 'expired'
  | 'kept'
  | 'none'
  | 'unlinked'
  | 'second-subscription'
  | 'unknown-price';

const LIVE_STATUSES = new Set(['active', 'trialing', 'past_due']);

function customerIdOf(sub: Stripe.Subscription): string {
  return typeof sub.customer === 'string' ? sub.customer : sub.customer.id;
}

export async function syncSubscription(
  sub: Stripe.Subscription,
  store: BillingStore,
  now: Date = new Date(),
): Promise<SyncOutcome> {
  const customerId = customerIdOf(sub);

  // Resolve the user: elder_billing by customer id, else the user id checkout
  // set server-side on the subscription metadata.
  const existing = await store.getBillingByCustomer(customerId);
  let userId: number | null = existing?.userId ?? null;
  if (userId === null) {
    const meta = Number(sub.metadata?.user_id);
    if (Number.isInteger(meta) && meta > 0 && (await store.userExists(meta))) userId = meta;
  }
  if (userId === null) {
    console.error(`[stripe/unlinked] subscription ${sub.id} customer ${customerId} maps to no user`);
    return 'unlinked';
  }

  // One subscription id carries entitlement. A different, still-live one on
  // record wins; an old subscription's events must never downgrade it.
  if (
    existing?.stripeSubscriptionId &&
    existing.stripeSubscriptionId !== sub.id &&
    existing.stripeStatus &&
    LIVE_STATUSES.has(existing.stripeStatus)
  ) {
    console.error(
      `[stripe/second-subscription] user ${userId}: ${sub.id} ignored, ${existing.stripeSubscriptionId} is ${existing.stripeStatus}`,
    );
    return 'second-subscription';
  }

  if (sub.items.data.length !== 1) {
    console.error(`[stripe/items] subscription ${sub.id} has ${sub.items.data.length} items; using the first`);
  }
  const item = sub.items.data[0];
  const plan = item ? planFromPriceId(item.price.id) : null;
  if (!item || !plan) {
    console.error(`[stripe/unknown-price] subscription ${sub.id} price ${item?.price.id ?? 'none'}; nothing changed`);
    return 'unknown-price';
  }

  // basil+ API: the period end lives on the subscription item.
  const periodEnd = new Date(item.current_period_end * 1000);
  const decision = decideEntitlement({
    status: sub.status,
    tier: plan.tier,
    periodEnd,
    slackDays: billingSlackDays(),
    now,
  });
  if (sub.status === 'trialing') console.error(`[stripe/trialing] subscription ${sub.id}; no trials are configured`);

  if (decision.kind === 'grant' || decision.kind === 'expire') {
    await store.setTier(userId, decision.tier, decision.expiresAt);
  }

  await store.upsertBilling({
    userId,
    stripeCustomerId: customerId,
    stripeSubscriptionId: sub.id,
    planTier: plan.tier,
    billingInterval: plan.interval,
    stripeStatus: sub.status,
    cancelAtPeriodEnd: sub.cancel_at_period_end,
    currentPeriodEnd: periodEnd,
  });

  return decision.kind === 'grant' ? 'granted' : decision.kind === 'expire' ? 'expired' : decision.kind === 'keep' ? 'kept' : 'none';
}

/** Subscription id carried by the events this integration handles, or null. */
export function subscriptionIdFromEvent(event: Stripe.Event): string | null {
  const obj = event.data.object as unknown as Record<string, unknown>;
  switch (event.type) {
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted':
      return typeof obj.id === 'string' ? obj.id : null;
    case 'checkout.session.completed': {
      const s = obj.subscription;
      return typeof s === 'string' ? s : s && typeof (s as { id?: unknown }).id === 'string' ? (s as { id: string }).id : null;
    }
    case 'invoice.paid':
    case 'invoice.payment_failed': {
      const parent = obj.parent as { subscription_details?: { subscription?: unknown } } | null | undefined;
      const s = parent?.subscription_details?.subscription;
      return typeof s === 'string' ? s : s && typeof (s as { id?: unknown }).id === 'string' ? (s as { id: string }).id : null;
    }
    default:
      return null;
  }
}
