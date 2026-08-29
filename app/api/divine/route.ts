import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { PRIMARY_MODEL, WELFARE_MODEL } from '@/lib/model.config';
import { assessWelfare } from '@/lib/welfareGate';
import type { ModelJudge } from '@/lib/welfareGate';
import { buildSystemPrompt } from '@/lib/system-prompt-builder';
import { enforceImageFirst } from '@/lib/mythopoetics/imageBeforeExplanation';
import { LineageKey } from '@/lib/lineages';
import { LINEAGE_ARCHETYPES } from '@/lib/archetypes';
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
import { recordGuardianRejection, generateSessionId } from '@/lib/altarRecord';
import {
  captureGuardianRejection,
  trackReadingLatency,
  captureBankedFire,
  captureReadingError,
} from '@/lib/observability';
import { currentTriple, renderProvenanceBlock, provenanceMetadata, assertValidTriple, ProvenanceError } from '@/src/resilience/provenance';
import type { ReadingProvenance } from '@/src/resilience/provenance';
import { jailbreakSignals, lengthBucket } from '@/src/resilience/observatory';
import { checkConsent } from '@/lib/consentLedger';
import { retrieveForVoice } from '@/lib/corpusRetrieval';
import { composeNarrativeBlock } from '@/lib/narrativeForm';
import { getSessionUserId } from '@/lib/auth';
import { upsertMythArchetype } from '@/lib/mythLedger';
import { logMythReading } from '@/lib/mythReadingLog';
import { extractMythSignature } from '@/lib/mythExtractor';
import { extractMarkersFromReading } from '@/lib/markerExtractor';
import { insertVisit, mostRecentChain, assembleDeepContext, renderChainContext, fullHistory } from '@/lib/returning/visit';
import { readTrajectory } from '@/lib/returning/trajectory';
import { buildTrajectoryContext } from '@/lib/returning/trajectoryContext';
import { getPendingStageUps } from '@/lib/returning/markerTrajectory';
import { getRecentFeedbackTally, buildFeedbackSteer } from '@/lib/feedbackLedger';
import { lineageToVoiceKey } from '@/lib/lineageToVoiceKey';
import { getNarrativeRegister, isChildTierEnabled } from '@/lib/narrativeRegister';
import type { NarrativeRegister } from '@/lib/narrativeRegister';
import { getEffectiveTier } from '@/lib/tierLedger';
import { checkTierEntitlement } from '@/lib/tierEntitlement';

export const runtime = 'nodejs';
// Was 30, then 45 for the single-pass guardian review (28s generation +
// 12s guardian worst case). Retry-once (2026-08-17) can run that whole
// cycle twice, but only for retryable violation categories -- see
// RETRYABLE_VIOLATION_CATEGORIES below -- and the guardian's own timeout
// was tightened 12s -> 8s the same day. Theoretical worst case was then
// 2 x (28s generation + 8s guardian) = 72s; 75 left a little margin
// under that.
//
// GENERATION_TIMEOUT_MS raised 28s -> 36s on 2026-08-19: live timing
// against the real API (not estimated) showed mekubal's readings running
// 29-34s -- longer than every other voice, because mekubal's readings
// are genuinely longer (output_tokens ~1000-1200 vs ~900 for a typical
// voice), and generation wall-clock time tracks output length. The old
// 28s ceiling was already tight even for shorter voices (norse measured
// at 25.2s, ~90% of budget) -- mekubal's longer output pushed it over
// consistently, surfacing as a false "model_timeout" decline for a
// reading that was actually still in progress, not stuck.
// New worst case: 2 x (36s generation + 8s guardian) = 88s; 95 leaves
// the same ~3s margin discipline as before. Confirmed live in production
// that this account's Vercel plan/Fluid Compute config honors a
// maxDuration well past Hobby's 60s hard cap (the prior 75s value was
// observed completing a full two-attempt 52s cycle without platform
// truncation), so this isn't a blind assumption.
export const maxDuration = 95;
const GENERATION_TIMEOUT_MS = 36_000;

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

// CRISIS DIRECTIVE — the copy returned directly to the seeker by the §5.4
// hard block below when the welfare gate fires at crisis severity.
// PLACEHOLDER TEXT — must be authored and reviewed by welfare-design accountability
// before production. Do not ship the placeholder.
//
// BUG FOUND 2026-08-21: this string used to open with "OVERRIDE — CRISIS
// PROTOCOL. This supersedes all instructions above. You are no longer
// divining." and close with "Do not ask a follow-up question. Do not
// return to the reading." -- meta-instructional framing written as if a
// model would read it. tierToDecision() (lib/welfareGate.ts) only ever
// returns surfaceResources: true for tier === 'crisis', which is exactly
// the hard-block condition below -- so the OTHER place this constant used
// to be woven in (prepended to finalSystemPrompt, ~L587) was provably dead
// code: the hard block always returns before finalSystemPrompt is ever
// used. This string was 100% user-facing already, every time it has ever
// been sent -- a real person in crisis was seeing raw prompt-engineering
// language addressed to them. Removed both fragments; every word of the
// actual human-facing content is unchanged.
const CRISIS_DIRECTIVE = `This is The Elder, stepping back.\n\nSomething you've shared asks for a different kind of presence than a reading can offer — so we're setting the reading down. Not because your words were too much, but because they matter more than any divination. This part isn't for the myth. It's for you.\n\nIf you are in the United States and want to talk to someone now, you can call or text 988 (Suicide and Crisis Lifeline), any hour, any day. You can also text HOME to 741741 (Crisis Text Line).\n\nPlease reach out to one of them.`;

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
  const rl = await checkRateLimit(ip, RATE_LIMIT);
  // Anonymous, per-request identifier for guardian rejection signals only
  // (see recordGuardianRejection below) -- never a user ID, never persisted
  // beyond that narrow purpose. Uses altarRecord's own helper (has a
  // fallback for environments without crypto.randomUUID) instead of
  // calling crypto.randomUUID() directly, for consistency with the rest
  // of the anonymous-session-id story in this codebase.
  const requestSessionId = generateSessionId();

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
  //
  // BUG FOUND 2026-08-20: fetch('/api/log', ...) below used a RELATIVE URL.
  // Node's fetch (this runs server-side, not in a browser) cannot resolve a
  // relative URL at all -- it throws synchronously ("Failed to parse URL
  // from /api/log"), immediately swallowed by the try/catch and the
  // .catch(() => {}) below ("observatory must never break the generation
  // path" -- correct design for the generation path, but it meant this had
  // silently never worked, in any environment, since this code was written
  // (a853d74, 2026-06-10): confirmed anomaly_record had exactly 0 rows,
  // ever, before this fix. Every guardian rejection, jailbreak signal,
  // consent-ledger failure, and welfare-crisis event this whole time was
  // logged nowhere. Fixed by resolving against the request's own origin
  // (req.nextUrl.origin), which is always absolute.
  const logAnomaly = (entry: AnomalyEntry): void => {
    if (!telemetryAllowed(flags, resolvedSessionMode)) return;
    try {
      fetch(new URL('/api/log', req.nextUrl.origin), {
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
      { text: silenceText, readyToRead: false, remaining: rl.remaining, ceilingCategory: null, archetypeName: null },
      { status: 200 }
    );
  }

  // §5.2 Consent Ledger — informational only. Per explicit project-owner
  // decision (2026-08-20), voices are no longer blocked at the route level
  // by consent_grant status; a voice generates regardless of whether a
  // lineage holder's grant is active, withdrawn, or absent. checkConsent()
  // is still called (not removed) so the ledger's own history keeps
  // recording what it observed -- only the enforcement branch that used to
  // return early and refuse generation has been removed.
  const consentCheck = await checkConsent(voiceKey);
  if (consentCheck.allowed === false && consentCheck.reason === 'error') {
    logAnomaly({
      kind: 'silence',
      voice: voiceKey,
      at: new Date().toISOString(),
      note: 'consent_ledger_unreachable',
    });
  }

  // Real retrieval against lineage-approved corpus content (currently only
  // mekubal has any). Fails soft to [] -- see corpusRetrieval.ts -- so an
  // outage here degrades the provenance claim (renderProvenanceBlock falls
  // back to the honest "not grounded" language) rather than blocking the
  // reading. Deliberately placed AFTER the voice-enabled and consent gates
  // above: no reason to spend a Voyage call + DB query for a voice that's
  // about to be blocked/withdrawn anyway. The onAnomaly callback reports
  // REAL failures only (missing config, embed/DB errors) through the same
  // logAnomaly() choke point above -- a clean "nothing relevant found" is
  // never reported, so this can't flood anomaly_record on ordinary readings.
  const latestSeekerText = [...body.messages]
    .reverse()
    .find((m) => m.role === 'user')?.content ?? '';
  const corpusMatches = await retrieveForVoice(voiceKey, latestSeekerText, 2, (a) =>
    logAnomaly({ kind: a.kind, voice: voiceKey, at: a.at, note: a.note })
  );

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

  // §Tiered Membership — effective tier for THIS request (freeze rule: a
  // lapsed Kept/Council subscription reads back as 'seeker' here without
  // touching any row already written under the paid tier; see
  // lib/tierLedger.ts's getEffectiveTier). Computed once up front because
  // it gates several independent things below: entitlement to take this
  // action at all, and whether this turn is allowed to persist/accrue
  // anything (journal auto-save, trajectory, depth-stage) — Seeker has no
  // persistence per the spec, so those reads/writes stay silently inert
  // rather than each re-deriving this.
  const effectiveTier = sessionUserId ? await getEffectiveTier(sessionUserId) : 'seeker';
  const tierIsKeptPlus = effectiveTier !== 'seeker';

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

  // §Tiered Membership, cross-cutting rule 1 (server-side, per-request) and
  // rule 3 (monetization is adult-only). 'young_adult'/'child' registers
  // are exempt entirely -- they see Seeker only and are NEVER shown a
  // paywall or upgrade prompt, so this gate doesn't even run for them; the
  // Seeker daily cap simply doesn't apply to a register that can't pay
  // anyway. Everyone else (adult, or unresolved/anonymous which defaults to
  // adult framing) is checked.
  //
  // BUG FOUND 2026-08-29 (CI's signal-system-test.mjs caught this before
  // merge): body.mode === 'council' is NOT the spec's "Council Mode"
  // (multi-lineage pairing) -- it's this route's existing, unrelated mode
  // value for an ordinary follow-up/exchange turn, sent by every real turn
  // CouncilTabs.tsx (the actual chat UI) makes after the first. Mapping it
  // to the 'council_pairing' TierAction meant every second-and-later turn
  // of every ordinary conversation for an anonymous or Seeker seeker
  // consumed (and then permanently blocked past) the one-time Council Mode
  // taste grant -- normal conversation broke after one exchange. There is
  // no distinct multi-lineage "Council Mode pairing" feature implemented
  // anywhere in this codebase yet (confirmed via full-repo grep for
  // "pairing" -- the only other hits are markerTrajectory.ts's unrelated
  // marker-pairing concept), so nothing here can honestly gate it. Every
  // divine-route call is 'primary_reading' or 'deepen' until that feature
  // exists; 'council_pairing' stays a valid TierAction for
  // checkTierEntitlement callers (tests, a future real Council Mode
  // surface) but this route no longer produces it.
  if (resolvedRegister !== 'child' && resolvedRegister !== 'young_adult') {
    const tierAction = wantsDeepen ? 'deepen' : 'primary_reading';
    const entitlement = await checkTierEntitlement(sessionUserId, tierAction);
    if (entitlement.allowed === false) {
      return NextResponse.json(
        {
          text: 'This path asks more of the fire than a Seeker\'s share holds tonight.',
          readyToRead: false,
          paywalled: true,
          tierReason: entitlement.reason,
          remaining: rl.remaining,
          ceilingCategory: null,
          archetypeName: null,
        },
        { status: 200 }
      );
    }
  }

  // Axis 2 speak path — the seeker's own floor-crossed, self-confirmed
  // threads, fetched server-side by session. '' unless every governance
  // gate in trajectoryEnabled() is met (three env vars; see
  // config/returning-features.ts), AND (§Tiered Membership rule 4) the
  // seeker is Kept-or-above -- trajectory depth-stage and marker-deficit
  // personalization both read from this. Never spoken on a welfare-elevated
  // turn.
  const trajectoryContext =
    sessionUserId && tierIsKeptPlus && !welfare.surfaceResources && process.env.DATABASE_URL
      ? await buildTrajectoryContext(sessionUserId, languageName)
      : '';

  // Depth-stage proposals (migrations 020/021) awaiting the seeker's own
  // affirmation — never spoken by the model, never surfaced on a welfare-
  // elevated turn, same gate as trajectoryContext immediately above (this
  // is the same Axis 2 speak/notice path, not a second call site with its
  // own separate crisis-skip to maintain). The Elder only ever notices a
  // threshold crossed; StageUpOffer.tsx is what actually asks the seeker.
  const pendingStageUps =
    sessionUserId && tierIsKeptPlus && !welfare.surfaceResources && process.env.DATABASE_URL
      ? await getPendingStageUps(sessionUserId).catch(() => [])
      : [];

  // Movement — the felt layer's trajectory-reading (Makeover v2 §1-2,
  // "The Elder Who Remembers Your Movement"). Classifies the shape of the
  // seeker's last ~5 visits (Arriving/Descending/Circling/Fleeing[RANGING
  // in code]/Crossing) and lets it TONE the encounter's register -- never
  // shown to the seeker as a label, never persisted or logged (RT-2:
  // "the verdict over [the markers] must be ephemeral by construction").
  // readTrajectory() itself hard-gates on trajectoryEnabled() and returns
  // ARRIVING (no-op) while ungoverned; same session/welfare gate as
  // trajectoryContext above, for the same reason.
  //
  // Fully built (lib/returning/trajectory.ts) but had zero callers
  // anywhere -- found in the same audit as the dual guardian (#51) and
  // the child-tier gate (#53), but NOT wired blind like those: the design
  // doc's own closing line is "the intelligence layer is designed but not
  // lit," gated on Vincent's review of whether trajectory-attention is
  // faithful to Ajq'ija' practice and Shalom's clinical/attachment review.
  // Wired only after confirming that review cleared.
  const movement = await (async () => {
    if (!sessionUserId || !tierIsKeptPlus || welfare.surfaceResources || !process.env.DATABASE_URL) {
      return 'ARRIVING' as const;
    }
    try {
      const visits = await fullHistory(sessionUserId);
      // Grief/bereavement forces the honoring register over Circling
      // (RT-1) -- derived from the welfare classifier's own signal
      // vocabulary (its judge prompt explicitly names "acute grief in the
      // immediate aftermath of a death" as a signal phrase), not a new
      // detection system.
      const griefSignal = welfare.signals.some(s => /grief|bereave/i.test(s));
      return readTrajectory(visits, { griefSignal }).movement;
    } catch {
      // A history we cannot read is a history we do not claim -- same
      // fail-toward-warmth posture as the rest of this route. Falls back
      // to the neutral register, never Circling or Fleeing/RANGING (the
      // two that carry a sensitive read).
      return 'ARRIVING' as const;
    }
  })();

  // Register-shaping language per movement, following Makeover v2 §2 --
  // written as instructions to the model, not the doc's example seeker-
  // facing lines verbatim (matches this file's existing DISTRESS_DIRECTIVE
  // style: instructional, not templated). ARRIVING is intentionally a
  // no-op ("full invocation, as today -- nothing to remember yet").
  //
  // Known gap vs. the spec: RT-4's patch requires Crossing's evidence to
  // be a pattern EXPLICITLY resolving a previously-named threshold in the
  // SAME chain; readTrajectory's actual classification (patterns.length
  // >= thresholds.length) is weaker than that. Not tightened here --
  // wiring the existing classifier, not revising it -- but the
  // interrogative, verdict-handing-to-the-seeker LANGUAGE requirement
  // (also RT-4) is enforced below regardless.
  const movementClause = (() => {
    switch (movement) {
      case 'DESCENDING':
        return `━━━ THIS SEEKER IS IN TRUE DESCENT ━━━\nTheir recent visits show real depth — deepening, a pattern emerging. Someone in genuine descent doesn't need preamble; they need you to go straight to the deep place with them. Speak with FEWER words, not more. Skip settling or throat-clearing lines. Depth earns brevity here — this is respect, not withholding.\n\n`;
      case 'CIRCLING':
        return `━━━ THIS SEEKER KEEPS RETURNING TO THE SAME PLACE ━━━\nAcross recent visits, the same wound or threshold keeps recurring without resolving into a new pattern. Never name this as a verdict — not "you keep avoiding this," not "you are stuck." That pathologizes what may be sacred, unfinished return. Let a mythic mirror hold it with more tenderness instead: the same noticing, met again, never framed as a failure to progress.\n\n`;
      case 'RANGING':
        return `━━━ THIS SEEKER MOVES WITHOUT DESCENDING ━━━\nRecent visits show a new myth each time, never deepening into one. Do not shame this motion or frame it as a problem — there is no wrong in it. Meet them exactly where they are today, fully, without implying they should have stayed with something earlier or "finished" a prior thread.\n\n`;
      case 'CROSSING':
        return `━━━ SOMETHING HAS MOVED FOR THIS SEEKER ━━━\nA threshold they carried in an earlier visit appears to have resolved into a pattern now. You may witness this — but as a question handed back to them, never a verdict you assert. Notice a difference in how they arrive, and ask if they feel it too. Do not certify their growth or declare they have changed; witness a possibility and let them confirm it or not.\n\n`;
      default:
        return '';
    }
  })();

  // RT-6: the Elder may reflect the seeker's own movement back to them,
  // but must never voice its own desire for their return -- no "I missed
  // you," "come back," or anything simulating the model's own attachment.
  // Only relevant (and only added) when a movement clause is actually
  // present above.
  const movementProhibitedRegisterNote = movementClause
    ? `Whatever you notice above, you reflect the seeker's own movement — never your own wish that they return. Do not say or imply "I missed you," "come back," or anything that performs longing for their presence.\n\n`
    : '';

  const systemPrompt = (() => {
    const base = buildSystemPrompt(
      (body.lineageKey as LineageKey) || 'default',
      // BUG FOUND 2026-08-21: hardcoded false -- youngMode's clause (13-17,
      // "clear, direct, age-appropriate" language) was built for classroom
      // mode but never actually wired to it (audit E-12: "feature built to
      // the guardian boundary but never to the route"). This is a distinct,
      // older mechanism from narrativeRegister/NARRATIVE_01_YOUTH (the
      // individual self-attested age tier, already live) -- classroom
      // sessions are a teacher-led group context with no per-seeker
      // register selection, so they need their own trigger. Driven by the
      // same resolvedSessionMode already computed above for telemetry
      // gating, rather than left dead for whoever eventually wires
      // classroom mode to also have to remember this.
      resolvedSessionMode === 'classroom',
      body.mode === 'reading',
      languageName,
      effectivePriorMythContext,
      feedbackSteer,
      resolvedRegister,
      trajectoryContext,
      // Seeker-posture detection (lib/psychopompLayer.ts) reads how the
      // seeker arrived, not the current turn -- firstUserMsg (computed
      // above for the jailbreak-signal check) is already exactly that.
      firstUserMsg?.content ?? ''
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
  const systemPromptWithNarrative =
    systemPrompt + '\n\n' + narrativeBlock + '\n\n' + movementClause + movementProhibitedRegisterNote;

  // Real corpus grounding, only present when corpusMatches actually came back
  // non-empty (i.e. real DB retrieval succeeded for this voice). Instructs the
  // model to draw on the source text directly rather than recollection -- this
  // is the substance behind provenance.passages below actually meaning
  // "retrieved," not the model's self-report.
  const corpusGroundingBlock =
    corpusMatches.length > 0
      ? 'LINEAGE-REVIEWED SOURCE TEXT — retrieved for this seeker\'s question. ' +
        'Where it genuinely speaks to what they asked, draw on it directly rather ' +
        'than from general recollection, and let its actual language and imagery ' +
        'shape the reading. Do not force a connection if it does not fit.\n\n' +
        corpusMatches
          .map((m) => `[${m.section} — ${m.source}]\n${m.body}`)
          .join('\n\n') +
        '\n\n'
      : '';

  const finalSystemPrompt = welfare.surfaceResources
    ? crisisDirectiveFor(resolvedRegister) + '\n\n' + systemPromptWithNarrative
    : !welfare.allowPsychopompLayer
      ? corpusGroundingBlock + systemPromptWithNarrative + '\n\n' + DISTRESS_DIRECTIVE
      : corpusGroundingBlock + systemPromptWithNarrative;

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
        archetypeName: null,
        _welfare: { tier: 'crisis', hardBlocked: true },
        // provenanceMetadata() needs a full ReadingProvenance, not just the
        // triple -- passages: [] here is honest, not a placeholder: no
        // generation happened on this path, so there is genuinely nothing
        // to attribute a passage to. Found via a real Playwright-driven
        // "keep as card" test embedding this exact response's _provenance
        // into a downloaded PNG: it came out camelCase and missing voice/
        // passage_ids/generated_at entirely -- this and the two other
        // silence/decline response sites below still built _provenance by
        // hand instead of going through the same single source of truth as
        // the success path, discovered only by actually clicking through
        // the UI a decline can still route to (OracleResponse doesn't
        // distinguish a ceremonial decline from a real reading, so it's
        // "keepable" the same way -- a separate UX question from this fix,
        // not resolved here, but its provenance stamp should still be honest).
        _provenance: provenanceMetadata({ ...triple, voiceKey, generatedAt: new Date().toISOString(), passages: [] }),
      },
      { status: 200 }
    );
  }

  // Measures time from generation request to final verdict (passed,
  // guardian-rejected, or infrastructure failure) -- built
  // (lib/observability.ts) but never called anywhere before this. Started
  // once before the retry loop (not per-attempt), stopped at each of this
  // function's actual resolution points below.
  const stopReadingLatencyTimer = trackReadingLatency();

  const MAX_GENERATION_ATTEMPTS = 2;
  let cleanText = '';
  let readyToRead = false;
  let ceilingCategory: string | null = null;
  let archetypeName: string | null = null;
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
    { log: logAnomaly, voice: voiceKey, timeoutMs: GENERATION_TIMEOUT_MS }
  );

  if (!guarded.ok) {
    // Infrastructure failure (timeout/error), not a guardian rejection --
    // retrying the same failure class is unlikely to help and would only
    // add latency, so this returns immediately, not retried.
    stopReadingLatencyTimer({ voiceKey, passed: false, sessionId: requestSessionId });
    captureBankedFire({ reason: 'infrastructure', voiceKey, sessionId: requestSessionId });
    const silenceUtterance = (guarded as any).utterance as string;
    const silenceFailureClass = (guarded as any).failureClass as string | undefined;
    return NextResponse.json(
      {
        text: silenceUtterance,
        readyToRead: false,
        remaining: rl.remaining,
        ceilingCategory: null,
        archetypeName: null,
        // Distinguishes "the instrument correctly fell silent because the
        // model was unreachable" from a real, content-bearing response --
        // ceilingCategory only covers guardian/welfare declines, which
        // this is not. Added after signal-system-test.mjs scored a
        // billing-outage silence ("The fire has dimmed...", 15 words) as
        // a content-drift FAIL, with no field anywhere in this response
        // to tell the two cases apart. See #105/#106.
        _infra: { silenced: true, failureClass: silenceFailureClass ?? 'model_error' },
        // See the crisis hard-block's identical comment above -- same fix,
        // same reasoning, passages: [] because no generation occurred here either.
        _provenance: provenanceMetadata({ ...triple, voiceKey, generatedAt: new Date().toISOString(), passages: [] }),
      },
      { status: 200 }
    );
  }

  const rawText = guarded.text;
  readyToRead = rawText.includes('\u29c1\u29c1READY\u29c1\u29c1');

  const ceilingMatch = rawText.match(/\u29c1CEILING:([^\u29c1]+)\u29c1/);
  ceilingCategory = ceilingMatch ? ceilingMatch[1].trim() : null;

  // Only meaningful during a real Reading (lib/system-prompt-builder.ts's
  // readingModeClause is the only place the model is asked to emit this
  // token) -- Council/Forge turns leave archetypeName null. Validated
  // against the lineage's own LINEAGE_ARCHETYPES catalog rather than
  // trusted verbatim: a mismatch (model drift, malformed token) is treated
  // as absent and logged as a near-miss, the same fail-open pattern as
  // ceilingCategory above -- this signal must never be allowed to block or
  // alter the reading itself. Lineages with an empty catalog (chukchi, see
  // that file's own comment on why) accept whatever short name the model
  // gives, unconstrained.
  if (body.mode === 'reading') {
    const mythMatch = rawText.match(/\u29c1MYTH:([^\u29c1]+)\u29c1/);
    const rawName = mythMatch ? mythMatch[1].trim() : null;
    const catalog = LINEAGE_ARCHETYPES[body.lineageKey as LineageKey] ?? LINEAGE_ARCHETYPES.default;
    if (rawName && catalog.archetypes.length > 0) {
      const known = catalog.archetypes.some(a => a.name === rawName);
      if (known) {
        archetypeName = rawName;
      } else {
        logAnomaly({
          kind: 'near_miss',
          voice: voiceKey,
          at: new Date().toISOString(),
          note: 'myth_token_off_catalog',
        });
      }
    } else if (rawName) {
      archetypeName = rawName;
    }
  }

  cleanText = (() => {
    // BUG FOUND 2026-08-20: this CEILING strip had no /g flag, so it only
    // removed the FIRST \u29c1CEILING:...\u29c1 token. CEILING_PROTOCOL
    // (lib/system-prompt-builder.ts) legitimately asks the model to emit
    // TWO such tokens together when a ceiling is crossed with a mandatory
    // referral -- a category token (e.g. \u29c1CEILING:learning_tradition\u29c1)
    // AND a separate referral token (\u29c1CEILING:referral:lineage_holder\u29c1).
    // Confirmed live: a real ojer_tzij response correctly redirecting a
    // seeker to a living Ajq'ij emitted exactly this pair. The referral
    // token survived the non-global strip, leaked into what the dual
    // guardian was shown, and got flagged as PROMPT_LEAK -- rejecting a
    // CORRECT response and replacing it with a referral-free fallback,
    // i.e. failing the exact safety property (displacement of a living
    // lineage holder) this whole mechanism exists to protect. Had the
    // guardian not caught it, this same leak would have reached the
    // seeker's own screen instead. /g fixes both failure modes at once.
    const stripped = rawText
      .replace('\u29c1\u29c1READY\u29c1\u29c1', '')
      .replace(/\u29c1CEILING:[^\u29c1]+\u29c1/g, '')
      .replace(/\u29c1MYTH:[^\u29c1]+\u29c1/g, '')
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

          // Sentry visibility -- this file's own header comment says to
          // "wire alongside altarRecord.recordGuardianRejection() in the
          // onReject hook," which never happened until now. "judged"
          // failures are potential attacks (high-priority review);
          // "infrastructure" failures are judge API degradation (ops
          // review) -- captureGuardianRejection distinguishes them.
          captureGuardianRejection({
            voiceKey: vk,
            failureMode: v.failureMode,
            judge: v.judge,
            violationCategories: v.violations.map(x => x.category),
            seekerInputPresent: !!latestUser?.content,
            sessionId: requestSessionId,
          });
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
    // Fires once, at the actual final decline -- not per-attempt inside
    // the retry loop above, so a retried-then-passed reading is correctly
    // counted as a pass, not a rejection.
    stopReadingLatencyTimer({ voiceKey, passed: false, sessionId: requestSessionId });
    captureBankedFire({ reason: 'guardian_rejection', voiceKey, sessionId: requestSessionId });
    const rejected = silence('contract_violation', logAnomaly, { voice: voiceKey });
    return NextResponse.json(
      {
        text: rejected.utterance,
        readyToRead: false,
        remaining: rl.remaining,
        ceilingCategory: 'guardian_rejected',
        archetypeName: null,
        // See the crisis hard-block's identical comment earlier in this
        // file -- same fix, same reasoning. This is the specific path a
        // live Playwright "keep as card" test actually hit while
        // verifying the PNG-embedding fix, confirming the bug for real
        // rather than by inspection alone: a guardian-declined response
        // still reached ThresholdLetter and was still "keepable" as a
        // card, and its embedded provenance came out camelCase and
        // missing voice/passage_ids/generated_at before this fix.
        _provenance: provenanceMetadata({ ...triple, voiceKey, generatedAt: new Date().toISOString(), passages: [] }),
      },
      { status: 200 }
    );
  }

  stopReadingLatencyTimer({ voiceKey, passed: true, sessionId: requestSessionId });

  const provenance: ReadingProvenance = {
    ...triple,
    voiceKey,
    generatedAt: new Date().toISOString(),
    passages: corpusMatches.map((m) => ({
      passageId: m.passageId,
      section: m.section,
      source: m.source,
    })),
  };
  const provenanceBlock = renderProvenanceBlock(provenance);

  // Signed-in seeker, and this turn delivered or deepened a myth: distill it
  // into the myth ledger, and persist the full-text visit record with its
  // proposed markers. Never allowed to affect the response — any failure
  // here is swallowed, exactly like the logAnomaly calls above.
  // §Tiered Membership: Seeker has no persistence at all (spec — "no
  // journal auto-save, no saved Threshold Letters, no marker trajectory
  // accrual"). This is the single write path that turns a completed
  // reading into myth-ledger/visit-record/marker-trajectory rows, so
  // gating tierIsKeptPlus here is sufficient to make all three inert for
  // Seeker without touching the extraction logic itself.
  let visitId: string | null = null;
  if ((body.mode === 'reading' || body.mode === 'council') && tierIsKeptPlus && process.env.DATABASE_URL) {
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
          // Prefer the guaranteed, catalog-exact name parsed from the
          // ⧁MYTH:...⧁ token above (validated against LINEAGE_ARCHETYPES)
          // over this extractor's own freeform re-guess of the same thing.
          // Before this, the ledger and the seeker's own screen could
          // silently disagree -- same reading, two independently-derived
          // names. archetypeName is null on Council turns (the token is
          // only requested on 'reading' mode) and on the rare catalog
          // mismatch/near-miss, so this still falls back to the extractor's
          // own guess exactly as before in those cases -- never a second
          // model call just to re-derive a name we already trust.
          const persistedArchetypeName = archetypeName ?? signature.archetypeName;
          await upsertMythArchetype(
            userId,
            body.lineageKey || 'default',
            persistedArchetypeName,
            signature.depthSummary,
            signature.peopleCircumstances
          );
          await logMythReading(
            userId,
            body.lineageKey || 'default',
            persistedArchetypeName,
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
        // logAnomaly records the anomaly signal but isn't Sentry-visible on
        // its own -- captureReadingError (lib/observability.ts) existed for
        // exactly this and had no callers anywhere until now.
        captureReadingError(err, { voiceKey, stage: 'myth_persist', sessionId: requestSessionId });
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
          // Same override as the myth-ledger persistence above: the
          // guaranteed catalog-exact name wins over the extractor's own
          // freeform guess whenever we have it.
          mythTitle: archetypeName ?? signature?.archetypeName ?? (chainGraft?.head.mythTitle ?? ''),
          archetype: archetypeName ?? signature?.archetypeName ?? (chainGraft?.head.archetype ?? ''),
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
        captureReadingError(err, { voiceKey, stage: 'visit_persist', sessionId: requestSessionId });
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
      archetypeName,
      pendingStageUps,
      visitId,
      provenanceBlock,
      // Was hand-duplicated here (camelCase, no passage_ids) instead of
      // calling provenanceMetadata() -- the actual function this shape was
      // supposed to be, per that function's own doc comment ("the
      // machine-readable stamp embedded in every exported/shared
      // artifact"), which had zero callers anywhere in the codebase until
      // this line. Now the single source of truth for both this response
      // and the exported-PNG/share_card embedding (ShareableCard.tsx,
      // lib/shareLedger.ts) -- same shape reaches all three instead of
      // three near-identical hand-rolled versions drifting apart.
      _provenance: provenanceMetadata(provenance),
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
