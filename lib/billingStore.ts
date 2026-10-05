/**
 * billingStore.ts — Neon persistence for elder_billing and stripe_event
 * (migrations/031_stripe_billing.sql). Unlike tierLedger's fail-closed
 * setters, everything here THROWS on a database error: the webhook turns a
 * throw into a 500 so Stripe retries, and an infrastructure failure never
 * looks like a processed payment.
 */
import { neon, type NeonQueryFunction } from '@neondatabase/serverless';
import { setTierStrict } from './tierLedger';
import type { Tier } from '@/config/entitlements';
import type { Interval, PaidTier } from '@/config/billing';

let _sql: NeonQueryFunction<false, false> | null = null;
function sql(strings: TemplateStringsArray, ...values: unknown[]) {
  if (!_sql) _sql = neon(process.env.DATABASE_URL!);
  return _sql(strings, ...values);
}

export interface BillingRow {
  userId: number;
  stripeCustomerId: string;
  stripeSubscriptionId: string | null;
  planTier: PaidTier | null;
  billingInterval: Interval | null;
  stripeStatus: string | null;
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: Date | null;
}

export interface BillingUpsert {
  userId: number;
  stripeCustomerId: string;
  stripeSubscriptionId: string;
  planTier: PaidTier;
  billingInterval: Interval;
  stripeStatus: string;
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: Date;
}

/** The persistence surface stripeSync needs; an in-memory fake implements it in tests. */
export interface BillingStore {
  getBillingByCustomer(customerId: string): Promise<BillingRow | null>;
  userExists(userId: number): Promise<boolean>;
  setTier(userId: number, tier: Tier, expiresAt: Date | null): Promise<void>;
  upsertBilling(row: BillingUpsert): Promise<void>;
}

function toRow(r: Record<string, unknown>): BillingRow {
  return {
    userId: Number(r.user_id),
    stripeCustomerId: String(r.stripe_customer_id),
    stripeSubscriptionId: (r.stripe_subscription_id as string | null) ?? null,
    planTier: (r.plan_tier as PaidTier | null) ?? null,
    billingInterval: (r.billing_interval as Interval | null) ?? null,
    stripeStatus: (r.stripe_status as string | null) ?? null,
    cancelAtPeriodEnd: r.cancel_at_period_end === true,
    currentPeriodEnd: r.current_period_end ? new Date(r.current_period_end as string) : null,
  };
}

export async function getBillingByUser(userId: number): Promise<BillingRow | null> {
  const rows = await sql`SELECT * FROM elder_billing WHERE user_id = ${userId} LIMIT 1`;
  return rows[0] ? toRow(rows[0]) : null;
}

/** Create the customer link before checkout so retries reuse one Customer. Returns the stored row. */
export async function ensureBillingCustomer(userId: number, customerId: string): Promise<BillingRow> {
  await sql`
    INSERT INTO elder_billing (user_id, stripe_customer_id)
    VALUES (${userId}, ${customerId})
    ON CONFLICT (user_id) DO NOTHING
  `;
  const row = await getBillingByUser(userId);
  if (!row) throw new Error(`ensureBillingCustomer: no row for user ${userId}`);
  return row;
}

export const pgBillingStore: BillingStore = {
  async getBillingByCustomer(customerId) {
    const rows = await sql`SELECT * FROM elder_billing WHERE stripe_customer_id = ${customerId} LIMIT 1`;
    return rows[0] ? toRow(rows[0]) : null;
  },
  async userExists(userId) {
    const rows = await sql`SELECT id FROM elder_user WHERE id = ${userId} LIMIT 1`;
    return rows.length > 0;
  },
  setTier: (userId, tier, expiresAt) => setTierStrict(userId, tier, expiresAt),
  async upsertBilling(b) {
    await sql`
      INSERT INTO elder_billing
        (user_id, stripe_customer_id, stripe_subscription_id, plan_tier, billing_interval,
         stripe_status, cancel_at_period_end, current_period_end, updated_at)
      VALUES
        (${b.userId}, ${b.stripeCustomerId}, ${b.stripeSubscriptionId}, ${b.planTier}, ${b.billingInterval},
         ${b.stripeStatus}, ${b.cancelAtPeriodEnd}, ${b.currentPeriodEnd.toISOString()}, now())
      ON CONFLICT (user_id) DO UPDATE SET
        stripe_customer_id = EXCLUDED.stripe_customer_id,
        stripe_subscription_id = EXCLUDED.stripe_subscription_id,
        plan_tier = EXCLUDED.plan_tier,
        billing_interval = EXCLUDED.billing_interval,
        stripe_status = EXCLUDED.stripe_status,
        cancel_at_period_end = EXCLUDED.cancel_at_period_end,
        current_period_end = EXCLUDED.current_period_end,
        updated_at = now()
    `;
  },
};

/** Webhook event bookkeeping. Returns true when this event still needs processing. */
export async function claimStripeEvent(id: string, type: string): Promise<boolean> {
  const inserted = await sql`
    INSERT INTO stripe_event (id, type) VALUES (${id}, ${type})
    ON CONFLICT (id) DO NOTHING RETURNING id
  `;
  if (inserted.length > 0) return true;
  const rows = await sql`SELECT processed_at FROM stripe_event WHERE id = ${id} LIMIT 1`;
  return !rows[0]?.processed_at; // unprocessed row: an earlier attempt died, retry it
}

export async function markStripeEventProcessed(id: string): Promise<void> {
  await sql`UPDATE stripe_event SET processed_at = now() WHERE id = ${id}`;
}

export async function pruneStripeEvents(olderThanDays = 30): Promise<void> {
  await sql`DELETE FROM stripe_event WHERE received_at < now() - (${olderThanDays} * interval '1 day')`;
}
