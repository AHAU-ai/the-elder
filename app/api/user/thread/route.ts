// app/api/user/thread/route.ts
//
// Seeker-initiated revision of their own trajectory (docs/thread-revision.md,
// Axis 3 "Seeker-initiated correction"). Weeks later a seeker can say of a
// thread The Elder has held for them, "that wasn't that" (release) or "it is
// this" (reword). Nothing here is inferred or proposed by anyone but the seeker:
// it is the same assent as confirm-marker, given later.
//
// Not behind a rollout flag. The right to withdraw or restate your own words
// outlasts the feature, exactly like the release paths in /api/journal; a thread
// that exists can always be revised, whether or not trajectory is currently lit.
//
// Session-scoped; both acts filter by user_id in every statement, so an
// arbitrary trajectoryId can only ever reach the caller's own row, and a foreign
// or missing id is indistinguishable from the outside (404).
import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { getSessionUserId } from '@/lib/auth';
import { assessWelfare } from '@/lib/welfareGate';
import type { ModelJudge } from '@/lib/welfareGate';
import { WELFARE_MODEL } from '@/lib/model.config';
import { checkRateLimit } from '@/lib/rate-limit';
import { cleanRevisedValue, releaseThread, rewordThread } from '@/lib/returning/markerTrajectory';

export const runtime = 'nodejs';
export const maxDuration = 30;

const NO_STORE = { 'Cache-Control': 'no-store' };
const REVISIONS_PER_DAY = 60;

export async function POST(req: NextRequest) {
  const userId = getSessionUserId(req);
  if (!userId) return NextResponse.json({ error: 'not_signed_in' }, { status: 401, headers: NO_STORE });
  if (!process.env.DATABASE_URL) return NextResponse.json({ error: 'unavailable' }, { status: 503, headers: NO_STORE });

  const body = (await req.json().catch(() => null)) as { trajectoryId?: unknown; action?: unknown; value?: unknown } | null;
  const id = body?.trajectoryId;
  if (
    !body ||
    typeof id !== 'number' || !Number.isSafeInteger(id) || id <= 0 ||
    (body.action !== 'release' && body.action !== 'reword')
  ) {
    return NextResponse.json({ error: 'bad_request' }, { status: 400, headers: NO_STORE });
  }

  const rl = await checkRateLimit(`thread:${userId}`, REVISIONS_PER_DAY);
  if (!rl.allowed) return NextResponse.json({ error: 'rate_limited' }, { status: 429, headers: NO_STORE });

  try {
    if (body.action === 'release') {
      const r = await releaseThread(userId, id);
      return r === 'ok'
        ? NextResponse.json({ released: true }, { headers: NO_STORE })
        : NextResponse.json({ error: 'not_found' }, { status: 404, headers: NO_STORE });
    }

    const value = cleanRevisedValue(body.value);
    if (!value) return NextResponse.json({ error: 'bad_request' }, { status: 400, headers: NO_STORE });

    // New words get the same welfare read as any reshape (confirm-marker): a
    // crisis or distress turn changes nothing and surfaces no pattern.
    if (process.env.ANTHROPIC_API_KEY) {
      const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
      const judge: ModelJudge = async (system, user) => {
        const res = await client.messages.create({
          model: WELFARE_MODEL, max_tokens: 64, system, messages: [{ role: 'user', content: user }],
        });
        const b = res.content.find((x) => x.type === 'text');
        return b && 'text' in b ? b.text : '';
      };
      const welfare = await assessWelfare(value, judge);
      if (welfare.surfaceResources && welfare.tier === 'crisis') {
        return NextResponse.json({ error: 'welfare_crisis', tier: welfare.tier }, { headers: NO_STORE });
      }
      if (!welfare.allowPsychopompLayer) {
        return NextResponse.json({ error: 'welfare_distress', tier: welfare.tier }, { headers: NO_STORE });
      }
    } else {
      // No judge available: lexical floor only, which fails safe upward.
      const welfare = await assessWelfare(value);
      if (!welfare.allowPsychopompLayer) {
        return NextResponse.json({ error: welfare.surfaceResources ? 'welfare_crisis' : 'welfare_distress' }, { headers: NO_STORE });
      }
    }

    const r = await rewordThread(userId, id, value);
    if (r === 'conflict') return NextResponse.json({ error: 'conflict' }, { status: 409, headers: NO_STORE });
    return r === 'ok'
      ? NextResponse.json({ reworded: true, value }, { headers: NO_STORE })
      : NextResponse.json({ error: 'not_found' }, { status: 404, headers: NO_STORE });
  } catch (err) {
    // Loud: a revision that did not happen must never read as done.
    console.error('[thread] revision failed:', err);
    return NextResponse.json({ error: 'internal_error' }, { status: 500, headers: NO_STORE });
  }
}
