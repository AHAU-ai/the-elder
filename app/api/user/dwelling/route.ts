// app/api/user/dwelling/route.ts
//
// The over-dwelling guard's one read (lib/overDwelling.ts, M7). Session-scoped,
// never cached. Says only whether the CLOSE of this sitting should be quieter
// and, if the reviewer chose one, the plain line; never a count. It cannot
// block, delay or refuse anything: it is advice about the instrument's manner.
//
// Dark by default: while the guard's gates are closed this returns
// { quiet: false } without touching the database. Anonymous seekers are
// invisible to the guard (it counts the account's ledger), so they also get
// { quiet: false } rather than an error.
import { NextRequest, NextResponse } from 'next/server';
import { getSessionUserId } from '@/lib/auth';
import { readDwelling } from '@/lib/returning/dwelling';

export const runtime = 'nodejs';

const NO_STORE = { 'Cache-Control': 'no-store' };

export async function GET(req: NextRequest) {
  const userId = getSessionUserId(req);
  if (!userId || !process.env.DATABASE_URL) {
    return NextResponse.json({ quiet: false, untilMs: 0, line: null }, { headers: NO_STORE });
  }
  return NextResponse.json(await readDwelling(userId), { headers: NO_STORE });
}
