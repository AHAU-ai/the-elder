import { NextRequest, NextResponse } from 'next/server';
import { getShareCard, addShareResponse } from '@/lib/shareLedger';

export const runtime = 'nodejs';

const VALID_MARKERS = new Set(['wound', 'threshold', 'pattern', 'exile', 'figure']);

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ ok: false }, { status: 404 });
  }

  try {
    const body = await req.json();
    const marker = typeof body?.marker === 'string' ? body.marker : '';
    if (!VALID_MARKERS.has(marker)) {
      return NextResponse.json({ ok: false }, { status: 400 });
    }

    const card = await getShareCard(params.id);
    if (!card) return NextResponse.json({ ok: false }, { status: 404 });

    await addShareResponse(card.id, marker);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[share/id/respond] Failed to record response:', err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
