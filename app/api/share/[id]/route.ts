import { NextRequest, NextResponse } from 'next/server';
import { getShareCard, getShareResponseCounts, incrementShareOpenCount } from '@/lib/shareLedger';

export const runtime = 'nodejs';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ card: null }, { status: 404 });
  }

  try {
    const { id } = await params;
    const card = await getShareCard(id);
    if (!card) return NextResponse.json({ card: null }, { status: 404 });

    // Fire-and-forget, same posture as the rest of this fail-closed ledger:
    // a reach-tracking miss must never delay or break loading the card
    // itself, so this isn't awaited before the response is built.
    incrementShareOpenCount(card.id).catch(() => {});

    const responseCounts = await getShareResponseCounts(card.id);
    return NextResponse.json({
      card: {
        line: card.line,
        marker: card.marker,
        voiceKey: card.voiceKey,
        dedicatedTo: card.dedicatedTo,
        responseCounts,
        // provenanceMetadata()'s shape (src/resilience/provenance.ts) or
        // null for cards kept before migrations/017 or without a stamp
        // available. Exposed on the data layer for this shared artifact;
        // /share/[id]'s page doesn't currently render it -- whether/how to
        // surface it visibly is a separate UI decision from making it
        // actually traceable.
        provenance: card.provenance,
      },
    });
  } catch (err) {
    console.error('[share/id] Failed to load share card:', err);
    return NextResponse.json({ card: null }, { status: 500 });
  }
}
