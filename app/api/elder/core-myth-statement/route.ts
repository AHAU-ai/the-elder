// app/api/elder/core-myth-statement/route.ts
//
// GET: eligibility + material (if invited/dismissed-but-eligible) + the
// seeker's current statement, if they have one.
// POST: save a new version. The Elder never drafts this -- body_text is
// entirely the seeker's own words, validated for length/welfare only,
// never rewritten, never suggested, never autocompleted.
//
// Session-scoped throughout (getSessionUserId), same fail-closed posture
// as thresholdLetterLedger.ts: no client-trusted reads, ownership checked
// server-side on every call, never inferred from a client-supplied id.

import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { getSessionUserId } from '@/lib/auth';
import { assessWelfare } from '@/lib/welfareGate';
import type { ModelJudge } from '@/lib/welfareGate';
import { WELFARE_MODEL } from '@/lib/model.config';
import {
  getEligibility,
  assembleIntegratedMaterial,
  getCurrentStatement,
  getStatementHistory,
  saveNewStatement,
  VersionConflictError,
  BODY_MIN_CHARS,
  BODY_MAX_CHARS,
} from '@/lib/returning/coreMythStatement';

export const runtime = 'nodejs';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Matches app/api/elder/confirm-marker/route.ts's welfareJudge construction verbatim.
const welfareJudge: ModelJudge = async (judgeSystem, judgeUser) => {
  const res = await anthropic.messages.create({
    model: WELFARE_MODEL, max_tokens: 64,
    system: judgeSystem,
    messages: [{ role: 'user', content: judgeUser }],
  });
  const b = res.content.find((x) => x.type === 'text');
  return b && 'text' in b ? b.text : '';
};

export async function GET(req: NextRequest) {
  const userId = getSessionUserId(req);
  if (!userId) return NextResponse.json({ error: 'not_signed_in' }, { status: 401 });

  try {
    const [eligibility, current, history] = await Promise.all([
      getEligibility(userId),
      getCurrentStatement(userId),
      getStatementHistory(userId),
    ]);
    // Material is only assembled (and sent) when there's actually
    // something to offer -- never computed uselessly below the floor.
    const material = eligibility.status !== 'not_eligible' ? await assembleIntegratedMaterial(userId) : [];
    return NextResponse.json({ eligibility, material, current, history });
  } catch (err) {
    console.error('[core-myth-statement] GET failed:', err);
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}

type SaveRequest = { bodyText: string; sourceMarkerIds: number[] };

export async function POST(req: NextRequest) {
  const userId = getSessionUserId(req);
  if (!userId) return NextResponse.json({ error: 'not_signed_in' }, { status: 401 });

  const body = (await req.json().catch(() => null)) as SaveRequest | null;
  if (
    !body ||
    typeof body.bodyText !== 'string' ||
    !Array.isArray(body.sourceMarkerIds) ||
    !body.sourceMarkerIds.every((n) => typeof n === 'number' && Number.isInteger(n))
  ) {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  }
  const trimmed = body.bodyText.trim();
  if (trimmed.length < BODY_MIN_CHARS || trimmed.length > BODY_MAX_CHARS) {
    return NextResponse.json({ error: 'bad_length', min: BODY_MIN_CHARS, max: BODY_MAX_CHARS }, { status: 400 });
  }

  // The seeker's own words get the same welfare check confirm-marker's
  // reshape text already receives before storage -- crisis-tier content
  // is hard-blocked from being saved, same posture, not a new one.
  try {
    const welfare = await assessWelfare(trimmed, welfareJudge);
    if (welfare.surfaceResources && welfare.tier === 'crisis') {
      return NextResponse.json({ error: 'welfare_crisis', tier: welfare.tier }, { status: 200 });
    }
    if (!welfare.allowPsychopompLayer) {
      return NextResponse.json({ error: 'welfare_distress', tier: welfare.tier }, { status: 200 });
    }
  } catch (err) {
    console.error('[core-myth-statement] Welfare check failed, refusing to save unchecked text:', err);
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }

  try {
    const saved = await saveNewStatement(userId, trimmed, body.sourceMarkerIds);
    return NextResponse.json({ saved: true, statement: saved });
  } catch (err) {
    if (err instanceof VersionConflictError) {
      return NextResponse.json({ saved: false, error: 'version_conflict' }, { status: 409 });
    }
    if (err instanceof RangeError) {
      return NextResponse.json({ error: 'bad_length', min: BODY_MIN_CHARS, max: BODY_MAX_CHARS }, { status: 400 });
    }
    console.error('[core-myth-statement] Save failed:', err);
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}
