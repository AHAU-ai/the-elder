// app/api/elder/core-myth-statement/dismiss/route.ts
//
// The seeker's own "not now" on the standing Core Myth Statement
// invitation. Durable, count-anchored, never a timer — see
// lib/returning/coreMythStatement.ts's dismissInvitation/getEligibility
// for the full mechanic. Session-scoped.

import { NextRequest, NextResponse } from 'next/server';
import { getSessionUserId } from '@/lib/auth';
import { dismissInvitation } from '@/lib/returning/coreMythStatement';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const userId = getSessionUserId(req);
  if (!userId) return NextResponse.json({ error: 'not_signed_in' }, { status: 401 });

  try {
    await dismissInvitation(userId);
    return NextResponse.json({ dismissed: true });
  } catch (err) {
    console.error('[core-myth-statement/dismiss] Failed:', err);
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}
