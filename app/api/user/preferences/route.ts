import { NextRequest, NextResponse } from 'next/server';
import { getSessionUserId } from '@/lib/auth';
import { getLetterEmailPreference, setLetterEmailPreference, setLetterDeliveryDelay } from '@/lib/thresholdLetterLedger';
import { DEFAULT_LETTER_DELAY_DAYS, parseLetterDelay } from '@/lib/letterDelay';

export const runtime = 'nodejs';

// Signed-in-only: whether a kept Threshold Letter is emailed back, and after
// how long (a closed set: lib/letterDelay.ts). Explicit opt-in only -- GET
// defaults to off for anyone not signed in or not yet asked, never inferred.
// One send per letter, ever; the delay is a choice of when, not how often.

const OFF = { lettersByEmail: false, lettersEmailDelayDays: DEFAULT_LETTER_DELAY_DAYS };

export async function GET(req: NextRequest) {
  const userId = getSessionUserId(req);
  if (!userId || !process.env.DATABASE_URL) {
    return NextResponse.json(OFF);
  }
  try {
    const pref = await getLetterEmailPreference(userId);
    return NextResponse.json({ lettersByEmail: pref.enabled, lettersEmailDelayDays: pref.delayDays });
  } catch (err) {
    console.error('[user/preferences] Failed to load preferences:', err);
    return NextResponse.json(OFF);
  }
}

export async function POST(req: NextRequest) {
  const userId = getSessionUserId(req);
  if (!userId || !process.env.DATABASE_URL) {
    return NextResponse.json({ saved: false }, { status: 401 });
  }
  try {
    const body = await req.json().catch(() => null);
    const hasEnabled = typeof body?.lettersByEmail === 'boolean';
    const hasDelayKey = body && Object.prototype.hasOwnProperty.call(body, 'lettersEmailDelayDays');
    const delay = hasDelayKey ? parseLetterDelay(body.lettersEmailDelayDays) : undefined;
    // A delay that is present but outside the closed set is a bad request, never coerced.
    if (hasDelayKey && delay === null) {
      return NextResponse.json({ saved: false }, { status: 400 });
    }
    if (!hasEnabled && delay === undefined) {
      return NextResponse.json({ saved: false }, { status: 400 });
    }
    // Optional: also give the letter the seeker has just kept this delay. The
    // preference alone only governs letters kept from now on (each letter
    // keeps the delay it was kept under), so without this the choice offered
    // at the moment of keeping would silently skip the letter in their hands.
    const forLetterId = Number.isInteger(body?.forLetterId) && body.forLetterId > 0 ? body.forLetterId : null;
    if (body && 'forLetterId' in body && (forLetterId === null || !delay)) {
      return NextResponse.json({ saved: false }, { status: 400 });
    }
    await setLetterEmailPreference(userId, {
      enabled: hasEnabled ? body.lettersByEmail : undefined,
      delayDays: delay ?? undefined,
    });
    if (forLetterId !== null && delay) {
      await setLetterDeliveryDelay(userId, forLetterId, delay);
    }
    const pref = await getLetterEmailPreference(userId);
    return NextResponse.json({ saved: true, lettersByEmail: pref.enabled, lettersEmailDelayDays: pref.delayDays });
  } catch (err) {
    console.error('[user/preferences] Failed to save preferences:', err);
    return NextResponse.json({ saved: false }, { status: 500 });
  }
}
