// app/api/becoming-statement/route.ts
//
// POST: persist one kept Becoming completion (Becoming.tsx's "Carry This")
// immediately, so it starts counting as confirmed material right away
// rather than waiting for Core Myth Statement authorship time. Anonymous
// (not-signed-in) seekers still get the full Becoming beat client-side —
// this route just never gets called for them (Becoming.tsx only calls it
// when signedIn), same "sign-in required to be gathered" posture
// MythicJournal.tsx already states outright to seekers.
//
// Same welfare-gate posture as app/api/elder/core-myth-statement/route.ts
// and confirm-marker: the seeker's own words get checked before storage,
// crisis-tier content is hard-blocked from being saved.
//
// RED-TEAM PASS (2026-09-27): this route originally had no rate limit and
// no validation of voiceKey/marker against anything real. Both fixed
// below. Without the rate limit specifically, a scripted, authenticated
// client could call this endpoint directly -- with no reading, no
// ThresholdLetter, no Becoming beat ever having rendered -- and write
// enough becoming_statement rows in a few seconds to cross
// REQUIRED_INTEGRATED_MARKERS and unlock Core Myth Statement eligibility
// with zero genuine engagement. That's exactly the failure mode
// marker_trajectory's real surface->confronted->integrated arc (across
// actual sittings) exists to make hard, and this endpoint reopened it.
// DAILY_LIMIT is deliberately generous for a real seeker (multiple
// readings in a day is plausible) while still bounding a script to
// roughly one day's worth of manufactured eligibility per attempt rather
// than an instant one.

import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { getSessionUserId } from '@/lib/auth';
import { assessWelfare } from '@/lib/welfareGate';
import type { ModelJudge } from '@/lib/welfareGate';
import { WELFARE_MODEL } from '@/lib/model.config';
import { saveBecomingStatement } from '@/lib/returning/becomingStatements';
import { checkRateLimit } from '@/lib/rate-limit';
import { ALL_VOICE_KEYS } from '@/lib/mythopoetics/becoming';
import { loadFlags, isVoiceEnabled } from '@/src/resilience/flags';
import type { VoiceKey } from '@/src/resilience/flags';
import { MARKER_GLYPHS, type MarkerType } from '@/lib/mythopoetics/cardConfig';

export const runtime = 'nodejs';

const DAILY_LIMIT = 6;
const VALID_MARKERS = Object.keys(MARKER_GLYPHS) as MarkerType[];

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Matches core-myth-statement/route.ts's welfareJudge construction verbatim.
const welfareJudge: ModelJudge = async (judgeSystem, judgeUser) => {
  const res = await anthropic.messages.create({
    model: WELFARE_MODEL, max_tokens: 64,
    system: judgeSystem,
    messages: [{ role: 'user', content: judgeUser }],
  });
  const b = res.content.find((x) => x.type === 'text');
  return b && 'text' in b ? b.text : '';
};

type SaveRequest = {
  voiceKey: string;
  archetypeName: string | null;
  marker: string;
  completionStem: string;
  completionText: string;
};

export async function POST(req: NextRequest) {
  const userId = getSessionUserId(req);
  if (!userId) return NextResponse.json({ error: 'not_signed_in' }, { status: 401 });

  // Keyed by user id, not IP -- this route only ever runs for a signed-in
  // seeker, and userId is the actual thing worth bounding (an attacker
  // behind a shared/rotating IP shouldn't get a fresh bucket for free).
  const rate = await checkRateLimit(`becoming-statement:${userId}`, DAILY_LIMIT);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: 'rate_limited', resetIn: rate.resetIn },
      { status: 429 }
    );
  }

  const body = (await req.json().catch(() => null)) as SaveRequest | null;
  if (
    !body ||
    typeof body.voiceKey !== 'string' ||
    typeof body.marker !== 'string' ||
    typeof body.completionStem !== 'string' ||
    typeof body.completionText !== 'string' ||
    (body.archetypeName !== null && typeof body.archetypeName !== 'string')
  ) {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  }
  // Enum validation against the real, current sets -- previously this
  // route stored whatever string a client sent for either field with no
  // check at all (see red-team note above).
  if (!ALL_VOICE_KEYS.includes(body.voiceKey as any)) {
    return NextResponse.json({ error: 'bad_voice_key' }, { status: 400 });
  }
  // A switched-off voice gives no reading, so there is nothing to carry from
  // it; refuse rather than store a row against a voice that is off.
  if (!isVoiceEnabled(loadFlags(), body.voiceKey as VoiceKey)) {
    return NextResponse.json({ error: 'voice_unavailable' }, { status: 403 });
  }
  if (!VALID_MARKERS.includes(body.marker as MarkerType)) {
    return NextResponse.json({ error: 'bad_marker' }, { status: 400 });
  }
  if (body.archetypeName !== null && body.archetypeName.length > 120) {
    return NextResponse.json({ error: 'bad_length', field: 'archetypeName', max: 120 }, { status: 400 });
  }
  if (body.completionStem.length > 80) {
    return NextResponse.json({ error: 'bad_length', field: 'completionStem', max: 80 }, { status: 400 });
  }
  const trimmed = body.completionText.trim();
  if (trimmed.length < 3 || trimmed.length > 140) {
    return NextResponse.json({ error: 'bad_length', field: 'completionText', min: 3, max: 140 }, { status: 400 });
  }

  try {
    const welfare = await assessWelfare(trimmed, welfareJudge);
    if (welfare.surfaceResources && welfare.tier === 'crisis') {
      return NextResponse.json({ error: 'welfare_crisis', tier: welfare.tier }, { status: 200 });
    }
    if (!welfare.allowPsychopompLayer) {
      return NextResponse.json({ error: 'welfare_distress', tier: welfare.tier }, { status: 200 });
    }
  } catch (err) {
    console.error('[becoming-statement] Welfare check failed, refusing to save unchecked text:', err);
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }

  try {
    const saved = await saveBecomingStatement(userId, {
      voiceKey: body.voiceKey,
      archetypeName: body.archetypeName,
      marker: body.marker,
      completionStem: body.completionStem,
      completionText: trimmed,
    });
    return NextResponse.json({ saved: true, statement: saved });
  } catch (err) {
    if (err instanceof RangeError) {
      return NextResponse.json({ error: 'bad_length', min: 3, max: 140 }, { status: 400 });
    }
    console.error('[becoming-statement] Save failed:', err);
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}
