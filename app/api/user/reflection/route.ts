// app/api/user/reflection/route.ts
//
// R1 — the return-visit reflection (specs/adr/ADR-0014.md). Session-scoped
// read of the seeker's OWN confirmed words; returns { reflection: null }
// whenever there is nothing honest to show.
//
// Governance: this is the same felt-layer surface the trajectory speak side
// is (Appendix B, synthetic-intimacy ceiling), so it sits behind the same
// gate — trajectoryEnabled() — and is dark until that governance action is
// taken. While dark it does not even query the database.
//
// It is a grace note, like ?head=1 in /api/user/history: any failure means
// no reflection, never a broken threshold. 401 only for a missing session.
import { NextRequest, NextResponse } from 'next/server';
import { getSessionUserId } from '@/lib/auth';
import { trajectoryEnabled } from '@/config/returning-features';
import { confirmedMarkerHistory } from '@/lib/returning/visit';
import { buildReflectionResponse } from '@/lib/returning/reflection';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const userId = getSessionUserId(req);
  if (!userId) return NextResponse.json({ error: 'not_signed_in' }, { status: 401 });

  const headers = { 'Cache-Control': 'no-store' };
  try {
    const enabled = trajectoryEnabled();
    const rows = enabled ? await confirmedMarkerHistory(userId) : [];
    return NextResponse.json(buildReflectionResponse(rows, enabled), { headers });
  } catch (err) {
    console.error('[reflection] lookup failed:', err);
    return NextResponse.json({ reflection: null }, { headers });
  }
}
