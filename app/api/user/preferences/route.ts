import { NextRequest, NextResponse } from 'next/server';
import { getSessionUserId } from '@/lib/auth';
import { getLettersByEmail, setLettersByEmail } from '@/lib/thresholdLetterLedger';

export const runtime = 'nodejs';

// Signed-in-only, single preference for now: whether a kept Threshold
// Letter should be emailed back after DELIVERY_DELAY_DAYS
// (lib/thresholdLetterLedger.ts). Explicit opt-in only — GET defaults to
// false for anyone not signed in or not yet asked, never inferred.

export async function GET(req: NextRequest) {
  const userId = getSessionUserId(req);
  if (!userId || !process.env.DATABASE_URL) {
    return NextResponse.json({ lettersByEmail: false });
  }
  try {
    const lettersByEmail = await getLettersByEmail(userId);
    return NextResponse.json({ lettersByEmail });
  } catch (err) {
    console.error('[user/preferences] Failed to load preferences:', err);
    return NextResponse.json({ lettersByEmail: false });
  }
}

export async function POST(req: NextRequest) {
  const userId = getSessionUserId(req);
  if (!userId || !process.env.DATABASE_URL) {
    return NextResponse.json({ saved: false }, { status: 401 });
  }
  try {
    const body = await req.json().catch(() => null);
    if (typeof body?.lettersByEmail !== 'boolean') {
      return NextResponse.json({ saved: false }, { status: 400 });
    }
    await setLettersByEmail(userId, body.lettersByEmail);
    return NextResponse.json({ saved: true, lettersByEmail: body.lettersByEmail });
  } catch (err) {
    console.error('[user/preferences] Failed to save preferences:', err);
    return NextResponse.json({ saved: false }, { status: 500 });
  }
}
