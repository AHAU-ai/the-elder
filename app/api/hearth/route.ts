// app/api/hearth/route.ts
//
// Route: GET /hearth's own data. Read-only, by design and by promise: the
// quiet path assumes nothing FROM the seeker, so this route makes zero
// writes and zero model calls. See app/hearth/page.tsx and
// app/components/Hearth.tsx for the surface this feeds.
//
// core_myth_statement does not exist on main yet (it currently lives on
// the still-open feat/marker-depth-stage branch) -- this reads it
// defensively so /hearth works today with just Threshold Letters, and
// picks up real myth-statement data for free the moment that branch
// lands, with no rewrite needed here.

import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { getSessionUserId } from '@/lib/auth';
import { getUserThresholdLetters } from '@/lib/thresholdLetterLedger';

export const runtime = 'nodejs';

interface CurrentMythStatement {
  bodyText: string;
  version: number;
}

async function readCurrentMythStatement(userId: number): Promise<CurrentMythStatement | null> {
  if (!process.env.DATABASE_URL) return null;
  try {
    const sql = neon(process.env.DATABASE_URL);
    const rows = await sql`
      SELECT body_text, version FROM core_myth_statement
      WHERE user_id = ${userId} AND superseded_at IS NULL
    `;
    if (rows.length === 0) return null;
    return { bodyText: rows[0].body_text as string, version: Number(rows[0].version) };
  } catch (err: any) {
    // 42P01 = relation does not exist -- the table isn't on this branch's
    // schema yet. Not an error condition for this route: the fire and
    // letters are still real without it. Any OTHER error is logged, since
    // it could be a genuine outage worth knowing about.
    if (err?.code !== '42P01') {
      console.error('[hearth] Myth statement read failed (non-schema error):', err);
    }
    return null;
  }
}

export async function GET(req: NextRequest) {
  const userId = getSessionUserId(req);
  if (!userId || !process.env.DATABASE_URL) {
    return NextResponse.json({ signedIn: false, letters: [], mythStatement: null });
  }

  try {
    const [letters, mythStatement] = await Promise.all([
      getUserThresholdLetters(userId),
      readCurrentMythStatement(userId),
    ]);
    return NextResponse.json({ signedIn: true, letters, mythStatement });
  } catch (err) {
    console.error('[hearth] GET failed:', err);
    return NextResponse.json({ signedIn: true, letters: [], mythStatement: null });
  }
}
