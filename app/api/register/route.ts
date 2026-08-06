import { NextRequest, NextResponse } from 'next/server';
import { getSessionUserId } from '@/lib/auth';
import { getNarrativeRegister, setNarrativeRegister, isChildTierEnabled, DEFAULT_NARRATIVE_REGISTER } from '@/lib/narrativeRegister';

export const runtime = 'nodejs';

// Narrative register persistence endpoint (docs/age-register-spec.md §5).
// Signed-in seekers only: 'young_adult'/'adult' persist to elder_user.
// Anonymous seekers, and 'child' for ANY seeker, are never sent here to
// persist — Threshold.tsx keeps those client-side. This route simply has
// nothing to do for those cases (GET falls back to the default; POST is a
// no-op), it does not need to reject them.

export async function GET(req: NextRequest) {
  const childTierEnabled = isChildTierEnabled();
  const userId = getSessionUserId(req);
  if (!userId || !process.env.DATABASE_URL) {
    return NextResponse.json({ register: DEFAULT_NARRATIVE_REGISTER, childTierEnabled });
  }
  try {
    const register = await getNarrativeRegister(userId);
    return NextResponse.json({ register, childTierEnabled });
  } catch {
    return NextResponse.json({ register: DEFAULT_NARRATIVE_REGISTER, childTierEnabled });
  }
}

export async function POST(req: NextRequest) {
  const userId = getSessionUserId(req);
  if (!userId || !process.env.DATABASE_URL) {
    // Anonymous seeker (or DB unavailable) — nothing to persist. The client
    // holds this state itself. Not an error.
    return NextResponse.json({ ok: true, persisted: false });
  }

  let body: { register?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON in request body.' }, { status: 400 });
  }

  const register = body.register;
  if (register !== 'young_adult' && register !== 'adult') {
    // Includes 'child' by design — see lib/narrativeRegister.ts's hard
    // constraint. Not an error state for the client: it just means this
    // selection was never meant to persist.
    return NextResponse.json({ ok: true, persisted: false });
  }

  await setNarrativeRegister(userId, register);
  return NextResponse.json({ ok: true, persisted: true });
}
