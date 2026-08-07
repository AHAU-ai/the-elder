// app/api/elder/marker-offer/route.ts
//
// §1.5 marker confirmation, step one: given a visitId belonging to the
// signed-in seeker, looks up that visit's proposed markers, selects one
// (fixed priority — see lib/returning/markers.ts), and generates the
// interrogative offer. Writes nothing — confirm-marker is the write step,
// once the seeker responds to what this route returns.
//
// Rebuilt against the elder_user session spine (PR A) — the original
// version resolved visits by raw id with no ownership check; this one is
// session-scoped via getVisitForUser.
import { NextRequest, NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth";
import { getVisitForUser } from "@/lib/returning/visit";
import { selectMarkerToOffer, buildMarkerOffer } from "@/lib/returning/markers";

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
