import { NextRequest, NextResponse } from 'next/server';
import { getSessionUserId } from '@/lib/auth';
import { getStripe } from '@/lib/stripeClient';
import { getBillingByUser } from '@/lib/billingStore';
import { missingBillingEnv } from '@/config/billing';

export const runtime = 'nodejs';

// Opens the Stripe Customer Portal for the signed-in user: cancel, switch
// plan, change card, download invoices. Plan changes come back through the
// webhook; nothing is granted here.

function siteUrl(): string {
  const base =
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');
  return base.replace(/\/$/, '');
}

export async function POST(req: NextRequest) {
  const missing = missingBillingEnv();
  if (missing.length > 0) {
    console.error(`[stripe/config] portal cannot run, missing: ${missing.join(', ')}`);
    return NextResponse.json({ error: 'billing not configured' }, { status: 503 });
  }
  const userId = getSessionUserId(req);
  if (!userId) return NextResponse.json({ error: 'sign in required' }, { status: 401 });

  try {
    const billing = await getBillingByUser(userId);
    if (!billing) return NextResponse.json({ error: 'no membership to manage' }, { status: 404 });
    const session = await getStripe().billingPortal.sessions.create({
      customer: billing.stripeCustomerId,
      return_url: `${siteUrl()}/`,
      ...(process.env.STRIPE_PORTAL_CONFIGURATION
        ? { configuration: process.env.STRIPE_PORTAL_CONFIGURATION }
        : {}),
    });
    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error('[stripe/portal] failed:', err);
    return NextResponse.json({ error: 'could not open the portal' }, { status: 502 });
  }
}
