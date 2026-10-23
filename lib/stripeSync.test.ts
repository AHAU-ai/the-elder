/**
 * stripeSync.test.ts — fixture tests for billing entitlement and the
 * subscription sync (docs/stripe-billing-model.md). In-memory store, no DB,
 * no Stripe: runs in CI. Run: npx tsx lib/stripeSync.test.ts
 */
import type Stripe from 'stripe';
import { decideEntitlement } from './billingEntitlement';
import { syncSubscription, subscriptionIdFromEvent } from './stripeSync';
import type { BillingRow, BillingStore, BillingUpsert } from './billingStore';
import { planFromPriceId, priceIdForPlan, billingSlackDays } from '@/config/billing';
import type { Tier } from '@/config/entitlements';

let failures = 0;
function check(name: string, cond: boolean) {
  if (cond) console.log(`  ok  ${name}`);
  else {
    console.error(`FAIL  ${name}`);
    failures++;
  }
}

const DAY = 24 * 60 * 60 * 1000;
const NOW = new Date('2026-10-05T12:00:00Z');
const PERIOD_END = new Date('2026-11-05T12:00:00Z');

process.env.STRIPE_PRICE_KEPT_MONTHLY = 'price_km';
process.env.STRIPE_PRICE_KEPT_ANNUAL = 'price_ka';
process.env.STRIPE_PRICE_COUNCIL_MONTHLY = 'price_cm';
process.env.STRIPE_PRICE_COUNCIL_ANNUAL = 'price_ca';
delete process.env.BILLING_SLACK_DAYS;

// ---- config -------------------------------------------------------------
check('price map: kept monthly', planFromPriceId('price_km')?.tier === 'kept' && planFromPriceId('price_km')?.interval === 'month');
check('price map: council annual', planFromPriceId('price_ca')?.tier === 'council' && planFromPriceId('price_ca')?.interval === 'year');
check('price map: unknown price is null', planFromPriceId('price_nope') === null);
check('price lookup round trip', priceIdForPlan('council', 'month') === 'price_cm');
check('slack default 3', billingSlackDays() === 3);
process.env.BILLING_SLACK_DAYS = '99';
check('slack out of range falls back to 3', billingSlackDays() === 3);
delete process.env.BILLING_SLACK_DAYS;

// ---- status table ---------------------------------------------------------
const base = { tier: 'kept' as const, periodEnd: PERIOD_END, slackDays: 3, now: NOW };
const active = decideEntitlement({ ...base, status: 'active' });
check('active grants tier', active.kind === 'grant' && active.tier === 'kept');
check('active expiry = period end + slack', active.kind === 'grant' && active.expiresAt.getTime() === PERIOD_END.getTime() + 3 * DAY);
check('trialing treated as active', decideEntitlement({ ...base, status: 'trialing' }).kind === 'grant');
check('past_due keeps, never extends', decideEntitlement({ ...base, status: 'past_due' }).kind === 'keep');
check('incomplete grants nothing', decideEntitlement({ ...base, status: 'incomplete' }).kind === 'none');
check('incomplete_expired grants nothing', decideEntitlement({ ...base, status: 'incomplete_expired' }).kind === 'none');
for (const s of ['unpaid', 'paused', 'canceled']) {
  const d = decideEntitlement({ ...base, status: s });
  check(`${s} expires now`, d.kind === 'expire' && d.expiresAt.getTime() === NOW.getTime());
}
check('unknown future status grants nothing', decideEntitlement({ ...base, status: 'mystery' }).kind === 'none');

// ---- in-memory store ------------------------------------------------------
class FakeStore implements BillingStore {
  users = new Set<number>([1, 2]);
  billing = new Map<number, BillingRow>();
  tiers = new Map<number, { tier: Tier; expiresAt: Date | null }>();
  failTier = false;
  async getBillingByCustomer(c: string) {
    return [...this.billing.values()].find((r) => r.stripeCustomerId === c) ?? null;
  }
  async userExists(id: number) {
    return this.users.has(id);
  }
  async setTier(id: number, tier: Tier, expiresAt: Date | null) {
    if (this.failTier) throw new Error('db down');
    this.tiers.set(id, { tier, expiresAt });
  }
  async upsertBilling(b: BillingUpsert) {
    this.billing.set(b.userId, {
      userId: b.userId,
      stripeCustomerId: b.stripeCustomerId,
      stripeSubscriptionId: b.stripeSubscriptionId,
      planTier: b.planTier,
      billingInterval: b.billingInterval,
      stripeStatus: b.stripeStatus,
      cancelAtPeriodEnd: b.cancelAtPeriodEnd,
      currentPeriodEnd: b.currentPeriodEnd,
    });
  }
}

function sub(o: { id?: string; customer?: string; status?: string; price?: string; userId?: string; cancel?: boolean }): Stripe.Subscription {
  return {
    id: o.id ?? 'sub_1',
    customer: o.customer ?? 'cus_1',
    status: o.status ?? 'active',
    cancel_at_period_end: o.cancel ?? false,
    metadata: o.userId ? { user_id: o.userId } : {},
    items: { data: [{ price: { id: o.price ?? 'price_km' }, current_period_end: PERIOD_END.getTime() / 1000 }] },
  } as unknown as Stripe.Subscription;
}

async function main() {
  // grant, resolved through metadata (invoice.paid before checkout.session.completed)
  let st = new FakeStore();
  check('grant via metadata when no billing row yet', (await syncSubscription(sub({ userId: '1' }), st, NOW)) === 'granted');
  check('tier written', st.tiers.get(1)?.tier === 'kept');
  check('billing row created', st.billing.get(1)?.stripeSubscriptionId === 'sub_1' && st.billing.get(1)?.billingInterval === 'month');

  // duplicate delivery: same result, no drift
  await syncSubscription(sub({ userId: '1' }), st, NOW);
  check('duplicate sync is idempotent', st.tiers.get(1)?.expiresAt?.getTime() === PERIOD_END.getTime() + 3 * DAY);

  // upgrade
  await syncSubscription(sub({ price: 'price_cm' }), st, NOW);
  check('upgrade to council rewrites tier', st.tiers.get(1)?.tier === 'council' && st.billing.get(1)?.planTier === 'council');

  // cancel at period end flips flag, keeps access
  await syncSubscription(sub({ price: 'price_cm', cancel: true }), st, NOW);
  check('cancel_at_period_end recorded, still entitled', st.billing.get(1)?.cancelAtPeriodEnd === true && (st.tiers.get(1)?.expiresAt?.getTime() ?? 0) > NOW.getTime());

  // deleted tightens expiry to now
  await syncSubscription(sub({ price: 'price_cm', status: 'canceled' }), st, NOW);
  check('deleted sets expiry to now, tier kept (freeze)', st.tiers.get(1)?.expiresAt?.getTime() === NOW.getTime() && st.tiers.get(1)?.tier === 'council');

  // out of order: old subscription's stale event cannot downgrade a newer live one
  st = new FakeStore();
  await syncSubscription(sub({ id: 'sub_new', userId: '1', price: 'price_ka' }), st, NOW);
  const r = await syncSubscription(sub({ id: 'sub_old', status: 'canceled' }), st, NOW);
  check('old canceled sub ignored while new one is live', r === 'second-subscription' && st.tiers.get(1)?.tier === 'kept' && (st.tiers.get(1)?.expiresAt?.getTime() ?? 0) > NOW.getTime());

  // resubscribe after a lapse adopts the new subscription id
  st = new FakeStore();
  await syncSubscription(sub({ id: 'sub_old', userId: '1' }), st, NOW);
  await syncSubscription(sub({ id: 'sub_old', status: 'canceled' }), st, NOW);
  const re = await syncSubscription(sub({ id: 'sub_2', price: 'price_ka' }), st, NOW);
  check('resubscribe after lapse is adopted', re === 'granted' && st.billing.get(1)?.stripeSubscriptionId === 'sub_2');

  // past_due keeps the last written expiry
  st = new FakeStore();
  await syncSubscription(sub({ userId: '1' }), st, NOW);
  const before = st.tiers.get(1)?.expiresAt?.getTime();
  const pd = await syncSubscription(sub({ status: 'past_due' }), st, NOW);
  check('past_due leaves expiry untouched', pd === 'kept' && st.tiers.get(1)?.expiresAt?.getTime() === before && st.billing.get(1)?.stripeStatus === 'past_due');

  // incomplete grants nothing and writes no tier
  st = new FakeStore();
  const inc = await syncSubscription(sub({ userId: '1', status: 'incomplete' }), st, NOW);
  check('incomplete grants nothing', inc === 'none' && !st.tiers.has(1));

  // unknown price changes nothing
  st = new FakeStore();
  const up = await syncSubscription(sub({ userId: '1', price: 'price_mystery' }), st, NOW);
  check('unknown price changes nothing', up === 'unknown-price' && !st.tiers.has(1) && !st.billing.has(1));

  // unlinked: no billing row, no metadata, or metadata for a user that does not exist
  st = new FakeStore();
  check('unlinked without metadata', (await syncSubscription(sub({}), st, NOW)) === 'unlinked');
  check('unlinked for nonexistent user id', (await syncSubscription(sub({ userId: '999' }), st, NOW)) === 'unlinked');
  check('unlinked for forged non-numeric id', (await syncSubscription(sub({ userId: '1; DROP' }), st, NOW)) === 'unlinked');

  // database failure throws, so the route can return 500
  st = new FakeStore();
  st.failTier = true;
  let threw = false;
  try {
    await syncSubscription(sub({ userId: '1' }), st, NOW);
  } catch {
    threw = true;
  }
  check('database failure throws (webhook returns 500)', threw && !st.billing.has(1));

  // event -> subscription id extraction
  const ev = (type: string, object: unknown) => ({ type, data: { object } }) as unknown as Stripe.Event;
  check('subscription event id', subscriptionIdFromEvent(ev('customer.subscription.updated', { id: 'sub_9' })) === 'sub_9');
  check('checkout session subscription id', subscriptionIdFromEvent(ev('checkout.session.completed', { subscription: 'sub_8' })) === 'sub_8');
  check('invoice parent subscription id', subscriptionIdFromEvent(ev('invoice.paid', { parent: { subscription_details: { subscription: 'sub_7' } } })) === 'sub_7');
  check('invoice without subscription is ignored', subscriptionIdFromEvent(ev('invoice.paid', { parent: null })) === null);
  check('unhandled event type is ignored', subscriptionIdFromEvent(ev('charge.refunded', { id: 'ch_1' })) === null);

  if (failures > 0) {
    console.error(`\n${failures} check(s) failed`);
    process.exit(1);
  }
  console.log('\nall billing checks passed');
}

main();
