import { NextRequest, NextResponse } from 'next/server';
import { getSessionUserId } from '@/lib/auth';
import { getUserShares } from '@/lib/shareLedger';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const userId = getSessionUserId(req);
  if (!userId || !process.env.DATABASE_URL) {
    return NextResponse.json({ shares: [] });
  }

  try {
    const shares = await getUserShares(userId);
    return NextResponse.json({ shares });
  } catch (err) {
    console.error('[share/mine] Failed to load shares:', err);
    return NextResponse.json({ shares: [] });
  }
}
