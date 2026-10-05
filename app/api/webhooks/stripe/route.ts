import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { getStripe } from '@/lib/stripeClient';
import { missingBillingEnv } from '@/config/billing';
import {
  claimStripeEvent,
  markStripeEventProcessed,
  pgBillingStore,
} from '@/lib/billingStore';
import { subscriptionIdFromEvent, syncSubscription } from '@/lib/stripeSync';

export const runtime = 'nodejs';

// Stripe webhook (docs/stripe-billing-model.md, "Webhook and access check").
// Order matters: verify the signature on the RAW body before any database
// work; record the event id; re-read the subscription from Stripe so
// duplicate and out-of-order events cannot leave stale state; any failure
// after verification returns 500 so Stripe retries.

export async function POST(req: NextRequest) {
  const missing = missingBillingEnv();
  if (missing.length > 0) {
    console.error(`[stripe/config] webhook cannot run, missing: ${missing.join(', ')}`);
    return NextResponse.json({ error: 'billing not configured' }, { status: 503 });
  }

  const signature = req.headers.get('stripe-signature');
  if (!signature) return NextResponse.json({ error: 'missing signature' }, { status: 400 });

  const raw = await req.text();
  const stripe = getStripe();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(raw, signature, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch {
    return NextResponse.json({ error: 'bad signature' }, { status: 400 });
  }

  const subscriptionId = subscriptionIdFromEvent(event);
  if (!subscriptionId) {
    // An event type we do not act on (or a payment with no subscription).
    return NextResponse.json({ received: true });
  }

  try {
    if (!(await claimStripeEvent(event.id, event.type))) {
      return NextResponse.json({ received: true, duplicate: true });
    }
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    const outcome = await syncSubscription(subscription, pgBillingStore);
    await markStripeEventProcessed(event.id);
    return NextResponse.json({ received: true, outcome });
  } catch (err) {
    console.error(`[stripe/webhook] ${event.type} ${event.id} failed:`, err);
    return NextResponse.json({ error: 'processing failed' }, { status: 500 });
  }
}
