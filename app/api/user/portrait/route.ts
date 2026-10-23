// app/api/user/portrait/route.ts
//
// GET the seeker's "myth so far" -- the road from first figure to the Core
// Myth page, assembled from what they have already kept. Mirrors
// /api/user/tree-state's auth posture: 401 on a missing/invalid session,
// session-scoped, never client-trusted. { portrait: null } (200) when it
// cannot be assembled truthfully: the page is a grace note, never load-bearing.
import { NextRequest, NextResponse } from 'next/server';
import { getSessionUserId } from '@/lib/auth';
import { buildMythPortrait } from '@/lib/returning/mythPortrait';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const userId = getSessionUserId(req);
  if (!userId) return NextResponse.json({ error: 'not_signed_in' }, { status: 401 });
  if (!process.env.DATABASE_URL) return NextResponse.json({ portrait: null });

  const portrait = await buildMythPortrait(userId);
  return NextResponse.json({ portrait });
}
