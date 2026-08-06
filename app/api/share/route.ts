import { NextRequest, NextResponse } from 'next/server';
import { getSessionUserId } from '@/lib/auth';
import { createShareCard } from '@/lib/shareLedger';

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

    if (!line || line.length > 500 || !marker || !voiceKey) {
      return NextResponse.json({ id: null }, { status: 400 });
    }

    const id = await createShareCard(userId, line, marker, voiceKey, dedicatedTo);
    return NextResponse.json({ id });
  } catch (err) {
    console.error('[share] Failed to create share card:', err);
    return NextResponse.json({ id: null }, { status: 500 });
  }
}
