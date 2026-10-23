// app/api/fireside/route.ts
//
// The fireside (docs/fireside.md): a room where the seeker talks with the Elder
// as host. It reuses, and does not reimplement, the project's safety spine:
//
//   welfare gate   assessWelfare on every message, model judge + lexical floor.
//                  Crisis never reaches the model (hard block, same copy as the
//                  Reading: server.crisis_adult). Distress gets a plain-presence
//                  prompt.
//   dual guardian  dualGuardReading on every reply, fail closed. A declined or
//                  failed reply is a silence, never a retry-until-it-passes.
//   journal rule   a crisis or distress turn is NEVER written (lib/fireside.ts
//                  shouldPersist); neither is a declined reply.
//
// Dark by default and governed (config/returning-features.ts firesideEnabled):
// 404 `not_lit` for everyone while closed, and for non-testers during stage 1.
//
//   GET     the seeker's own exchanges + whether the room is lit for them
//   POST    one turn
//   PUT     keep one line, in the seeker's own words, from one of their exchanges
//   DELETE  release one exchange (?id=)
import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { getSessionUserId } from '@/lib/auth';
import { firesideStageAllows } from '@/config/returning-features';
import { getTierRecord } from '@/lib/tierLedger';
import { assessWelfare } from '@/lib/welfareGate';
import type { ModelJudge } from '@/lib/welfareGate';
import { dualGuardReading } from '@/lib/dualGuardian';
import { PRIMARY_MODEL, WELFARE_MODEL } from '@/lib/model.config';
import { CEILING_PROTOCOL, OUT_OF_SCOPE_HANDOFF } from '@/lib/system-prompt-builder';
import { composeNarrativeBlock } from '@/lib/narrativeForm';
import { languageDirective } from '@/lib/i18n/languageDirective';
import { languageNameFromInput } from '@/lib/i18n/languages';
import { serverText } from '@/lib/i18n/serverText';
import { en } from '@/lib/i18n/messages/en';
import { checkRateLimit } from '@/lib/rate-limit';
import {
  buildFiresideSystem,
  FIRESIDE_RATE_LIMIT_PER_DAY,
  FIRESIDE_TRADITION_SLUG,
  MAX_ELDER_CHARS,
  parseFiresideRequest,
  shouldPersist,
  validateKeptLine,
} from '@/lib/fireside';
import {
  keepFiresideLine,
  listFiresideEntries,
  releaseFiresideEntry,
  saveFiresideEntry,
} from '@/lib/firesideLedger';

export const runtime = 'nodejs';
export const maxDuration = 60;

const NO_STORE = { 'Cache-Control': 'no-store' };
const GENERATION_TIMEOUT_MS = 25_000;
const GUARDIAN_TIMEOUT_MS = 14_000;
const MAX_TOKENS = 450;

async function litFor(userId: number): Promise<boolean> {
  if (!process.env.DATABASE_URL) return false;
  try {
    return firesideStageAllows((await getTierRecord(userId)).isTester === true);
  } catch {
    return false;
  }
}

const notLit = () => NextResponse.json({ error: 'not_lit' }, { status: 404, headers: NO_STORE });
const notSignedIn = () => NextResponse.json({ error: 'not_signed_in' }, { status: 401, headers: NO_STORE });

export async function GET(req: NextRequest) {
  const userId = getSessionUserId(req);
  if (!userId) return notSignedIn();
  // The room's existence is the answer: a closed room is simply not there.
  if (!(await litFor(userId))) return NextResponse.json({ lit: false, entries: [] }, { headers: NO_STORE });

  try {
    return NextResponse.json({ lit: true, entries: await listFiresideEntries(userId) }, { headers: NO_STORE });
  } catch (err) {
    console.error('[fireside] list failed:', err);
    return NextResponse.json({ lit: true, entries: [] }, { headers: NO_STORE });
  }
}

export async function POST(req: NextRequest) {
  const userId = getSessionUserId(req);
  if (!userId) return notSignedIn();
  if (!(await litFor(userId))) return notLit();

  const body = await req.json().catch(() => null);
  const parsed = parseFiresideRequest(body);
  if (!parsed.ok) return NextResponse.json({ error: 'bad_request' }, { status: 400, headers: NO_STORE });

  const languageName = languageNameFromInput(parsed.languageName);
  const ST = await serverText(languageName);

  const rl = await checkRateLimit(`fireside:${userId}`, FIRESIDE_RATE_LIMIT_PER_DAY);
  if (!rl.allowed) {
    return NextResponse.json({ text: ST.say('server.tier_limit'), entryId: null, kept: false }, { headers: NO_STORE });
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ text: ST.silence('model_error'), entryId: null, kept: false }, { headers: NO_STORE });
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const welfareJudge: ModelJudge = async (system, user) => {
    const res = await client.messages.create({
      model: WELFARE_MODEL, max_tokens: 64, system, messages: [{ role: 'user', content: user }],
    });
    const b = res.content.find((x) => x.type === 'text');
    return b && 'text' in b ? b.text : '';
  };

  // Welfare first, on the raw message, before any generation.
  const welfare = await assessWelfare(parsed.message, welfareJudge);
  if (welfare.surfaceResources && welfare.tier === 'crisis') {
    // Same copy, same hard block as a Reading. No model call, and nothing written.
    return NextResponse.json(
      { text: ST.safety('server.crisis_adult', (en as Record<string, string>)['server.crisis_adult']), entryId: null, kept: false, crisis: true },
      { headers: NO_STORE }
    );
  }

  const system =
    buildFiresideSystem(
      { frame: composeNarrativeBlock('elder_frame'), ceiling: CEILING_PROTOCOL, handoff: OUT_OF_SCOPE_HANDOFF },
      welfare.tier === 'distress'
    ) +
    '\n\n' +
    languageDirective(languageName);

  let text = '';
  try {
    const res = await client.messages.create(
      {
        model: PRIMARY_MODEL,
        max_tokens: MAX_TOKENS,
        system,
        messages: [...parsed.context, { role: 'user' as const, content: parsed.message }],
      },
      { timeout: GENERATION_TIMEOUT_MS }
    );
    const b = res.content.find((x) => x.type === 'text');
    text = b && 'text' in b ? b.text.trim() : '';
  } catch {
    return NextResponse.json({ text: ST.silence('model_timeout'), entryId: null, kept: false }, { headers: NO_STORE });
  }
  if (!text || text.length > MAX_ELDER_CHARS) {
    return NextResponse.json({ text: ST.silence('contract_violation'), entryId: null, kept: false }, { headers: NO_STORE });
  }

  // The dual guardian reviews every reply, on distress turns too. Fail closed.
  const verdict = await dualGuardReading(
    { voiceKey: FIRESIDE_TRADITION_SLUG, reading: text, seekerInput: parsed.message },
    { timeoutMs: GUARDIAN_TIMEOUT_MS }
  ).catch(() => null);
  const passed = !!verdict && verdict.passed === true;
  if (!passed) {
    return NextResponse.json({ text: ST.silence('contract_violation'), entryId: null, kept: false }, { headers: NO_STORE });
  }

  // The journal rule: only an ordinary, guardian-passed turn is ever written.
  let entryId: number | null = null;
  if (shouldPersist(welfare.tier, passed)) {
    try {
      entryId = await saveFiresideEntry(userId, parsed.message, text);
    } catch (err) {
      console.error('[fireside] save failed:', err); // not kept; the reply still stands, and says so by having no id
    }
  }
  return NextResponse.json({ text, entryId, kept: false }, { headers: NO_STORE });
}

export async function PUT(req: NextRequest) {
  const userId = getSessionUserId(req);
  if (!userId) return notSignedIn();
  // Keeping or releasing what is already the seeker's own is not gated on the
  // room being lit: the right to their own words outlasts the feature.
  const body = (await req.json().catch(() => null)) as { id?: unknown; line?: unknown } | null;
  const id = Number(body?.id);
  const line = validateKeptLine(body?.line);
  if (!Number.isSafeInteger(id) || id <= 0 || !line.ok) {
    return NextResponse.json({ error: 'bad_request' }, { status: 400, headers: NO_STORE });
  }
  try {
    const ok = await keepFiresideLine(userId, id, line.line);
    return ok
      ? NextResponse.json({ kept: true, line: line.line }, { headers: NO_STORE })
      : NextResponse.json({ error: 'not_found' }, { status: 404, headers: NO_STORE });
  } catch (err) {
    console.error('[fireside] keep failed:', err);
    return NextResponse.json({ error: 'keep_failed' }, { status: 500, headers: NO_STORE });
  }
}

export async function DELETE(req: NextRequest) {
  const userId = getSessionUserId(req);
  if (!userId) return notSignedIn();
  const id = Number(req.nextUrl.searchParams.get('id'));
  if (!Number.isSafeInteger(id) || id <= 0) {
    return NextResponse.json({ error: 'bad_request' }, { status: 400, headers: NO_STORE });
  }
  try {
    // Loud on failure: a release that did not happen must not read as done.
    const ok = await releaseFiresideEntry(userId, id);
    return ok
      ? NextResponse.json({ released: true }, { headers: NO_STORE })
      : NextResponse.json({ error: 'not_found' }, { status: 404, headers: NO_STORE });
  } catch (err) {
    console.error('[fireside] release failed:', err);
    return NextResponse.json({ error: 'release_failed' }, { status: 500, headers: NO_STORE });
  }
}
