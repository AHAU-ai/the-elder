import { NextRequest, NextResponse } from 'next/server';
import { setTesterStatus } from '@/lib/tierLedger';

export const runtime = 'nodejs';

// §Testers Mode: the one caller of tierLedger.setTesterStatus(). Grants/
// revokes the is_tester override (migrations/024_tester_account.sql) --
// getEffectiveTier() reads it and returns 'council' unconditionally for a
// tester, uncapping everywhere the tiered-membership system already gates
// Kept/Council, WITHOUT writing to that account's real tier/tier_expires_at
// columns (a tester is never counted as a paying subscriber anywhere that
// reads those columns directly).
//
// Deliberately narrow: this route can only ever flip is_tester. It cannot
// touch the welfare/crisis gate, the consent ledger, guardian review, or
// narrative-register content gating -- those are separate systems this
// column is never read by (see lib/tierLedger.ts's getEffectiveTier and
// app/api/divine/route.ts for where is_tester is actually consulted).
// docs/handoff-2026-07-07.md already records that lifting the *consent*
// gate for beta testers specifically was requested and declined; this is
// a distinct, narrower thing and does not revisit that decision.
//
// Auth: shared secret, mirrors app/api/admin/set-tier/route.ts exactly
// (same ADMIN_SECRET, same Bearer-header check, no self-service path).

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) return false;
  const header = req.headers.get('authorization');
  return header === `Bearer ${secret}`;
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
  const isTester = body?.isTester;

  if (!Number.isFinite(userId) || userId <= 0 || typeof isTester !== 'boolean') {
    return NextResponse.json({ error: 'userId (positive number) and isTester (boolean) are required' }, { status: 400 });
  }

  await setTesterStatus(userId, isTester);
  return NextResponse.json({ ok: true, userId, isTester });
}
