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

import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { getSessionUserId } from '@/lib/auth';
import { assessWelfare } from '@/lib/welfareGate';
import type { ModelJudge } from '@/lib/welfareGate';
import { WELFARE_MODEL } from '@/lib/model.config';
import { saveBecomingStatement } from '@/lib/returning/becomingStatements';

export const runtime = 'nodejs';

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
  const trimmed = body.completionText.trim();
  if (trimmed.length < 3 || trimmed.length > 140) {
    return NextResponse.json({ error: 'bad_length', min: 3, max: 140 }, { status: 400 });
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
