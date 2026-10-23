// app/api/fireside/probe/route.ts
//
// Whether the fireside room exists for this seeker, so the nav can show it.
// Answers { lit: false } for anyone it should not appear to (signed out, closed
// room, not a tester during stage 1) without distinguishing why, and reads
// nothing but the seeker's tester flag.
import { NextRequest, NextResponse } from 'next/server';
import { getSessionUserId } from '@/lib/auth';
import { firesideEnabled, firesideStageAllows } from '@/config/returning-features';
import { getTierRecord } from '@/lib/tierLedger';

export const runtime = 'nodejs';

const NO_STORE = { 'Cache-Control': 'no-store' };

export async function GET(req: NextRequest) {
  const userId = getSessionUserId(req);
  // Dark for everyone: no database read at all.
  if (!userId || !process.env.DATABASE_URL || !firesideEnabled()) {
    return NextResponse.json({ lit: false }, { headers: NO_STORE });
  }
  try {
    const lit = firesideStageAllows((await getTierRecord(userId)).isTester === true);
    return NextResponse.json({ lit }, { headers: NO_STORE });
  } catch {
    return NextResponse.json({ lit: false }, { headers: NO_STORE });
  }
}
