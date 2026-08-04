// app/api/user/identify/route.ts — read/create only; corrupt-cookie reissue (M-3)
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getUserOrReissue, touchVisit } from "@/lib/returning/user";
import { mostRecentChain } from "@/lib/returning/visit";

export const runtime = "nodejs";
const ELDER_COOKIE = "elder_user_id";

export async function POST(req: Request) {
  let body: { name?: string } = {};
  try { body = await req.json(); } catch {}

  const jar = await cookies();
  const cookieId = jar.get(ELDER_COOKIE)?.value;
  const { user, reissued } = await getUserOrReissue(cookieId, cookieId ? undefined : body.name);

  if (reissued) {
    jar.set(ELDER_COOKIE, user.userId, {
      httpOnly: true, sameSite: "strict",
      secure: process.env.NODE_ENV === "production",
      path: "/", maxAge: 60 * 60 * 24 * 365,
    });
  } else {
    await touchVisit(user.userId);
  }

  const isReturning = !reissued && user.visitCount > 0;
  const head = isReturning ? await mostRecentChain(user.userId) : null;

  return NextResponse.json({
    userId: user.userId,
    isReturning,
    name: user.name,
    visitCount: user.visitCount,
    currentDepth: head?.depth ?? 0,
    deepenAvailable: !!head,
    lastVisit: head ? {
      mythTitle: head.mythTitle, archetype: head.archetype,
      depth: head.depth, chainId: head.chainId, timestamp: head.timestamp,
    } : undefined,
  });
}
