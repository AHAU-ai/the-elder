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
    _stripe = new Stripe(key);
  }
  return _stripe;
}
