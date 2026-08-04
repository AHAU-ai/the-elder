// app/api/elder/marker-offer/route.ts
//
// §1.5 marker confirmation, step one: given a visitId, looks up that
// visit's proposed markers, selects one (fixed priority — see
// lib/returning/markers.ts), and generates the interrogative offer.
// Writes nothing — confirm-marker is the write step, once the seeker
// responds to what this route returns.

import { NextRequest, NextResponse } from "next/server";
import { getVisitById } from "@/lib/returning/visit";
import { selectMarkerToOffer, buildMarkerOffer } from "@/lib/returning/markers";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body || typeof body.visitId !== "string") {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const visit = await getVisitById(body.visitId);
  if (!visit) {
    return NextResponse.json({ error: "visit_not_found" }, { status: 404 });
  }

  const selection = selectMarkerToOffer(visit.markers);
  if (!selection) {
    // No markers were proposed for this visit at all — costless, not an error.
    return NextResponse.json({ offer: null }, { status: 200 });
  }

  const offerText = await buildMarkerOffer(selection);

  return NextResponse.json({
    visitId: visit.visitId,
    field: selection.field,
    offer: offerText,
  });
}
