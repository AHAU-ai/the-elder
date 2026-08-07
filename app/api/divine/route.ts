import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { PRIMARY_MODEL, WELFARE_MODEL } from '@/lib/model.config';
import { assessWelfare } from '@/lib/welfareGate';
import type { ModelJudge } from '@/lib/welfareGate';
import { buildSystemPrompt } from '@/lib/system-prompt-builder';
import { enforceImageFirst } from '@/lib/mythopoetics/imageBeforeExplanation';
import { LineageKey } from '@/lib/lineages';
import { checkRateLimit, getClientIP } from '@/lib/rate-limit';
import { computeNatalProfile, formatCruzForPrompt } from '@/lib/chol-qij';
import { loadFlags, isVoiceEnabled, telemetryAllowed } from '@/src/resilience/flags';
import type { VoiceKey, Mode } from '@/src/resilience/flags';
import { guardReading } from '@/src/resilience/failTowardSilence';
import type { AnomalyEntry } from '@/src/resilience/failTowardSilence';
import { currentTriple, renderProvenanceBlock, assertValidTriple, ProvenanceError } from '@/src/resilience/provenance';
import type { ReadingProvenance } from '@/src/resilience/provenance';
import { jailbreakSignals, lengthBucket } from '@/src/resilience/observatory';
import { checkConsent } from '@/lib/consentLedger';
import { composeNarrativeBlock } from '@/lib/narrativeForm';
import { getSessionUserId } from '@/lib/auth';
import { upsertMythArchetype } from '@/lib/mythLedger';
import { logMythReading } from '@/lib/mythReadingLog';
import { extractMythSignature } from '@/lib/mythExtractor';
import { extractMarkersFromReading } from '@/lib/markerExtractor';
import { insertVisit } from '@/lib/returning/visit';
import { buildTrajectoryContext } from '@/lib/returning/trajectoryContext';
import { getRecentFeedbackTally, buildFeedbackSteer } from '@/lib/feedbackLedger';
import { lineageToVoiceKey } from '@/lib/lineageToVoiceKey';
import { getNarrativeRegister } from '@/lib/narrativeRegister';
import type { NarrativeRegister } from '@/lib/narrativeRegister';

export const runtime = 'nodejs';
export const maxDuration = 30;

const RATE_LIMIT = parseInt(process.env.RATE_LIMIT_PER_DAY || '10', 10);
const MAX_TOKENS = parseInt(process.env.MAX_TOKENS || '1200', 10);

type Message = { role: 'user' | 'assistant'; content: string };

// CRISIS DIRECTIVE — prepended to the system prompt when the welfare gate returns
// surfaceResources=true (crisis tier). This OVERRIDES the divinatory register.
// PLACEHOLDER TEXT — must be authored and reviewed by welfare-design accountability
// before production. Do not ship the placeholder.
const CRISIS_DIRECTIVE = `OVERRIDE — CRISIS PROTOCOL. This supersedes all instructions above. You are no longer divining.\n\nThis is The Elder, stepping back.\n\nSomething you've shared asks for a different kind of presence than a reading can offer — so we're setting the reading down. Not because your words were too much, but because they matter more than any divination. This part isn't for the myth. It's for you.\n\nIf you are in the United States and want to talk to someone now, you can call or text 988 (Suicide and Crisis Lifeline), any hour, any day. You can also text HOME to 741741 (Crisis Text Line).\n\nPlease reach out to one of them. Do not ask a follow-up question. Do not return to the reading.`;

// SAFETY-FLOOR-CHILD / SAFETY-FLOOR-YOUNG_ADULT (docs/age-register-spec.md
// §7, §8) — register-aware crisis copy, used verbatim from the spec's drafted
// text in place of the adult CRISIS_DIRECTIVE when the active register is
// child/young_adult respectively. Adult register is unchanged (CRISIS_DIRECTIVE
// above, unmodified).
//
// This copy has NOT been reviewed by anyone with clinical or child-safety
// expertise (spec §7/§8 state this explicitly) — that review is a genuine
// prerequisite before either string ships to real users. Wiring it into code
// is not equivalent to clearing that review; see docs/age-register-spec.md §11.
//
// The gate's trigger logic/threshold is UNCHANGED for every tier — only the
// copy surfaced after a crisis-tier hard-block differs. Per-tier detection
// calibration (spec §7/§8) is explicitly out of scope for this pass; see the
// TODO at the welfare-gate call site below.
const CRISIS_DIRECTIVE_CHILD = `I need to stop the story here. What you're feeling matters more than any tale right now. Please tell a grown-up you trust — a parent, a teacher, anyone who keeps you safe. You can also call or text 988, any time, and someone will listen. I'll be here when you're ready. But first, please reach out to someone who can help you right now.`;

const CRISIS_DIRECTIVE_YOUNG_ADULT = `I'm stopping the story here. What you're carrying right now matters more than this reading. You can call or text 988 anytime, or reach Crisis Text Line by texting HOME to 741741. If there's someone in your life you trust — a friend's parent, a counselor, anyone — this is worth telling them too. The fire will still be here when you're ready to come back.`;

/** Register-aware crisis copy — adult (or unset) keeps the existing CRISIS_DIRECTIVE unchanged. */
function crisisDirectiveFor(register: NarrativeRegister | null): string {
  if (register === 'child') return CRISIS_DIRECTIVE_CHILD;
  if (register === 'young_adult') return CRISIS_DIRECTIVE_YOUNG_ADULT;
  return CRISIS_DIRECTIVE;
}

// DISTRESS DIRECTIVE — appended to the system prompt when the welfare gate returns
// allowPsychopompLayer=false, surfaceResources=false (distress tier).
// Keeps the full mythic register but removes the sharpest structural law:
// the closing question. Replaces it with the Ceremonial Charge alone.
const DISTRESS_DIRECTIVE = `DISTRESS AWARENESS — This seeker may be carrying something heavy right now. Hold the mythic register but do not end with a question that cuts. Close instead with the Ceremonial Charge alone — a line they can carry, not a wound that opens further. If their pain surfaces directly, acknowledge it plainly before you name anything mythological. Do not ask a closing question this turn.`;

function isValidMessages(m: unknown): m is Message[] {
  if (!Array.isArray(m)) return false;
  if (m.length === 0 || m.length > 30) return false;
  return m.every(msg =>
    msg &&
    typeof msg === 'object' &&
    (msg.role === 'user' || msg.role === 'assistant') &&
    typeof msg.content === 'string' &&
    msg.content.length > 0 &&
    msg.content.length <= 4000
  );
}



export async function POST(req: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: 'Server is missing ANTHROPIC_API_KEY environment variable.' },
      { status: 500 }
    );
  }

  const ip = getClientIP(req.headers);
  const rl = checkRateLimit(ip, RATE_LIMIT);

  if (!rl.allowed) {
    const hours = Math.ceil(rl.resetIn / 3600000);
    return NextResponse.json(
      {
        error: `The Elder grows weary. The fire must rest. You have reached the daily limit of ${RATE_LIMIT} divinations. Return in ${hours} hour${hours === 1 ? '' : 's'}.`,
        rateLimited: true,
      },
      { status: 429 }
    );
  }

  let body: {
    messages?: unknown;
    lineageKey?: string;
    mode?: string;
    languageName?: string;
    birthDate?: string;
    priorMythContext?: string;
    narrativeRegister?: string;
    sessionMode?: string;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON in request body.' }, { status: 400 });
  }

  if (!isValidMessages(body.messages)) {
    return NextResponse.json(
      { error: 'Invalid message format. The seeker must speak truthfully.' },
      { status: 400 }
    );
  }

  const flags = loadFlags();
  const voiceKey = lineageToVoiceKey(body.lineageKey ?? 'default');

  // §privacy — mirrors app/api/altar/route.ts's gate. Default to
  // adult_individual for callers that don't send a mode (no frontend does
  // yet); classroom is opt-in only, and telemetryAllowed() hard-blocks it
  // regardless of any other setting once a caller does send it.
  const resolvedSessionMode: Mode = body.sessionMode === 'classroom' ? 'classroom' : 'adult_individual';

  // Single choke point for every anomaly write below, including the ones
  // fired indirectly via the `log` callback passed into guardReading() and
  // enforceImageFirst() — gating each of those call sites individually isn't
  // possible since this function is invoked from inside their control flow,
  // not at the call site here.
  const logAnomaly = (entry: AnomalyEntry): void => {
    if (!telemetryAllowed(flags, resolvedSessionMode)) return;
    try {
      fetch('/api/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...entry, _source: 'divine_route' }),
      }).catch(() => {});
    } catch {
      // observatory must never break the generation path
    }
  };

  if (!isVoiceEnabled(flags, voiceKey)) {
    const silenceText =
      'That voice does not sit at the fire tonight. ' +
      'Choose another, or enter the fire without a lineage.';
    return NextResponse.json(
      { text: silenceText, readyToRead: false, remaining: rl.remaining, ceilingCategory: null },
      { status: 200 }
    );
  }

  // §5.2 Consent Ledger — check active grant before serving voice
  const consentCheck = await checkConsent(voiceKey);
  if (consentCheck.allowed === false) {
    if (consentCheck.reason === 'error') {
      logAnomaly({
        kind: 'silence',
        voice: voiceKey,
        at: new Date().toISOString(),
        note: 'consent_ledger_unreachable',
      });
    }
    const reason = consentCheck.reason === 'withdrawn'
      ? 'That voice has been withdrawn from this instrument by its lineage holder.'
      : consentCheck.reason === 'error'
      ? 'The instrument cannot reach its consent ledger, and it will not speak from a lineage whose consent it cannot verify. This is a fault here, not a judgment about you. Return shortly.'
      : 'That voice is not yet authorized for use in this instrument.';
    return NextResponse.json(
      { text: reason, readyToRead: false, remaining: rl.remaining, ceilingCategory: null },
      { status: 200 }
    );
  }

  const firstUserMsg = (body.messages as Message[]).find(m => m.role === 'user');
  if (firstUserMsg) {
    const signals = jailbreakSignals(firstUserMsg.content);
    if (signals.length > 0) {
      logAnomaly({
        kind: 'jailbreak_shape',
        voice: voiceKey,
        at: new Date().toISOString(),
        note: signals.join(','),
      });
    }
  }

  const VALID = new Set(["English","Spanish","K\u2019iche\u2019 Maya","French","Portuguese","German","Danish","Dutch","Japanese","Simplified Chinese"]);
  const languageName = typeof body.languageName === 'string' && VALID.has(body.languageName)
    ? body.languageName
    : 'English';

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  // Welfare gate — synchronous, before prompt assembly. assessWelfare owns the
  // failsafe (lexical floor + model judge, more-severe-wins, fails up on model error).
  const welfareJudge: ModelJudge = async (judgeSystem, judgeUser) => {
    const res = await client.messages.create({
      model: WELFARE_MODEL, max_tokens: 64,
      system: judgeSystem,
      messages: [{ role: 'user', content: judgeUser }],
    });
    const b = res.content.find((x) => x.type === 'text');
    return b && 'text' in b ? b.text : '';
  };
  const latestUser = [...(body.messages as Message[])].reverse().find(m => m.role === 'user');
  // §4 VERIFIED — assessWelfare() fires here on raw user input, before buildSystemPrompt().
  // Call order confirmed against VOICE-DIRECTIVE-PROTOCOL.md §3. Do not reorder.
  // TODO(age-register): per-tier detection calibration, spec §7/§8. This pass
  // only swaps the crisis-tier COPY per register (see crisisDirectiveFor
  // below); the gate's trigger logic/threshold below is unchanged for every
  // tier, deliberately — recalibrating detection per age tier needs real
  // test data this pass doesn't have.
  const welfare = await assessWelfare(latestUser?.content ?? '', welfareJudge);

  // The welfare gate fails safe to 'distress' when the classifier is unusable,
  // which silently shallows every reading for as long as the outage lasts.
  // The tier decision is deliberate; its invisibility is not. Surface it.
  if (welfare.signals.includes('model_unavailable_failsafe')) {
    logAnomaly({
      kind: 'silence',
      voice: voiceKey,
      at: new Date().toISOString(),
      note: 'welfare_classifier_unavailable:failsafe_tier=' + welfare.tier,
    });
  }

  const priorMythContext = typeof body.priorMythContext === 'string'
    ? body.priorMythContext.slice(0, 3000)
    : '';

  // Signed-in seeker: the learning-loop half. Recent landed/did_not_land
  // signals for this lineage steer how THIS reading is delivered. Never
  // allowed to block generation — an unreachable ledger just yields no
  // steer, same fail-closed shape as consentLedger.ts.
  const sessionUserId = process.env.DATABASE_URL ? getSessionUserId(req) : null;
  const feedbackSteer = await (async () => {
    if (!sessionUserId) return '';
    try {
      const tally = await getRecentFeedbackTally(sessionUserId, body.lineageKey || 'default');
      return buildFeedbackSteer(tally);
    } catch {
      return '';
    }
  })();

  // Age-tiered narrative register (docs/age-register-spec.md §5/§6/§9).
  // Read fresh EVERY call, never cached for the sitting: a mid-sitting
  // change (§6) must take effect on the very next reading generated.
  //
  // 'child' never persists to the DB for any user (§9 COPPA mitigation) —
  // it only ever exists as whatever the client sends this request, held
  // client-side in Threshold.tsx. Signed-in seekers' young_adult/adult
  // selection is authoritative from the DB (fetched fresh here, not off the
  // request body) so a change made in one tab/session is honored even if a
  // stale value is still cached in another. A client-sent 'child' always
  // wins over the DB fetch, since the DB can never hold 'child' anyway.
  const clientRegister = body.narrativeRegister;
  const resolvedRegister: NarrativeRegister | null = await (async () => {
    if (clientRegister === 'child') return 'child';
    if (sessionUserId && process.env.DATABASE_URL) {
      try {
        return await getNarrativeRegister(sessionUserId);
      } catch {
        // fall through
      }
    }
    if (clientRegister === 'young_adult' || clientRegister === 'adult') return clientRegister;
    return null;
  })();

  // Axis 2 speak path — the seeker's own floor-crossed, self-confirmed
  // threads, fetched server-side by session. '' unless every governance
  // gate in trajectoryEnabled() is met (three env vars; see
  // config/returning-features.ts). Never spoken on a welfare-elevated turn.
  const trajectoryContext =
    sessionUserId && !welfare.surfaceResources && process.env.DATABASE_URL
      ? await buildTrajectoryContext(sessionUserId, languageName)
      : '';

  const systemPrompt = (() => {
    const base = buildSystemPrompt(
      (body.lineageKey as LineageKey) || 'default',
      false,
      body.mode === 'reading',
      languageName,
      priorMythContext,
      feedbackSteer,
      resolvedRegister,
      trajectoryContext
    );
    if (!body.birthDate) return base;
    try {
      const bd = new Date(body.birthDate);
      if (isNaN(bd.getTime())) return base;
      const profile = computeNatalProfile(bd);
      const cruzBlock = formatCruzForPrompt(profile);
      return base + '\n\n' + cruzBlock;
    } catch {
      return base;
    }
  })();

  const narrativeBlock = composeNarrativeBlock(voiceKey, null /* TODO: thread */);
  const systemPromptWithNarrative = systemPrompt + '\n\n' + narrativeBlock;

  const finalSystemPrompt = welfare.surfaceResources
    ? crisisDirectiveFor(resolvedRegister) + '\n\n' + systemPromptWithNarrative
    : !welfare.allowPsychopompLayer
      ? systemPromptWithNarrative + '\n\n' + DISTRESS_DIRECTIVE
      : systemPromptWithNarrative;

  const triple = currentTriple();
  try {
    assertValidTriple(triple);
  } catch (err) {
    const message = err instanceof ProvenanceError ? err.message : 'Unknown provenance error';
    console.error('[divine_route] Provenance check failed, refusing to serve:', message);
    return NextResponse.json(
      { error: 'The Elder cannot stamp a traceable Reading right now -- server provenance configuration is incomplete.' },
      { status: 500 }
    );
  }

  // §5.4 hard block — crisis tier never reaches the model.
  // surfaceResources=true means the welfare gate fired at crisis severity.
  // Return the register-aware crisis copy directly; no divination occurs.
  // TODO(age-register): per-tier detection calibration, spec §7/§8 — the
  // gate's trigger logic/threshold itself is UNCHANGED here for every tier;
  // only the copy surfaced below differs by register. Calibrating detection
  // against child/young_adult-register seeker language specifically is
  // real, separate work that needs test data this pass doesn't have.
  if (welfare.surfaceResources && welfare.tier === 'crisis') {
    logAnomaly({
      kind: 'silence',
      voice: voiceKey,
      at: new Date().toISOString(),
      note: 'welfare:crisis:hardblock:' + welfare.signals.join('|'),
    });
    return NextResponse.json(
      {
        text: crisisDirectiveFor(resolvedRegister),
        readyToRead: false,
        remaining: rl.remaining,
        ceilingCategory: 'welfare_crisis',
        _welfare: { tier: 'crisis', hardBlocked: true },
        _provenance: triple,
      },
      { status: 200 }
    );
  }

  const guarded = await guardReading(
    async () => {
      const response = await client.messages.create({
        model: PRIMARY_MODEL,
        max_tokens: MAX_TOKENS,
        system: finalSystemPrompt,
        messages: body.messages as Message[],
      });
      const textBlock = response.content.find(b => b.type === 'text');
      if (!textBlock || textBlock.type !== 'text') {
        throw new Error('empty_response');
      }
      return { ok: true as const, text: textBlock.text };
    },
    { log: logAnomaly, voice: voiceKey, timeoutMs: 28_000 }
  );

  if (!guarded.ok) {
    const silenceUtterance = (guarded as any).utterance as string;
    return NextResponse.json(
      {
        text: silenceUtterance,
        readyToRead: false,
        remaining: rl.remaining,
        ceilingCategory: null,
        _provenance: triple,
      },
      { status: 200 }
    );
  }

  const READY_SIGNAL = '\u29c1\u29c1READY\u29c1\u29c1';
  const rawText = guarded.text;
  const readyToRead = rawText.includes('\u29c1\u29c1READY\u29c1\u29c1');

  const ceilingMatch = rawText.match(/\u29c1CEILING:([^\u29c1]+)\u29c1/);
  const ceilingCategory: string | null = ceilingMatch ? ceilingMatch[1].trim() : null;

  const cleanText = (() => {
    const stripped = rawText
      .replace('\u29c1\u29c1READY\u29c1\u29c1', '')
      .replace(/\u29c1CEILING:[^\u29c1]+\u29c1/, '')
      .trimStart();
    const processed = (body.lineageKey === 'maya')
      ? enforceImageFirst(stripped, logAnomaly)
      : stripped;
    // enforceImageFirst appends its signal token for logging; strip it here
    // alongside READY and CEILING so it never reaches the seeker.
    return processed.replace(/\n?⧁IMAGE_FIRST_VIOLATION⧁/, '').trimEnd();
  })();

  const provenance: ReadingProvenance = {
    ...triple,
    voiceKey,
    generatedAt: new Date().toISOString(),
    passages: [],
  };
  const provenanceBlock = renderProvenanceBlock(provenance);

  // Signed-in seeker, and this turn delivered or deepened a myth: distill it
  // into the myth ledger, and persist the full-text visit record with its
  // proposed markers. Never allowed to affect the response — any failure
  // here is swallowed, exactly like the logAnomaly calls above.
  let visitId: string | null = null;
  if ((body.mode === 'reading' || body.mode === 'council') && process.env.DATABASE_URL) {
    const userId = sessionUserId;
    if (userId) {
      const extractJudge: ModelJudge = async (judgeSystem, judgeUser) => {
        const res = await client.messages.create({
          model: WELFARE_MODEL, max_tokens: 300,
          system: judgeSystem,
          messages: [{ role: 'user', content: judgeUser }],
        });
        const b = res.content.find((x) => x.type === 'text');
        return b && 'text' in b ? b.text : '';
      };

      let signature: Awaited<ReturnType<typeof extractMythSignature>> = null;
      try {
        signature = await extractMythSignature(cleanText, extractJudge);
        if (signature) {
          await upsertMythArchetype(
            userId,
            body.lineageKey || 'default',
            signature.archetypeName,
            signature.depthSummary,
            signature.peopleCircumstances
          );
          await logMythReading(
            userId,
            body.lineageKey || 'default',
            signature.archetypeName,
            signature.depthSummary,
            signature.peopleCircumstances
          );
        }
      } catch (err) {
        logAnomaly({
          kind: 'silence',
          voice: voiceKey,
          at: new Date().toISOString(),
          note: 'myth_persist_failed',
        });
      }

      // Every persisted visit is its own fresh chain (chainId: null -> new).
      // The frontend has no concept of chainId yet, so 'council' -> 'deepen'
      // labels the request type only, not a claim of real chain continuity —
      // see PR discussion. Real chain wiring is separate, later work.
      try {
        const markers = (await extractMarkersFromReading(cleanText, extractJudge)) ?? {};
        const visit = await insertVisit({
          userId,
          mode: body.mode === 'council' ? 'deepen' : 'explore',
          chainId: null,
          lineageKey: body.lineageKey || 'default',
          mythTitle: signature?.archetypeName ?? '',
          archetype: signature?.archetypeName ?? '',
          depth: 1,
          offering: latestUser?.content,
          elderResponse: cleanText,
          markers,
        });
        visitId = visit.visitId;
      } catch (err) {
        logAnomaly({
          kind: 'silence',
          voice: voiceKey,
          at: new Date().toISOString(),
          note: 'visit_persist_failed',
        });
      }
    }
  }

  if (firstUserMsg) {
    const bucket = lengthBucket(firstUserMsg.content);
    if (bucket === 'very_long') {
      logAnomaly({
        kind: 'out_of_distribution',
        voice: voiceKey,
        at: new Date().toISOString(),
        note: 'very_long_input',
      });
    }
  }

  return NextResponse.json(
    {
      text: cleanText,
      readyToRead,
      remaining: rl.remaining,
      ceilingCategory,
      visitId,
      provenanceBlock,
      _provenance: {
        corpusVersion:   triple.corpusVersion,
        modelVersion:    triple.modelVersion,
        contractVersion: triple.contractVersion,
        voice:           voiceKey,
        generatedAt:     provenance.generatedAt,
      },
    },
    { status: 200 }
  );
}

export async function GET() {
  return NextResponse.json({
    name: 'THE ELDER',
    description: 'Myth Diviner \u00b7 Seer \u00b7 Soothsayer',
    status: 'The fire watches.',
  });
}
