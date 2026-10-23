// app/api/figure-mappings/[id]/route.ts
//
// DELETE removes one pairing the session user owns. Two uses, one route:
//   ?offer=1  "Not quite": deletes the row only while it is still an unanswered
//             offer, so a stale control can never remove a mapping the seeker
//             has since confirmed. No tombstone is kept.
//   (none)    Remove: deletes a confirmed mapping (or a pending offer).
// Every query is scoped to the session user; a missing, foreign or malformed id
// gets the same neutral 404, so ids reveal nothing about other seekers' rows.
// Always available: removing your own data is not gated on the feature flag.
import { NextRequest, NextResponse } from 'next/server';
import { getSessionUserId } from '@/lib/auth';
import { checkRateLimit } from '@/lib/rate-limit';
import { declineOffer, removeMapping } from '@/lib/returning/figureMapping';

export const runtime = 'nodejs';

const NOT_FOUND = () => NextResponse.json({ error: 'not_found' }, { status: 404 });
const MAPPING_ACTIONS_PER_DAY = 300; // per user; the ledger itself is capped at 30 mappings

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = getSessionUserId(req);
  if (!userId) return NextResponse.json({ error: 'not_signed_in' }, { status: 401 });
  if (!process.env.DATABASE_URL) return NextResponse.json({ error: 'delete_failed' }, { status: 500 });

  const { id: rawId } = await params;
  if (!/^[1-9][0-9]{0,15}$/.test(rawId)) return NOT_FOUND();
  const id = Number(rawId);
  if (!Number.isSafeInteger(id)) return NOT_FOUND();

  const limit = await checkRateLimit(`figmap:${userId}`, MAPPING_ACTIONS_PER_DAY);
  if (!limit.allowed) return NextResponse.json({ error: 'rate_limited' }, { status: 429 });

  const result = req.nextUrl.searchParams.get('offer') === '1'
    ? await declineOffer(userId, id)
    : await removeMapping(userId, id);
  // Releases are user-initiated, so they fail loud (fail toward honesty).
  if (!result.ok) return NextResponse.json({ error: 'delete_failed' }, { status: 500 });
  if (result.count === 0) return NOT_FOUND();
  return NextResponse.json({ removed: result.count });
}
