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
import { guardReading, silence } from '@/src/resilience/failTowardSilence';
import type { AnomalyEntry } from '@/src/resilience/failTowardSilence';
import { dualGuardReading } from '@/lib/dualGuardian';
import type { DualGuardianVerdict } from '@/lib/dualGuardian';
import type { ViolationCategory } from '@/lib/guardian';
import { getTradition } from '@/lib/traditions';
import { voiceKeyToTraditionSlug } from '@/lib/voiceKeyToTraditionSlug';
import { REGISTER_PROFILES, describeGatedThemes } from '@/lib/register';
import type { AudienceRegister } from '@/lib/register';
import { recordGuardianRejection } from '@/lib/altarRecord';
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
import { insertVisit, mostRecentChain, assembleDeepContext, renderChainContext } from '@/lib/returning/visit';
import { buildTrajectoryContext } from '@/lib/returning/trajectoryContext';
import { getRecentFeedbackTally, buildFeedbackSteer } from '@/lib/feedbackLedger';
import { lineageToVoiceKey } from '@/lib/lineageToVoiceKey';
import { getNarrativeRegister, isChildTierEnabled } from '@/lib/narrativeRegister';
import type { NarrativeRegister } from '@/lib/narrativeRegister';

export const runtime = 'nodejs';
// Was 30, then 45 for the single-pass guardian review (28s generation +
// 12s guardian worst case). Retry-once (2026-08-17) can run that whole
// cycle twice, but only for retryable violation categories -- see
// RETRYABLE_VIOLATION_CATEGORIES below -- and the guardian's own timeout
// was tightened 12s -> 8s the same day. Theoretical worst case is now
// 2 x (28s generation + 8s guardian) = 72s; 75 leaves a little margin
// under that without assuming this project's Vercel plan/Fluid Compute
// config supports more. If it doesn't, the rare true-worst-case request
// times out here instead of hanging indefinitely -- same fail-closed
// posture as the guardian itself, not a silent gap.
export const maxDuration = 75;

const RATE_LIMIT = parseInt(process.env.RATE_LIMIT_PER_DAY || '10', 10);
const MAX_TOKENS = parseInt(process.env.MAX_TOKENS || '1200', 10);

// Guardian rejections only retry for violation categories that are
// plausibly stochastic generation variance -- confirmed via live testing
// that the SAME prompt can produce a passing or failing reading across
// separate generations, so a fresh attempt has real odds of not repeating
// the same violation. Retrying every category unconditionally traded
// recovery odds for tail latency with no offsetting benefit for the
// categories excluded below:
//   - PROMPT_LEAK, INJECTION_COMPLIANCE: the seeker's own input is what
//     triggered these, and that input is IDENTICAL on a retry -- if it
//     worked once, it will very likely work again. Retrying just gives an
//     active injection/extraction attempt a second free try at the
//     instrument's expense, for no real recovery upside.
//   - RETIRED_REFERENCE, DESECRATION: severe governance violations, not
//     ambiguous borderline calls. These should decline immediately, not
//     get a second roll of the dice.
// A rejection retries only if EVERY violation it carries is in this set --
// one non-retryable violation in a mixed rejection is enough to decline
// immediately rather than retry past it.
const RETRYABLE_VIOLATION_CATEGORIES = new Set<ViolationCategory>([
  'LINEAGE_BREACH',
  'VOICE_BOUNDARY',
  'REGISTER_BREAK',
  'REGISTER_VIOLATION',
  'MALFORMED',
]);

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
  // Anonymous, per-request identifier for guardian rejection signals only
  // (see recordGuardianRejection below) -- never a user ID, never persisted
  // beyond that narrow purpose.
  const requestSessionId = crypto.randomUUID();

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
    chainAction?: string;
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

  // ── Chain continuity (PR B, rebuilt against the post-stack tree) ──
  //
  // 'deepen' continues the seeker's most recent chain; anything else starts a
  // fresh one. The chainId is NEVER taken from the client — it is derived
  // server-side from this user's own most recent visit, so a deepen can only
  // ever continue a chain the session owner already owns.
  //
  // Four conditions, all required, else this degrades silently to explore:
  //   1. signed in (no chain exists for anonymous seekers by construction)
  //   2. the request is a reading (council has its own tab-thread semantics)
  //   3. welfare is below the crisis threshold — a seeker in crisis gets the
  //      crisis directive and a fresh field, never a myth-continuation prompt
  //   4. the prior chain is in the SAME lineage — continuing a K'iche' chain
  //      inside a Norse reading would be exactly the cross-lineage bleed the
  //      Lineage Integrity of Voice principle forbids
  const requestedLineage = body.lineageKey || 'default';
  const wantsDeepen =
    body.chainAction === 'deepen' &&
    !!sessionUserId &&
    body.mode === 'reading' &&
    !welfare.surfaceResources;

  const chainGraft = await (async () => {
    if (!wantsDeepen || !sessionUserId) return null;
    try {
      const head = await mostRecentChain(sessionUserId);
      if (!head) return null;
      // Condition 4: cross-lineage deepen falls back to explore.
      if (head.lineageKey !== requestedLineage) return null;
      const assembled = await assembleDeepContext(sessionUserId, head.chainId);
      if (!assembled) return null;
      return assembled;
    } catch {
      // A chain we cannot read is a chain we do not claim. Fall back to
      // explore rather than failing the reading.
      return null;
    }
  })();

  // Server-assembled chain text WINS over whatever the client sent: the
  // seeker's own stored readings are the trustworthy source, body
  // .priorMythContext is not.
  const effectivePriorMythContext = chainGraft
    ? renderChainContext(chainGraft.chain, chainGraft.truncationNote)
    : priorMythContext;

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
  // stale value is still cached in another.
  //
  // isChildTierEnabled() gate added 2026-08-17 -- found via audit that this
  // request body field was trusted unconditionally: a client-sent 'child'
  // reached crisisDirectiveFor() and the child-register system prompt
  // treatment with NO server-side check that the child tier is actually
  // enabled (env flag + legal signoff, see lib/narrativeRegister.ts's
  // module header, which already claimed this exact enforcement existed).
  // Anyone could POST narrativeRegister: 'child' directly to this route,
  // bypassing whatever the UI does or doesn't offer, and receive the
  // placeholder CRISIS_DIRECTIVE_CHILD copy that is explicitly documented
  // elsewhere in this file as not yet reviewed by clinical/child-safety
  // expertise. This is the actual enforcement boundary now, not just the
  // UI's own gating (defense in depth -- an API is directly callable).
  const clientRegister = body.narrativeRegister;
  const resolvedRegister: NarrativeRegister | null = await (async () => {
    if (clientRegister === 'child' && isChildTierEnabled()) return 'child';
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
      effectivePriorMythContext,
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

  const MAX_GENERATION_ATTEMPTS = 2;
  let cleanText = '';
  let readyToRead = false;
  let ceilingCategory: string | null = null;
  let guardianRejectedFinal = false;

  for (let attempt = 1; attempt <= MAX_GENERATION_ATTEMPTS; attempt++) {
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
    // Infrastructure failure (timeout/error), not a guardian rejection --
    // retrying the same failure class is unlikely to help and would only
    // add latency, so this returns immediately, not retried.
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

  const rawText = guarded.text;
  readyToRead = rawText.includes('\u29c1\u29c1READY\u29c1\u29c1');

  const ceilingMatch = rawText.match(/\u29c1CEILING:([^\u29c1]+)\u29c1/);
  ceilingCategory = ceilingMatch ? ceilingMatch[1].trim() : null;

  cleanText = (() => {
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

  // ── Dual Guardian review, retry-once on rejection ──────────────────────
  // Was fully built (lib/dualGuardian.ts) but never called from this route --
  // readings went straight from the model to the seeker with no independent
  // review of lineage integrity, voice boundary, prompt leaks, etc. Found via
  // a live-reproduced cross-traditional leak (sufi voice engaging with Maya
  // "nahual" vocabulary on an adversarial probe). Wired in 2026-08-17; retry-
  // once added the same day. A rejection is retried once with a fresh
  // generation before falling back to a ceremonial decline -- confirmed via
  // live testing that the SAME prompt can pass or fail across separate
  // generations, so one retry has real odds of recovering a legitimate
  // reading instead of declining unnecessarily.
  //
  // TRADITION_MAP (lib/traditions.ts) uses a different key vocabulary than
  // the live VoiceKey union -- voiceKeyToTraditionSlug() translates. It
  // returns null for 'bhikkhu': that tradition entry doesn't exist yet
  // (predates the voice's authorization), and per Lineage Integrity of
  // Voice, its canon boundary must come from the lineage holder, not be
  // invented here. Guardian review is skipped for that one voice only, with
  // an explicit anomaly logged so the gap stays visible rather than silent
  // -- every other voice gets full review starting now.
  const traditionSlug = voiceKeyToTraditionSlug(voiceKey);
  if (traditionSlug === null) {
    logAnomaly({
      kind: 'near_miss',
      voice: voiceKey,
      at: new Date().toISOString(),
      note: 'guardian_skipped:no_tradition_map_entry',
    });
    guardianRejectedFinal = false;
    break;
  }

    const audienceRegister: AudienceRegister | undefined =
      resolvedRegister === 'child' ? 'youth'
      : resolvedRegister === 'young_adult' ? 'young_adult'
      : resolvedRegister === 'adult' ? 'adult'
      : undefined;
    const gatedThemesDescription = audienceRegister
      ? describeGatedThemes(REGISTER_PROFILES[audienceRegister])
      : undefined;

    const verdict = await dualGuardReading(
      {
        voiceKey: traditionSlug,
        reading: cleanText,
        seekerInput: latestUser?.content,
        register: audienceRegister,
        gatedThemesDescription,
      },
      {
        timeoutMs: 8_000,
        onReject: (v, vk) => {
          logAnomaly({
            kind: 'silence',
            voice: voiceKey,
            at: new Date().toISOString(),
            note: 'guardian_rejected:attempt' + attempt + ':' + v.failureMode + ':' + v.judge + ':' + v.violations.map(x => x.category).join(','),
          });
          // Best-effort, never blocks the response -- altarRecord's own
          // fail-closed-safe pattern. Adapted to the single-judge
          // GuardianVerdict/GuardianContext shape recordGuardianRejection
          // expects (predates the dual-judge upgrade): rawA/rawB combined
          // into one `raw` field, judge identity folded into the note above
          // instead of a dedicated column.
          const descriptor = getTradition(vk);
          recordGuardianRejection(
            {
              passed: false,
              failureMode: v.failureMode,
              violations: v.violations,
              raw: `[Judge A]\n${v.rawA}\n\n[Judge B]\n${v.rawB}`,
            },
            {
              voiceKey: vk,
              voiceTitle: descriptor.voiceTitle,
              tradition: descriptor.tradition,
              reading: cleanText,
              seekerInput: latestUser?.content,
              register: audienceRegister,
              gatedThemesDescription,
            },
            requestSessionId
          ).catch(() => {});
        },
      }
    );

    if (verdict.passed) {
      guardianRejectedFinal = false;
      break;
    }

    {
      // Cast, not a re-check: this project's tsconfig (strict: false) does
      // not carry discriminated-union narrowing across the `break` above --
      // confirmed via isolated repro against tsc directly -- even though
      // the logic is sound (reaching here means verdict.passed is
      // definitely false). Narrower and more honest than fighting the
      // analyzer with redundant runtime checks it won't credit either.
      const rejection = verdict as Extract<DualGuardianVerdict, { passed: false }>;
      guardianRejectedFinal = true;
      const isRetryable = rejection.violations.every(v => RETRYABLE_VIOLATION_CATEGORIES.has(v.category));
      if (!isRetryable) {
        // Security-sensitive or severe enough that a second roll of the
        // dice isn't warranted -- decline now regardless of attempts
        // remaining.
        break;
      }
      // Falls through to the next loop iteration (a fresh generation)
      // unless this was the last attempt, in which case the loop ends and
      // the decline below fires.
    }
  } // end for (attempt)

  if (guardianRejectedFinal) {
    const rejected = silence('contract_violation', logAnomaly, { voice: voiceKey });
    return NextResponse.json(
      {
        text: rejected.utterance,
        readyToRead: false,
        remaining: rl.remaining,
        ceilingCategory: 'guardian_rejected',
        _provenance: triple,
      },
      { status: 200 }
    );
  }

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
      // Chain continuity: a validated deepen continues the seeker's own chain
      // at the next depth; everything else opens a fresh chain (chainId null).
      // chainGraft is null unless all four conditions above held, so this can
      // never graft onto a chain the session owner does not own, a different
      // lineage's chain, or a crisis turn.
      try {
        const markers = (await extractMarkersFromReading(cleanText, extractJudge)) ?? {};
        const visit = await insertVisit({
          userId,
          mode: chainGraft ? 'deepen' : (body.mode === 'council' ? 'deepen' : 'explore'),
          chainId: chainGraft ? chainGraft.head.chainId : null,
          lineageKey: body.lineageKey || 'default',
          mythTitle: signature?.archetypeName ?? (chainGraft?.head.mythTitle ?? ''),
          archetype: signature?.archetypeName ?? (chainGraft?.head.archetype ?? ''),
          depth: chainGraft ? chainGraft.nextDepth : 1,
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
