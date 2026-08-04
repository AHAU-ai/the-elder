// app/api/user/name/route.ts — explicit name updates only (A-1)
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getUser, updateName } from "@/lib/returning/user";

export const runtime = "nodejs";
const ELDER_COOKIE = "elder_user_id";

export async function PATCH(req: Request) {
  const jar = await cookies();
  const id = jar.get(ELDER_COOKIE)?.value;
  if (!id) return NextResponse.json({ error: "not_identified" }, { status: 401 });
  const user = await getUser(id);
  if (!user) return NextResponse.json({ error: "not_identified" }, { status: 401 });

  let body: { name?: string } = {};
  try { body = await req.json(); } catch { return NextResponse.json({ error: "bad_request" }, { status: 400 }); }
  if (!body.name || !body.name.trim()) return NextResponse.json({ error: "name_required" }, { status: 400 });

  await updateName(id, body.name.trim());
  return NextResponse.json({ userId: id, name: body.name.trim() });
}
