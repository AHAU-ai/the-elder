import { NextRequest, NextResponse } from 'next/server';
import { getStripe } from '@/lib/stripeClient';
import { missingBillingEnv } from '@/config/billing';
import { pgBillingStore, pruneStripeEvents } from '@/lib/billingStore';
import { syncSubscription } from '@/lib/stripeSync';

export const runtime = 'nodejs';
export const maxDuration = 60;

// Daily reconcile (see vercel.json): re-applies every Stripe subscription
// through the same sync the webhook uses, so a missed event (including a Neon
// suspension during delivery, or a sandbox that stops retrying) heals within
// a day. Auth mirrors the letters cron: shared secret, fails closed.

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return req.headers.get('authorization') === `Bearer ${secret}`;
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const missing = missingBillingEnv().filter((k) => k !== 'STRIPE_WEBHOOK_SECRET');
  if (missing.length > 0) {
    console.error(`[stripe/config] reconcile cannot run, missing: ${missing.join(', ')}`);
    return NextResponse.json({ error: 'billing not configured', missing }, { status: 503 });
  }

  const counts: Record<string, number> = {};
  let failed = 0;
  try {
    const stripe = getStripe();
    for await (const sub of stripe.subscriptions.list({ status: 'all', limit: 100 })) {
      try {
        const outcome = await syncSubscription(sub, pgBillingStore);
        counts[outcome] = (counts[outcome] ?? 0) + 1;
      } catch (err) {
        failed++;
        console.error(`[stripe/reconcile] ${sub.id} failed:`, err);
      }
    }
    await pruneStripeEvents(30);
  } catch (err) {
    console.error('[stripe/reconcile] run failed:', err);
    return NextResponse.json({ error: 'reconcile failed', counts, failed }, { status: 500 });
  }
  return NextResponse.json({ counts, failed });
}
