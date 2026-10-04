import { NextRequest, NextResponse } from 'next/server';
import { verifyStopToken } from '@/lib/letterStop';
import { setLetterEmailPreference } from '@/lib/thresholdLetterLedger';

export const runtime = 'nodejs';

// The one-click stop linked from every letter email (M4). GET is the link in
// the body; POST is RFC 8058 one-click (List-Unsubscribe-Post), which mail
// clients send without opening a page. Both do the same single thing: turn
// letters-by-email off for the user the signed token names. Idempotent, and
// the safe direction to be wrong in -- a link scanner that pre-fetches this
// can only ever stop letters.
//
// No session is read or created, and nothing else can be done with the token.

function userIdFromRequest(req: NextRequest): number | null {
  const key = process.env.ELDER_SESSION_SECRET;
  if (!key) return null;
  return verifyStopToken(req.nextUrl.searchParams.get('t'), key, Date.now());
}

async function stop(userId: number): Promise<boolean> {
  if (!process.env.DATABASE_URL) return false;
  try {
    await setLetterEmailPreference(userId, { enabled: false });
    return true;
  } catch (err) {
    console.error('[letters/stop] Failed to stop letters:', err);
    return false;
  }
}

export async function GET(req: NextRequest) {
  const userId = userIdFromRequest(req);
  const url = req.nextUrl.clone();
  url.search = '';
  // An invalid or expired link lands on the ordinary letters page, not on a
  // claim that something was stopped.
  if (!userId) { url.pathname = '/letters'; return NextResponse.redirect(url, 303); }
  if (!(await stop(userId))) { url.pathname = '/letters'; return NextResponse.redirect(url, 303); }
  url.pathname = '/letters/stopped';
  return NextResponse.redirect(url, 303);
}

export async function POST(req: NextRequest) {
  const userId = userIdFromRequest(req);
  if (!userId) return NextResponse.json({ stopped: false }, { status: 400 });
  const ok = await stop(userId);
  return NextResponse.json({ stopped: ok }, { status: ok ? 200 : 500 });
}
