import { NextRequest, NextResponse } from 'next/server';
import { getSessionUserId } from '@/lib/auth';
import { getPortalBypass, setPortalBypass, parsePortalBypass } from '@/lib/portalPreference';

export const runtime = 'nodejs';

// Who is a member, and whether a member has chosen to go straight in.
// Anyone not signed in (or when the lookup fails) is not a member and always
// meets the door. The preference is only ever written by the member's own
// request; nothing here infers or defaults it on.

const NOT_MEMBER = { member: false, bypass: false };

export async function GET(req: NextRequest) {
  const userId = getSessionUserId(req);
  if (!userId || !process.env.DATABASE_URL) return NextResponse.json(NOT_MEMBER);
  try {
    const { member, bypass } = await getPortalBypass(userId);
    return NextResponse.json({ member, bypass: member && bypass });
  } catch (err) {
    console.error('[user/portal] lookup failed:', err);
    return NextResponse.json(NOT_MEMBER);
  }
}

export async function POST(req: NextRequest) {
  const userId = getSessionUserId(req);
  if (!userId || !process.env.DATABASE_URL) {
    return NextResponse.json({ saved: false }, { status: 401 });
  }
  const body = await req.json().catch(() => null);
  const bypass = parsePortalBypass(body?.bypass);
  if (bypass === null) return NextResponse.json({ saved: false }, { status: 400 });
  try {
    await setPortalBypass(userId, bypass);
    return NextResponse.json({ saved: true, bypass });
  } catch (err) {
    console.error('[user/portal] save failed:', err);
    return NextResponse.json({ saved: false }, { status: 500 });
  }
}
