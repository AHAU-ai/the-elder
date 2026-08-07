// app/api/user/history/route.ts
//
// The seeker's chain timeline, rekeyed to the signed session (single identity
// spine). 401 on missing/invalid session, never an empty array (A-4, kept).
// Full elder_response text is returned: this is the Journal's timeline
// substrate (PR C), and the words belong to the seeker who received them.
//
// DELETE is the repo's first release handler: release one reading
// ({ visitId }) or one chain ({ chainId }) — exactly one of the two.
// Releases are user-initiated, so they fail LOUD (fail toward honesty):
// a DB failure is a 500, never a silent "released."
import { NextRequest, NextResponse } from 'next/server';
import { getSessionUserId } from '@/lib/auth';
import { fullHistory, releaseVisit, releaseChain } from '@/lib/returning/visit';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const userId = getSessionUserId(req);
  if (!userId) return NextResponse.json({ error: 'not_signed_in' }, { status: 401 });

  try {
    const visits = await fullHistory(userId);
    return NextResponse.json({
      visits: visits.map((v) => ({
        visitId: v.visitId,
        chainId: v.chainId,
        mode: v.mode,
        lineageKey: v.lineageKey,
        mythTitle: v.mythTitle,
        archetype: v.archetype,
        depth: v.depth,
        timestamp: v.timestamp,
        elderResponse: v.elderResponse,
        markers: v.markers,
        markersConfirmed: v.markersConfirmed ?? null,
      })),
    });
  } catch (err) {
    console.error('[history] Failed to load timeline:', err);
    return NextResponse.json({ error: 'history_unavailable' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const userId = getSessionUserId(req);
  if (!userId) return NextResponse.json({ error: 'not_signed_in' }, { status: 401 });

  let body: { visitId?: unknown; chainId?: unknown } = {};
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  }
  const visitId = typeof body.visitId === 'string' ? body.visitId : null;
  const chainId = typeof body.chainId === 'string' ? body.chainId : null;
  if ((visitId && chainId) || (!visitId && !chainId)) {
    return NextResponse.json(
      { error: 'exactly_one_of_visitId_or_chainId' },
      { status: 400 }
    );
  }

  try {
    if (visitId) {
      const released = await releaseVisit(userId, visitId);
      if (!released) return NextResponse.json({ error: 'not_found' }, { status: 404 });
      return NextResponse.json({ released: 1 });
    }
    const released = await releaseChain(userId, chainId as string);
    if (released === 0) return NextResponse.json({ error: 'not_found' }, { status: 404 });
    return NextResponse.json({ released });
  } catch (err) {
    console.error('[history] Release failed:', err);
    return NextResponse.json({ error: 'release_failed' }, { status: 500 });
  }
}
