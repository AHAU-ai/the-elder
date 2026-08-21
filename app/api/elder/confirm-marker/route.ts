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
import { MARKER_FIELDS } from '@/lib/markerExtractor';
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
  if (
    !body ||
    typeof body.visitId !== 'string' ||
    typeof body.field !== 'string' ||
    !MARKER_FIELDS.includes(body.field) ||
    !body.response ||
    typeof body.response.type !== 'string'
  ) {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  }
  // Reshape words are the only client-supplied text that gets stored:
  // required, non-empty, and capped at the same 300 chars the extractor
  // enforces on its own proposals (lib/markerExtractor.ts).
  if (
    body.response.type === 'reshape' &&
    (typeof body.response.words !== 'string' ||
      body.response.words.trim().length === 0 ||
      body.response.words.length > 300)
  ) {
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
    case 'confirm': {
      const proposed = visit.markers[body.field];
      if (typeof proposed !== 'string' || proposed.trim().length === 0) {
        // A seeker can only confirm what was actually proposed for this
        // visit — never a field the extractor stayed silent on.
        return NextResponse.json({ error: 'marker_not_proposed' }, { status: 400 });
      }
      mode = 'confirmed';
      storedValue = proposed;
      break;
    }
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
    // First answer per field per visit is final. The NOT (... ? field) guard
    // makes any subsequent request for the same (visitId, field) pair a
    // no-op — regardless of whether the new request is a confirm, a reshape,
    // or a re-send of the same type. This is a deliberate design decision:
    //   - "already answered" returns immediately as already_recorded
    //   - a seeker who reshapes AFTER a confirm gets already_recorded (the
    //     confirmed value stands — the offer/confirm flow is a single
    //     contained moment, not an ongoing edit surface)
    //   - a seeker who declines never writes this field at all, so a later
    //     confirm/reshape for the same visit IS permitted (decline does not
    //     set the field — only the declined path skips the UPDATE)
    // Verified against Postgres 16: the first UPDATE returns a row, the
    // replay returns none. Without it, every replay re-runs the trajectory
    // increment below, and a seeker could cross the
    // MIN_APPEARANCES_TO_SURFACE floor of 3 with two real appearances plus
    // noise — the exact fabricated-pattern failure Axis 2 exists to rule out.
    const wrote = await sql`
      UPDATE visit_record
      SET markers_confirmed = COALESCE(markers_confirmed, '{}'::jsonb) || ${JSON.stringify(patch)}::jsonb
      WHERE id = ${body.visitId} AND user_id = ${userId}
        AND NOT (COALESCE(markers_confirmed, '{}'::jsonb) ? ${body.field})
      RETURNING id
    `;
    if (wrote.length === 0) {
      // This visit's marker was already answered — nothing re-stored,
      // nothing re-counted.
      return NextResponse.json({
        visitId: body.visitId,
        field: body.field,
        mode: 'already_recorded',
      });
    }

    // Recurrence tracking + depth-stage PROPOSAL (migrations 020/021).
    // Never allowed to affect the response — a failure here means one
    // appearance/reshape goes uncounted, not a broken confirmation. mode
    // is narrowed to 'confirmed' | 'reshaped' here (the 'declined' branch
    // never reaches this block) — only a 'reshaped' response counts
    // toward reshape_count/depth stage; both count toward appearance_count
    // as before. recordMarkerAppearance only ever writes pending_stage
    // here, never depth_stage directly — finalizing a proposal is the
    // seeker's own act, via POST /api/elder/confirm-depth-stage, not
    // something this route (or anything server-side) decides on its own.
    if (storedValue) {
      try {
        await recordMarkerAppearance(userId, body.field, storedValue, mode);
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
