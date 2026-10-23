// app/api/figure-mappings/route.ts
//
// Figure Continuity (docs/figure-continuity-spec.md v0.2, section 4-5): the
// seeker's own view of the pairings they have confirmed. GET only -- there is
// deliberately no POST: offers are created by the divine pipeline (FC-D) and
// only a seeker's control press confirms one.
//
// Identity comes from the signed session, never the request. `chainId` is a
// filter only; it is validated as a UUID and the query is still scoped to the
// session user, so a foreign or unknown chain id returns the same empty list
// as a chain with no mappings. Not gated on the feature flag: reading your own
// kept data must work whether or not the feature is lit.
import { NextRequest, NextResponse } from 'next/server';
import { getSessionUserId } from '@/lib/auth';
import { listConfirmed, listAllConfirmed, MAX_CONFIRMED_MAPPINGS } from '@/lib/returning/figureMapping';

export const runtime = 'nodejs';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NO_STORE = { 'Cache-Control': 'no-store' };

export async function GET(req: NextRequest) {
  const userId = getSessionUserId(req);
  if (!userId) return NextResponse.json({ error: 'not_signed_in' }, { status: 401, headers: NO_STORE });
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: 'unavailable' }, { status: 500, headers: NO_STORE });
  }

  const chainId = req.nextUrl.searchParams.get('chainId');
  if (chainId !== null && !UUID_RE.test(chainId)) {
    return NextResponse.json({ error: 'bad_request' }, { status: 400, headers: NO_STORE });
  }

  const mappings = chainId
    ? await listConfirmed(userId, chainId, MAX_CONFIRMED_MAPPINGS)
    : await listAllConfirmed(userId, MAX_CONFIRMED_MAPPINGS);
  // null is "could not read", which must not look like "none" (spec G9).
  if (mappings === null) {
    return NextResponse.json({ error: 'unavailable' }, { status: 500, headers: NO_STORE });
  }
  return NextResponse.json({ mappings }, { headers: NO_STORE });
}
