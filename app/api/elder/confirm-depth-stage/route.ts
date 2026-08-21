// app/api/elder/confirm-depth-stage/route.ts
//
// The seeker's own explicit affirmation (or decline) of a proposed depth-
// stage transition (migrations 020/021) -- mirrors confirm-marker's own
// propose/ratify shape exactly. A pending_stage was already computed
// purely from reshape counts (lib/returning/markerTrajectory.ts) with
// zero model judgment; this endpoint is the ONLY thing that can make it
// real. The Elder never decides a seeker has grown -- it notices a
// threshold crossed and asks.
//
// Session-scoped (affirmPendingStage/declinePendingStage both filter by
// user_id, so this can never touch another seeker's row even given an
// arbitrary trajectoryId). Race-safe via the same atomic-guard shape
// confirm-marker already uses -- see markerTrajectory.ts's own comments.

import { NextRequest, NextResponse } from 'next/server';
import { getSessionUserId } from '@/lib/auth';
import { affirmPendingStage, declinePendingStage } from '@/lib/returning/markerTrajectory';

export const runtime = 'nodejs';

type ConfirmDepthStageRequest = {
  trajectoryId: number;
  affirm: boolean;
  /** Optional — which reading/sitting the seeker affirmed during, for the
   *  marker_depth_transition audit row. Never required; a decline never
   *  needs one, and an affirmation outside any specific reading is still
   *  a real, traceable affirmation without it. */
  visitId?: string;
};

export async function POST(req: NextRequest) {
  const userId = getSessionUserId(req);
  if (!userId) return NextResponse.json({ error: 'not_signed_in' }, { status: 401 });

  const body = (await req.json().catch(() => null)) as ConfirmDepthStageRequest | null;
  if (
    !body ||
    typeof body.trajectoryId !== 'number' ||
    !Number.isInteger(body.trajectoryId) ||
    typeof body.affirm !== 'boolean' ||
    (body.visitId !== undefined && typeof body.visitId !== 'string')
  ) {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  }

  try {
    if (body.affirm) {
      const result = await affirmPendingStage(userId, body.trajectoryId, body.visitId ?? null);
      if (!result) {
        // Already affirmed, already declined, or not this seeker's row --
        // all three look identical from the outside, deliberately: this
        // endpoint never reveals which, same "no information leak on a
        // no-op" posture as confirm-marker's already_recorded response.
        return NextResponse.json({ affirmed: false });
      }
      return NextResponse.json({ affirmed: true, markerType: result.markerType, toStage: result.toStage });
    } else {
      const declined = await declinePendingStage(userId, body.trajectoryId);
      return NextResponse.json({ declined });
    }
  } catch (err) {
    console.error('[confirm-depth-stage] Failed:', err);
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}
