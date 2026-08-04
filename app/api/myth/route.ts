import { NextRequest, NextResponse } from 'next/server';
import { getSessionUserId } from '@/lib/auth';
import { getUserMyths } from '@/lib/mythLedger';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const userId = getSessionUserId(req);
  if (!userId || !process.env.DATABASE_URL) {
    return NextResponse.json({ myths: [] });
  }

  try {
    const myths = await getUserMyths(userId);
    return NextResponse.json({ myths });
  } catch (err) {
    console.error('[myth] Failed to load myths:', err);
    return NextResponse.json({ myths: [] });
  }
}
