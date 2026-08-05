import { NextRequest, NextResponse } from 'next/server';
import { getSessionUserId } from '@/lib/auth';
import { getArchetypeArc } from '@/lib/mythReadingLog';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const userId = getSessionUserId(req);
  if (!userId || !process.env.DATABASE_URL) {
    return NextResponse.json({ arc: [] });
  }

  try {
    const arc = await getArchetypeArc(userId);
    return NextResponse.json({ arc });
  } catch (err) {
    console.error('[myth/arc] Failed to load archetype arc:', err);
    return NextResponse.json({ arc: [] });
  }
}
