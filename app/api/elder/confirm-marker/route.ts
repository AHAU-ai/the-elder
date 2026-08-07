// app/api/elder/confirm-marker/route.ts
//
// §1.5 marker-confirmation endpoint. Only confirmed/reshaped markers ever
// reach markers_confirmed; readTrajectory consumes that field exclusively.
// Confirmed/reshaped values also bump marker_trajectory's recurrence count
// (migration 009) — declines never do, same as the markers_confirmed write.
// Welfare gate fires on content (reshape text), never on the act of
// declining — decline costs nothing (design constraint 4).
//
// Rebuilt against the elder_user session spine (PR A):
//   - session-scoped via getSessionUserId + getVisitForUser (the original
//     had no ownership check at all — a real gap, fixed here)
//   - the read-then-write race on markers_confirmed (documented but never
//     fixed in the original) is closed by folding the merge into a single
//     atomic UPDATE ... SET markers_confirmed = markers_confirmed || $patch,
//     instead of reading the column, merging in JS, then writing it back.
import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/returning/db';
import { getSessionUserId } from '@/lib/auth';
import { assessWelfare } from '@/lib/welfareGate';
import type { ModelJudge } from '@/lib/welfareGate';
import { WELFARE_MODEL } from '@/lib/model.config';
import { getVisitForUser } from '@/lib/returning/visit';
import { recordMarkerAppearance } from '@/lib/returning/markerTrajectory';
import Anthropic from '@anthropic-ai/sdk';

export const runtime = 'nodejs';
export const maxDuration = 30;

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Matches app/api/divine/route.ts's welfareJudge construction verbatim.
const welfareJudge: ModelJudge = async (judgeSystem, judgeUser) => {
  const res = await anthropic.messages.create({
    model: WELFARE_MODEL, max_tokens: 64,
    system: judgeSystem,
    messages: [{ role: 'user', content: judgeUser }],
  });
  const b = res.content.find((x) => x.type === 'text');
  return b && 'text' in b ? b.text : '';
};

type ConfirmMarkerRequest = {
  visitId: string;
  field: 'wound' | 'figure' | 'threshold' | 'exile' | 'pattern';
  response:
    | { type: 'confirm' }
    | { type: 'reshape'; words: string }
    | { type: 'decline' };
};

export async function POST(req: NextRequest) {
  const userId = getSessionUserId(req);
  if (!userId) return NextResponse.json({ error: 'not_signed_in' }, { status: 401 });

  const body = (await req.json().catch(() => null)) as ConfirmMarkerRequest | null;
  if (!body || typeof body.visitId !== 'string' || typeof body.field !== 'string' || !body.response) {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  }

  const visit = await getVisitForUser(userId, body.visitId);
  if (!visit) return NextResponse.json({ error: 'visit_not_found' }, { status: 404 });

  if (body.response.type === 'reshape') {
    const welfare = await assessWelfare(body.response.words ?? '', welfareJudge);
    if (welfare.surfaceResources && welfare.tier === 'crisis') {
      return NextResponse.json({ error: 'welfare_crisis', tier: welfare.tier }, { status: 200 });
    }
    if (!welfare.allowPsychopompLayer) {
      return NextResponse.json({ error: 'welfare_distress', tier: welfare.tier }, { status: 200 });
    }
  }

  let mode: 'confirmed' | 'reshaped' | 'declined';
  let storedValue: string | undefined;

  switch (body.response.type) {
    case 'confirm':
      mode = 'confirmed';
      storedValue = visit.markers[body.field];
      break;
    case 'reshape':
      mode = 'reshaped';
      storedValue = body.response.words.trim();
      break;
    case 'decline':
      mode = 'declined';
      break;
  }

  if (mode !== 'declined') {
    const patch = {
      [body.field]: {
        value: storedValue,
        mode,
        confirmedAt: new Date().toISOString(),
      },
    };
    await sql`
      UPDATE visit_record
      SET markers_confirmed = COALESCE(markers_confirmed, '{}'::jsonb) || ${JSON.stringify(patch)}::jsonb
      WHERE id = ${body.visitId} AND user_id = ${userId}
    `;

    // Recurrence tracking. Never allowed to affect the response — a failure
    // here means one appearance goes uncounted, not a broken confirmation.
    if (storedValue) {
      try {
        await recordMarkerAppearance(userId, body.field, storedValue);
      } catch {
        // swallowed — see comment above
      }
    }
  }

  return NextResponse.json({
    visitId: body.visitId,
    field: body.field,
    mode,
    storedValue,
  });
}
