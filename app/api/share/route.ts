import { NextRequest, NextResponse } from 'next/server';
import { getSessionUserId } from '@/lib/auth';
import { createShareCard } from '@/lib/shareLedger';
import { MAX_LINE_CHARS, type CardQuote } from '@/lib/mythopoetics/cardConfig';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const userId = getSessionUserId(req);
  if (!userId || !process.env.DATABASE_URL) {
    return NextResponse.json({ id: null }, { status: 401 });
  }

  try {
    const body = await req.json();
    const line = typeof body?.line === 'string' ? body.line.trim() : '';
    const marker = typeof body?.marker === 'string' ? body.marker : '';
    const voiceKey = typeof body?.voiceKey === 'string' ? body.voiceKey : '';
    const dedicatedTo = typeof body?.dedicatedTo === 'string' ? body.dedicatedTo.trim() : '';

    if (!line || line.length > MAX_LINE_CHARS || !marker || !voiceKey) {
      return NextResponse.json({ id: null }, { status: 400 });
    }

    // Licensed by the length check above, not by having gone through
    // pullQuote() -- this is a wire boundary, so the CardQuote brand can't
    // be trusted the way it can within the app. This is the one place that
    // re-establishes it, on the strength of the runtime check just above.
    const id = await createShareCard(userId, line as CardQuote, marker, voiceKey, dedicatedTo);
    return NextResponse.json({ id });
  } catch (err) {
    console.error('[share] Failed to create share card:', err);
    return NextResponse.json({ id: null }, { status: 500 });
  }
}
