import { NextRequest, NextResponse } from 'next/server';
import { getSessionUserId } from '@/lib/auth';
import { getMostRecentForLineage } from '@/lib/mythReadingLog';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const userId = getSessionUserId(req);
  const lineageKey = req.nextUrl.searchParams.get('lineageKey');
  if (!userId || !lineageKey || !process.env.DATABASE_URL) {
    return NextResponse.json({ recall: null });
  }

  try {
    const reading = await getMostRecentForLineage(userId, lineageKey);
    if (!reading) return NextResponse.json({ recall: null });

    const recall = reading.archetypeName
      ? `Archetype: ${reading.archetypeName}\n\n${reading.depthSummary}`
      : reading.depthSummary;
    return NextResponse.json({ recall });
  } catch (err) {
    console.error('[myth/lineage-recall] Failed to load recall:', err);
    return NextResponse.json({ recall: null });
  }
}
