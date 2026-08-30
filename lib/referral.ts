/**
 * referral.ts
 *
 * First-touch acquisition attribution. A visitor arriving with a
 * `?ref=<code>` query param (a partner org's link, or a tracked share's
 * "Meet The Elder" CTA -- see app/components/SharedCardView.tsx) gets a
 * short-lived signed cookie recording that code. If they later create an
 * account (app/api/auth/verify/route.ts), that code is written once to
 * elder_user.referral_source and never overwritten -- so a visitor who
 * clicks a partner link today and signs up a week later after browsing
 * organically in between is still correctly attributed to the partner,
 * not to whatever brought them back.
 *
 * "First-touch," not "last-touch," is a deliberate choice matching this
 * codebase's fail-closed-toward-the-simplest-honest-answer posture
 * elsewhere: with only one attribution slot and no multi-touch funnel
 * tracking, crediting the channel that actually got someone to try the
 * app for the first time is the more honest measure of "did this channel
 * work" than crediting whatever link they happened to click last.
 *
 * Deliberately NOT wired through Sentry/observability.ts -- that module's
 * own PRIVACY RULES (lib/observability.ts) keep reading content and
 * seeker input out of the observability pipeline; a referral code is
 * operator-chosen ("partner-okma", "share-<uuid>"), never seeker-supplied
 * free text, so it doesn't carry that same risk, but it's also just a
 * different concern (acquisition measurement, not reading-pipeline
 * telemetry) and belongs in its own narrow module rather than folded in.
 */

import type { NextRequest, NextResponse } from 'next/server';

export const REFERRAL_COOKIE = 'elder_ref';
const REFERRAL_MAX_AGE_SECONDS = 60 * 60 * 24 * 90; // 90 days

// Deliberately restrictive: operators choose referral codes (partner
// names, this module's own 'share-<uuid>' format), so there is no reason
// to accept anything beyond a short slug. Rejecting silently (rather than
// storing a malformed/oversized value) keeps the cookie -- and later the
// elder_user column -- from becoming a free-text injection surface off an
// unauthenticated query param.
const REFERRAL_CODE_PATTERN = /^[a-zA-Z0-9_-]{1,64}$/;

export function sanitizeReferralCode(raw: string | null | undefined): string | null {
  if (!raw) return null;
  return REFERRAL_CODE_PATTERN.test(raw) ? raw : null;
}

/**
 * Called on every request (see middleware.ts). Sets the first-touch
 * cookie if this request carries a valid `?ref=` param AND no attribution
 * is already recorded for this visitor -- never overwrites an existing
 * cookie, which is what makes this "first-touch" rather than "last-touch."
 */
export function captureReferral(req: NextRequest, res: NextResponse): void {
  const already = req.cookies.get(REFERRAL_COOKIE)?.value;
  if (already) return;

  const code = sanitizeReferralCode(req.nextUrl.searchParams.get('ref'));
  if (!code) return;

  res.cookies.set(REFERRAL_COOKIE, code, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: REFERRAL_MAX_AGE_SECONDS,
  });
}

/** Read the recorded referral code at signup, or null for organic/direct. */
export function getReferralSource(req: NextRequest): string | null {
  return sanitizeReferralCode(req.cookies.get(REFERRAL_COOKIE)?.value);
}
