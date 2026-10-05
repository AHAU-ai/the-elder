import { NextRequest, NextResponse } from 'next/server';
import { getSessionUserId } from '@/lib/auth';
import { getNarrativeRegister } from '@/lib/narrativeRegister';
import { getStripe } from '@/lib/stripeClient';
import { ensureBillingCustomer, getBillingByUser } from '@/lib/billingStore';
import {
  isCheckoutEnabled,
  isCouncilPurchasable,
  missingBillingEnv,
  priceIdForPlan,
  type Interval,
  type PaidTier,
} from '@/config/billing';

export const runtime = 'nodejs';

// Starts a Stripe Checkout Session (subscription mode). Access is NOT granted
// here or on the redirect: the webhook grants on a paid subscription.
// Off unless STRIPE_CHECKOUT_ENABLED=true, so merging this route sells nothing.

function siteUrl(): string {
  const base =
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');
  return base.replace(/\/$/, '');
}

export async function POST(req: NextRequest) {
  if (!isCheckoutEnabled()) return NextResponse.json({ error: 'not available' }, { status: 404 });
  const missing = missingBillingEnv();
  if (missing.length > 0) {
    console.error(`[stripe/config] checkout cannot run, missing: ${missing.join(', ')}`);
    return NextResponse.json({ error: 'billing not configured' }, { status: 503 });
  }

  const userId = getSessionUserId(req);
  if (!userId) return NextResponse.json({ error: 'sign in required' }, { status: 401 });

  const body = await req.json().catch(() => null);
  const tier = body?.tier;
  const interval = body?.interval;
  if ((tier !== 'kept' && tier !== 'council') || (interval !== 'month' && interval !== 'year')) {
    return NextResponse.json({ error: 'tier (kept|council) and interval (month|year) are required' }, { status: 400 });
  }
  if (tier === 'council' && !isCouncilPurchasable()) {
    return NextResponse.json({ error: 'not available' }, { status: 404 });
  }

  // Adult purchase only. The register is read on the server, never trusted from the client.
  if ((await getNarrativeRegister(userId)) !== 'adult') {
    return NextResponse.json({ error: 'memberships are for adult accounts' }, { status: 403 });
  }

  const price = priceIdForPlan(tier as PaidTier, interval as Interval);
  if (!price) {
    console.error(`[stripe/config] no price id configured for ${tier}/${interval}`);
    return NextResponse.json({ error: 'billing not configured' }, { status: 503 });
  }

  try {
    const stripe = getStripe();
    let billing = await getBillingByUser(userId);
    if (billing && billing.stripeStatus && ['active', 'trialing', 'past_due'].includes(billing.stripeStatus)) {
      return NextResponse.json({ error: 'already subscribed', portal: '/api/stripe/portal' }, { status: 409 });
    }
    if (!billing) {
      // One Stripe Customer per user: the idempotency key makes concurrent
      // first clicks return the same Customer. No email: Checkout collects it.
      const customer = await stripe.customers.create(
        { metadata: { user_id: String(userId) } },
        { idempotencyKey: `elder-customer-${userId}` },
      );
      billing = await ensureBillingCustomer(userId, customer.id);
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: billing.stripeCustomerId,
      client_reference_id: String(userId),
      line_items: [{ price, quantity: 1 }],
      subscription_data: { metadata: { user_id: String(userId) } },
      success_url: `${siteUrl()}/?membership=success`,
      cancel_url: `${siteUrl()}/?membership=cancelled`,
    });
    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error('[stripe/checkout] failed:', err);
    return NextResponse.json({ error: 'could not start checkout' }, { status: 502 });
  }
}
