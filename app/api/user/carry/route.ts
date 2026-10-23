// app/api/user/carry/route.ts
//
// R2/R3 (ADR-0015). GET: the carry to give back on a return (and whether to
// offer one at all). POST: record what the seeker chose to carry out of one of
// their readings. DELETE: release it. Session-scoped throughout; gated by
// carryEnabled(). The line is stored and read back to its author only.
import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { getSessionUserId } from '@/lib/auth';
import { carryEnabled } from '@/config/returning-features';
import { assessWelfare } from '@/lib/welfareGate';
import type { ModelJudge } from '@/lib/welfareGate';
import { WELFARE_MODEL } from '@/lib/model.config';
import { checkRateLimit } from '@/lib/rate-limit';
import { getVisitForUser } from '@/lib/returning/visit';
import { buildCarryResponse, validateCarryInput } from '@/lib/returning/carry';
import { carryRows, recordCarry, releaseCarry } from '@/lib/returning/carryLedger';

export const runtime = 'nodejs';
export const maxDuration = 30;

const CARRY_RATE_LIMIT_PER_DAY = 30;

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
// Same construction as confirm-marker / divine: the welfare classifier is the
// only model that ever sees the seeker's line, and it only assigns a tier.
const welfareJudge: ModelJudge = async (judgeSystem, judgeUser) => {
  const res = await anthropic.messages.create({
    model: WELFARE_MODEL, max_tokens: 64,
    system: judgeSystem,
    messages: [{ role: 'user', content: judgeUser }],
  });
  const b = res.content.find((x) => x.type === 'text');
  return b && 'text' in b ? b.text : '';
};

const NO_STORE = { 'Cache-Control': 'no-store' };

export async function GET(req: NextRequest) {
  const userId = getSessionUserId(req);
  if (!userId) return NextResponse.json({ error: 'not_signed_in' }, { status: 401 });
  const enabled = carryEnabled();
  try {
    const rows = enabled ? await carryRows(userId) : [];
    return NextResponse.json(buildCarryResponse(rows, enabled, Date.now()), { headers: NO_STORE });
  } catch (err) {
    console.error('[user/carry] read failed:', err);
    return NextResponse.json({ enabled: false, carry: null }, { headers: NO_STORE });
  }
}

export async function POST(req: NextRequest) {
  const userId = getSessionUserId(req);
  if (!userId) return NextResponse.json({ error: 'not_signed_in' }, { status: 401 });
  if (!carryEnabled()) return NextResponse.json({ error: 'not_enabled' }, { status: 403 });

  const body = await req.json().catch(() => null);
  const input = validateCarryInput(body);
  const visitId = (body as { visitId?: unknown } | null)?.visitId;
  if (!input.ok || typeof visitId !== 'string') {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  }

  const rl = await checkRateLimit(`carry:${userId}`, CARRY_RATE_LIMIT_PER_DAY);
  if (!rl.allowed) return NextResponse.json({ error: 'rate_limited' }, { status: 429 });

  try {
    const visit = await getVisitForUser(userId, visitId);
    if (!visit) return NextResponse.json({ error: 'visit_not_found' }, { status: 404 });

    // Free text is welfare-gated exactly like a marker reshape. A crisis or
    // distress reading stores nothing and fails toward silence.
    if (input.line) {
      const welfare = await assessWelfare(input.line, welfareJudge);
      if (welfare.surfaceResources && welfare.tier === 'crisis') {
        return NextResponse.json({ error: 'welfare_crisis', tier: welfare.tier }, { status: 200 });
      }
      if (!welfare.allowPsychopompLayer) {
        return NextResponse.json({ error: 'welfare_distress', tier: welfare.tier }, { status: 200 });
      }
    }

    const carried = await recordCarry(userId, visitId, input.practiceKey, input.line);
    return NextResponse.json({ carried, alreadyCarried: !carried });
  } catch (err) {
    console.error('[user/carry] write failed:', err);
    return NextResponse.json({ error: 'carry_failed' }, { status: 500 });
  }
}

// Release is user-initiated, so it fails LOUD: a DB failure is a 500, never a
// silent "released" (same posture as /api/user/history DELETE).
export async function DELETE(req: NextRequest) {
  const userId = getSessionUserId(req);
  if (!userId) return NextResponse.json({ error: 'not_signed_in' }, { status: 401 });
  const body = (await req.json().catch(() => null)) as { carryId?: unknown } | null;
  const carryId = typeof body?.carryId === 'string' && /^\d{1,18}$/.test(body.carryId) ? body.carryId : null;
  if (!carryId) return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  try {
    const n = await releaseCarry(userId, carryId);
    if (n === 0) return NextResponse.json({ error: 'not_found' }, { status: 404 });
    return NextResponse.json({ released: n });
  } catch (err) {
    console.error('[user/carry] release failed:', err);
    return NextResponse.json({ error: 'release_failed' }, { status: 500 });
  }
}
