import { NextRequest, NextResponse } from 'next/server';
import { getSessionUserId } from '@/lib/auth';
import { getUserThresholdLetters, saveThresholdLetter } from '@/lib/thresholdLetterLedger';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const userId = getSessionUserId(req);
  if (!userId || !process.env.DATABASE_URL) {
    return NextResponse.json({ letters: [] });
  }

  try {
    const letters = await getUserThresholdLetters(userId);
    return NextResponse.json({ letters });
  } catch (err) {
    console.error('[threshold-letters] Failed to load letters:', err);
    return NextResponse.json({ letters: [] });
  }
}

export async function POST(req: NextRequest) {
  const userId = getSessionUserId(req);
  if (!userId || !process.env.DATABASE_URL) {
    return NextResponse.json({ saved: false });
  }

  try {
    const body = await req.json().catch(() => null);
    const lineageKey = body?.lineageKey;
    const returnGift = body?.returnGift;
    if (typeof lineageKey !== 'string' || typeof returnGift !== 'string' || !returnGift.trim()) {
      return NextResponse.json({ saved: false });
    }

    await saveThresholdLetter(
      userId,
      lineageKey,
      typeof body?.volatilizationPhrase === 'string' ? body.volatilizationPhrase : '',
      typeof body?.returnPhrase === 'string' ? body.returnPhrase : '',
      returnGift,
      typeof body?.thresholdImage === 'string' ? body.thresholdImage : ''
    );
    return NextResponse.json({ saved: true });
  } catch (err) {
    console.error('[threshold-letters] Failed to save letter:', err);
    return NextResponse.json({ saved: false });
  }
}
