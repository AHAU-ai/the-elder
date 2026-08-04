// app/api/user/history/route.ts — 401 on missing cookie, never empty array (A-4)
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getUser } from "@/lib/returning/user";
import { fullHistory } from "@/lib/returning/visit";

export const runtime = "nodejs";
const ELDER_COOKIE = "elder_user_id";

export async function GET() {
  const jar = await cookies();
  const id = jar.get(ELDER_COOKIE)?.value;
  if (!id) return NextResponse.json({ error: "not_identified" }, { status: 401 });
  const user = await getUser(id);
  if (!user) return NextResponse.json({ error: "not_identified" }, { status: 401 });

  const visits = await fullHistory(id);
  const slim = visits.map((v) => ({
    visitId: v.visitId, chainId: v.chainId, mode: v.mode,
    mythTitle: v.mythTitle, archetype: v.archetype, depth: v.depth,
    timestamp: v.timestamp, markers: v.markers,
  }));
  return NextResponse.json({ userId: id, name: user.name, visits: slim });
}
