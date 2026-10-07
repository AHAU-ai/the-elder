import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { getSessionUserId } from '@/lib/auth';
import { figureContinuityEnabled } from '@/config/returning-features';
import { assessPairingsAccess } from '@/lib/returning/figureContinuity';
import { deriveEffectiveTier, getTierRecord } from '@/lib/tierLedger';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const userId = getSessionUserId(req);
  if (!userId || !process.env.DATABASE_URL) {
    return NextResponse.json({ email: null });
  }

  try {
    const sql = neon(process.env.DATABASE_URL);
    const rows = await sql`SELECT email FROM elder_user WHERE id = ${userId} LIMIT 1`;
    if (rows.length === 0) return NextResponse.json({ email: null });
    // Figure Continuity (spec 3.6): whether to show the seeker's own pairings view. Decided here, by the
    // server, and reported only while the feature is lit, so while it is dark this response is
    // exactly what it was. A failure means no link, never a broken page.
    let pairings = false;
    if (figureContinuityEnabled()) {
      try {
        pairings = await assessPairingsAccess({ userId, effectiveTier: deriveEffectiveTier(await getTierRecord(userId)) });
      } catch {
        pairings = false;
      }
    }
    return NextResponse.json({ email: rows[0].email, ...(pairings ? { figureContinuity: { pairings: true } } : {}) });
  } catch (err) {
    console.error('[auth/me] Failed to look up user:', err);
    return NextResponse.json({ email: null });
  }
}
