// app/api/elder/confirm-marker/route.ts
//
// §1.5 marker-confirmation endpoint. Only confirmed/reshaped markers ever
// reach markers_confirmed; readTrajectory consumes that field exclusively.
// Welfare gate fires on content (reshape text), never on the act of
// declining — confirmed 2026-06-30. Decline costs nothing (design
// constraint 4, elder-1.5-marker-confirmation-spec.md).
import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/returning/db';
import { assessOffering } from '@/lib/returning/gates';
import { getVisitById } from '@/lib/returning/visit';
import { selectMarkerToOffer } from '@/lib/returning/markers';

type ConfirmMarkerRequest = {
  visitId: string;
  field: string;
  response:
    | { type: 'confirm' }
    | { type: 'reshape'; words: string }
    | { type: 'decline' };
};

type ConfirmMarkerResult = {
  visitId: string;
  field: string;
  mode: 'confirmed' | 'reshaped' | 'declined';
  storedValue?: string;
};

export async function POST(req: NextRequest) {
  const body = (await req.json()) as ConfirmMarkerRequest;

  if (body.response.type === 'reshape') {
    const welfare = await assessOffering(body.response.words);
    if (welfare.surfaceResources && welfare.tier === 'crisis') {
      return NextResponse.json(
        { error: 'welfare_crisis', tier: welfare.tier },
        { status: 200 }
      );
    }
    if (!welfare.allowPsychopompLayer) {
      return NextResponse.json(
        { error: 'welfare_distress', tier: welfare.tier },
        { status: 200 }
      );
    }
  }

  let mode: ConfirmMarkerResult['mode'];
  let storedValue: string | undefined;

  switch (body.response.type) {
    case 'confirm':
      mode = 'confirmed';
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
    const existing = await sql`
      SELECT markers_confirmed FROM visit_record WHERE id = ${body.visitId}
    `;
    const current = existing[0]?.markers_confirmed ?? {};

    let fieldValue: string | undefined = storedValue;
    if (mode === 'confirmed') {
      const visit = await getVisitById(body.visitId);
      const selection = visit ? selectMarkerToOffer(visit.markers) : null;
      fieldValue = selection?.proposedText;
    }

    const updated = {
      ...current,
      [body.field]: {
        value: fieldValue,
        mode,
        confirmedAt: new Date().toISOString(),
      },
    };

    await sql`
      UPDATE visit_record
      SET markers_confirmed = ${JSON.stringify(updated)}
      WHERE id = ${body.visitId}
    `;
  }

  return NextResponse.json({
    visitId: body.visitId,
    field: body.field,
    mode,
    storedValue,
  } satisfies ConfirmMarkerResult);
}
