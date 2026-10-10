// app/api/figure-mappings/[id]/confirm/route.ts
//
// "That fits": the seeker's control press, the only thing that turns an offer
// into a mapping (spec G4). The model's text never confirms anything.
//
// The ledger's guarded first-answer-wins UPDATE decides the outcome, scoped to
// the session user:
//   confirmed   200  one row changed
//   noop        200  replay, someone else's id, expired, released chain, unknown id.
//                    Deliberately identical for all of these, so a forged or
//                    replayed confirm learns nothing.
//   capReached  409  the seeker already holds the maximum; named, nothing evicted
// Not gated on the feature flag: if the feature is dark there are no offers, and
// the answer is the neutral noop.
import { NextRequest, NextResponse } from 'next/server';
import { getSessionUserId } from '@/lib/auth';
import { checkRateLimit } from '@/lib/rate-limit';
import { confirmOffer, MAX_CONFIRMED_MAPPINGS } from '@/lib/returning/figureMapping';

export const runtime = 'nodejs';

const MAPPING_ACTIONS_PER_DAY = 300;

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = getSessionUserId(req);
  if (!userId) return NextResponse.json({ error: 'not_signed_in' }, { status: 401 });
  if (!process.env.DATABASE_URL) return NextResponse.json({ error: 'confirm_failed' }, { status: 500 });

  const { id: rawId } = await params;
  const id = /^[1-9][0-9]{0,15}$/.test(rawId) ? Number(rawId) : NaN;
  if (!Number.isSafeInteger(id)) return NextResponse.json({ outcome: 'noop' });

  const limit = await checkRateLimit(`figmap:${userId}`, MAPPING_ACTIONS_PER_DAY);
  if (!limit.allowed) return NextResponse.json({ error: 'rate_limited' }, { status: 429 });

  const result = await confirmOffer(userId, id);
  if (!result.ok) return NextResponse.json({ error: 'confirm_failed' }, { status: 500 });
  if (result.outcome === 'capReached') {
    return NextResponse.json(
      {
        outcome: 'capReached',
        max: MAX_CONFIRMED_MAPPINGS,
        message: `The fire keeps ${MAX_CONFIRMED_MAPPINGS} pairings at a time. Release one to keep another.`,
      },
      { status: 409 }
    );
  }
  return NextResponse.json({ outcome: result.outcome });
}
