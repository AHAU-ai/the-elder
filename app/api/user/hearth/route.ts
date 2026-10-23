// app/api/user/hearth/route.ts
//
// Axis 4 (docs/axis-4-hearth-movement.md): one number for the fire, never the
// movement. Session-scoped, never cached, never logged. While the feature is
// dark (or for an anonymous seeker) this answers { warmth: 0 } without a
// database read, and the fire is what it always was.
import { NextRequest, NextResponse } from 'next/server';
import { getSessionUserId } from '@/lib/auth';
import { readHearthWarmth } from '@/lib/returning/hearthRead';

export const runtime = 'nodejs';

const NO_STORE = { 'Cache-Control': 'no-store' };

export async function GET(req: NextRequest) {
  const userId = getSessionUserId(req);
  if (!userId || !process.env.DATABASE_URL) return NextResponse.json({ warmth: 0 }, { headers: NO_STORE });
  return NextResponse.json({ warmth: await readHearthWarmth(userId) }, { headers: NO_STORE });
}
