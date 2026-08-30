import { NextRequest, NextResponse } from 'next/server';
import { setTier } from '@/lib/tierLedger';
import type { Tier } from '@/config/entitlements';

export const runtime = 'nodejs';

// §Tiered Membership: the one real caller of tierLedger.setTier() today.
// No Stripe (or other billing provider) integration exists in this
// codebase yet -- building webhook handling against a provider with no
// account, price IDs, or webhook secret configured here would mean
// guessing at a contract nobody has actually set up. Until that lands,
// tier grants are manual: an operator (matching the spec's "founding-
// member rate" framing -- founding members were always going to be a
// human-in-the-loop decision, not a self-serve checkout flow) calls this
// route directly. When real billing is wired in, its webhook handler
// becomes a second caller of setTier() alongside this one; this route
// doesn't need to change or go away, an admin override is still useful
// after self-serve billing exists.
//
// Auth: shared secret, not a session -- mirrors
// app/api/cron/deliver-threshold-letters/route.ts's isAuthorized()
// exactly (Bearer header, fails closed if the secret env var is unset).
// This is an operator tool, never called by the seeker-facing app.

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) return false;
  const header = req.headers.get('authorization');
  return header === `Bearer ${secret}`;
}

function isTier(value: unknown): value is Tier {
  return value === 'seeker' || value === 'kept' || value === 'council';
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: 'no DATABASE_URL' }, { status: 503 });
  }

  const body = await req.json().catch(() => null);
  const userId = Number(body?.userId);
  const tier = body?.tier;
  // expiresAt: ISO string or null. null is valid and meaningful (Seeker,
  // or a non-expiring grant) -- distinct from omitted/malformed, which is
  // a 400.
  const expiresAtRaw = body?.expiresAt;

  if (!Number.isFinite(userId) || userId <= 0 || !isTier(tier)) {
    return NextResponse.json({ error: 'userId (positive number) and tier (seeker|kept|council) are required' }, { status: 400 });
  }
  let expiresAt: Date | null = null;
  if (expiresAtRaw !== null && expiresAtRaw !== undefined) {
    const parsed = new Date(expiresAtRaw);
    if (isNaN(parsed.getTime())) {
      return NextResponse.json({ error: 'expiresAt must be a valid ISO date string or null' }, { status: 400 });
    }
    expiresAt = parsed;
  }

  await setTier(userId, tier, expiresAt);
  return NextResponse.json({ ok: true, userId, tier, expiresAt: expiresAt ? expiresAt.toISOString() : null });
}
