// app/api/elder/marker-offer/route.ts
//
// §1.5 marker confirmation, step one: given a visitId belonging to the
// signed-in seeker, looks up that visit's proposed markers, selects one,
// and generates the interrogative offer. Writes nothing — confirm-marker
// is the write step, once the seeker responds to what this route returns.
//
// Session-scoped via getVisitForUser (elder_user spine, PR A) — the
// original version resolved visits by raw id with no ownership check.
//
// For signed-in returning seekers, the selection priority is personalized
// toward whichever marker is underrepresented in their kept Threshold
// Letters (lib/returning/markerDeficit.ts) instead of the static
// FALLBACK_PRIORITY — see lib/returning/markers.ts. A DB lookup failure
// here fails toward the static order, never toward breaking the offer
// (same posture as lib/thresholdLetterLedger.ts). The offer itself speaks
// in the visit's own lineage voice (visit.lineageKey), and fails toward
// offer:null rather than a 500 if composition throws.

import { NextRequest, NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth";
import { getVisitForUser } from "@/lib/returning/visit";
import { selectMarkerToOffer, buildMarkerOffer, type MarkerField } from "@/lib/returning/markers";
import { getUserThresholdLetters } from "@/lib/thresholdLetterLedger";
import { computeMarkerPriority, MIN_MARKERED_LETTERS_FOR_PERSONALIZATION } from "@/lib/returning/markerDeficit";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  const userId = getSessionUserId(req);
  if (!userId) return NextResponse.json({ error: "not_signed_in" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body || typeof body.visitId !== "string") {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const visit = await getVisitForUser(userId, body.visitId);
  if (!visit) {
    return NextResponse.json({ error: "visit_not_found" }, { status: 404 });
  }

  let priorityOrder: MarkerField[] | undefined;
  let markeredLetters: { marker: MarkerField | null }[] = [];
  try {
    const letters = await getUserThresholdLetters(userId);
    markeredLetters = letters.map((l) => ({ marker: l.marker as MarkerField | null }));
    priorityOrder = computeMarkerPriority(markeredLetters);
  } catch {
    // Fail toward silence: a DB hiccup here must never break the offer.
    priorityOrder = undefined;
    markeredLetters = [];
  }

  const selection = selectMarkerToOffer(visit.markers, priorityOrder);
  if (!selection) {
    // No markers were proposed for this visit at all — costless, not an error.
    return NextResponse.json({ offer: null }, { status: 200 });
  }

  let offerText: string;
  try {
    offerText = await buildMarkerOffer(selection, visit.lineageKey);
  } catch {
    // The offer is a grace note, not a Reading — if it cannot be composed,
    // offering nothing is costless (same as the no-markers path above).
    return NextResponse.json({ offer: null }, { status: 200 });
  }

  const markered = markeredLetters.filter((l) => l.marker != null);
  const reflection =
    markered.length >= MIN_MARKERED_LETTERS_FOR_PERSONALIZATION
      ? `Of your last ${markered.length} kept letters, ${
          markered.filter((l) => l.marker === selection.field).length
        } carried this thread.`
      : null;

  return NextResponse.json({
    visitId: visit.visitId,
    field: selection.field,
    offer: offerText,
    reflection,
  });
}
