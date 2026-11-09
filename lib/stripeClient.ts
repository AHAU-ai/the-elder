/**
 * stripeClient.ts — lazily constructed Stripe client. The SDK pins its own
 * API version (stripe@23 -> 2026-09-30.endive); upgrading the package is the
 * deliberate way to change it. Never constructed at module scope so a missing
 * key cannot break the build.
 */
import Stripe from 'stripe';

let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (!_stripe) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error('STRIPE_SECRET_KEY is not set');
    // Mode guard: a live key may only run in Vercel Production, and Production
    // may only run a live key. Local dev has no VERCEL_ENV and is unrestricted.
    const env = process.env.VERCEL_ENV;
    if (env) {
      const live = key.startsWith('sk_live_') || key.startsWith('rk_live_');
      if (live && env !== 'production') throw new Error(`live Stripe key refused in VERCEL_ENV=${env}`);
      if (!live && env === 'production') throw new Error('test Stripe key refused in VERCEL_ENV=production');
    }
    _stripe = new Stripe(key);
  }
  return _stripe;
}
