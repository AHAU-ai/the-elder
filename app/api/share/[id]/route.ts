import { NextRequest, NextResponse } from 'next/server';
import { getShareCard, getShareResponseCounts } from '@/lib/shareLedger';

export const runtime = 'nodejs';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ card: null }, { status: 404 });
  }

  try {
    const { id } = await params;
    const card = await getShareCard(id);
    if (!card) return NextResponse.json({ card: null }, { status: 404 });

    const responseCounts = await getShareResponseCounts(card.id);
    return NextResponse.json({
      card: {
        line: card.line,
        marker: card.marker,
        voiceKey: card.voiceKey,
        dedicatedTo: card.dedicatedTo,
        responseCounts,
      },
    });
  } catch (err) {
    console.error('[share/id] Failed to load share card:', err);
    return NextResponse.json({ card: null }, { status: 500 });
  }
}
