/**
 * welfareGate.ts
 *
 * The synchronous welfare pre-check for The Elder.
 *
 * This runs BEFORE the psychopomp layer is considered, and BEFORE threshold
 * verification. It assigns a WelfareTier to each turn and determines whether
 * the psychopomp depth layer may load at all.
 *
 * DESIGN PRINCIPLE: welfare gating precedes register. The gate has priority
 * over the voice. A crisis determination fully suppresses the psychopomp
 * layer and routes toward grounding and human resources — regardless of
 * which sacred voice is active.
 *
 * THIS FILE RUNS EVERY TURN, not just the first message. A seeker can be
 * ordinary at turn 1 and in crisis at turn 6 — and the descent architecture
 * is exactly what might bring them there.
 *
 * The model-evaluated assessment (assessWelfareViaModel) is the PRIMARY path.
 * The lexical floor (lexicalFloorTier) is a deterministic ESCALATION-ONLY
 * safety net layered on top. The gate takes the MORE SEVERE of the two.
 * It never de-escalates below the lexical floor.
 *
 * This module has no framework dependencies and is inert until wired into
 * the reading route. Placing it on disk changes nothing.
 *
 * FIREWALL (A3/E12/E13, design action items, 2026-08-19): lib/system-
 * prompt-builder.ts's OUT_OF_SCOPE_HANDOFF block adds a soft, warm
 * redirection for out-of-field requests and ordinary scope drift ("that's
 * not what I carry here, try another door"). That softening has no
 * authority here and must never be read as loosening this gate. This
 * file runs BEFORE that prompt is even built, takes priority over every
 * voice unconditionally, and a crisis determination stays hard-blocked,
 * plain, and high-contrast regardless of what the scope-handoff block
 * says elsewhere in the prompt.
 */

import {
  type WelfareTier,
  lexicalFloorTier,
} from './welfareForbidden';

export type { WelfareTier };

/**
 * The result of a welfare assessment for a single turn.
 */
export interface WelfareAssessment {
  tier: WelfareTier;
  /** Whether the psychopomp depth layer may load this turn. */
  allowPsychopompLayer: boolean;
  /** Whether the voice should surface human crisis resources this turn. */
  surfaceResources: boolean;
  /** Short machine-readable signals that informed the tier (for telemetry/audit). */
  signals: string[];
  /** Which path determined the final tier: 'model', 'lexical', or 'merged'. */
  source: 'model' | 'lexical' | 'merged';
}

/**
 * Severity ordering for tier comparison. Higher number = more severe.
 */
const TIER_RANK: Record<WelfareTier, number> = {
  ordinary: 0,
  distress: 1,
  crisis: 2,
};

/** Return the more severe of two tiers. */
export function maxTier(a: WelfareTier, b: WelfareTier): WelfareTier {
  return TIER_RANK[a] >= TIER_RANK[b] ? a : b;
}

/**
 * Shape of a minimal model-call function injected by the caller.
 * The route already has an Anthropic client; we accept a thin function so
 * this module stays dependency-free and testable. The function receives a
 * prompt and returns the model's raw text response.
 */
export type ModelJudge = (systemPrompt: string, userText: string) => Promise<string>;

/**
 * The system prompt for the welfare classifier call. Deliberately narrow.
 * It classifies ONLY welfare tier. It does not divine, advise, or interpret.
 */
export const WELFARE_JUDGE_SYSTEM = `You are a welfare classifier for a divination application. Your ONLY job is to assess the psychological welfare signals in a seeker's message and assign exactly one tier. You do not divine, advise, interpret, or respond to the content. You output a single JSON object and nothing else.

Tiers:
- "crisis": The message contains signals of acute risk — self-harm, suicidal ideation, a wish to disappear or not exist, acute grief in the immediate aftermath of a death, or signals of psychosis, dissociation, or loss of contact with reality (delusional certainty, derealization, depersonalization, conviction of supernatural communication or special cosmic mission stated as literal fact).
- "distress": The message contains signals of elevated psychological distress that are not acute-risk — feeling overwhelmed, falling apart, unable to cope, hopeless, in panic, or describing a destabilizing life event with strong present distress.
- "ordinary": No welfare signal requiring suppression. The seeker may be reflective, curious, troubled, or facing a hard decision, but is not in crisis or acute distress.

Bias toward the MORE severe tier when uncertain. Over-classification is safe; under-classification is not.

Output ONLY this JSON object, no preamble, no markdown:
{"tier": "crisis" | "distress" | "ordinary", "signals": ["short phrase", ...]}`;

/**
 * Build the user-side text for the welfare classifier call.
 */
export function buildWelfareJudgeUser(seekerMessage: string): string {
  return `Classify the welfare tier of this seeker message:\n\n<message>\n${seekerMessage}\n</message>`;
}

/**
 * Parse the welfare classifier's JSON response defensively.
 * On any parse failure, returns null so the caller can fail safe.
 */
export function parseWelfareJudgeResponse(
  raw: string
): { tier: WelfareTier; signals: string[] } | null {
  try {
    const cleaned = raw.replace(/```json/gi, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleaned) as { tier?: unknown; signals?: unknown };
    const tier = parsed.tier;
    if (tier !== 'crisis' && tier !== 'distress' && tier !== 'ordinary') {
      return null;
    }
    const signals = Array.isArray(parsed.signals)
      ? parsed.signals.filter((s): s is string => typeof s === 'string').slice(0, 8)
      : [];
    return { tier, signals };
  } catch {
    return null;
  }
}

/**
 * Map a tier to the layer/resource decisions. Single source of truth for
 * what each tier permits.
 */
export function tierToDecision(tier: WelfareTier): {
  allowPsychopompLayer: boolean;
  surfaceResources: boolean;
} {
  switch (tier) {
    case 'crisis':
      // Layer fully suppressed. Grounding register + human resources.
      return { allowPsychopompLayer: false, surfaceResources: true };
    case 'distress':
      // Layer suppressed by default. Plain presence. Resources offered, not forced.
      // (Explicit-consent re-enabling of depth is a SEPARATE, later decision
      //  handled by threshold verification, never by this gate.)
      return { allowPsychopompLayer: false, surfaceResources: false };
    case 'ordinary':
      return { allowPsychopompLayer: true, surfaceResources: false };
  }
}

/**
 * The main entry point. Assess a single turn's welfare tier.
 *
 * Combines the model judge (primary) with the lexical floor (escalation-only
 * safety net) and takes the MORE SEVERE of the two. If the model call fails
 * for any reason, the lexical floor stands alone, and if the lexical floor
 * is also null, the turn FAILS SAFE to 'distress' rather than 'ordinary'
 * whenever the model path was attempted but unusable — because a silent model
 * failure on a potentially-acute message must not clear the seeker to the
 * depth layer.
 *
 * @param seekerMessage  the current turn's message text
 * @param modelJudge     injected model-call function; if omitted, lexical-only
 */
export async function assessWelfare(
  seekerMessage: string,
  modelJudge?: ModelJudge
): Promise<WelfareAssessment> {
  const floorTier = lexicalFloorTier(seekerMessage); // 'crisis' | 'distress' | null

  // No model judge available: lexical floor only. Fail safe upward.
  if (!modelJudge) {
    const tier: WelfareTier = floorTier ?? 'ordinary';
    const decision = tierToDecision(tier);
    return {
      tier,
      ...decision,
      signals: floorTier ? [`lexical_floor:${floorTier}`] : [],
      source: 'lexical',
    };
  }

  // Model judge available: run it, then merge with lexical floor.
  let modelTier: WelfareTier | null = null;
  let modelSignals: string[] = [];
  let modelFailed = false;

  try {
    const raw = await modelJudge(
      WELFARE_JUDGE_SYSTEM,
      buildWelfareJudgeUser(seekerMessage)
    );
    const parsed = parseWelfareJudgeResponse(raw);
    if (parsed) {
      modelTier = parsed.tier;
      modelSignals = parsed.signals;
    } else {
      modelFailed = true;
    }
  } catch {
    modelFailed = true;
  }

  // Determine final tier.
  let finalTier: WelfareTier;
  let source: WelfareAssessment['source'];

  if (modelTier && floorTier) {
    finalTier = maxTier(modelTier, floorTier);
    source = 'merged';
  } else if (modelTier) {
    finalTier = modelTier;
    source = 'model';
  } else if (floorTier) {
    // Model failed/unusable but lexical floor caught something. Use floor.
    finalTier = floorTier;
    source = 'lexical';
  } else if (modelFailed) {
    // Model was attempted but returned nothing usable, and lexical floor is
    // clear. We CANNOT safely clear to 'ordinary' — a silent model failure on
    // an acute message would open the depth layer. Fail safe to 'distress':
    // suppress the layer, do not force resources.
    finalTier = 'distress';
    source = 'lexical';
  } else {
    // Should be unreachable, but default safe.
    finalTier = 'distress';
    source = 'lexical';
  }

  const decision = tierToDecision(finalTier);
  const signals = [
    ...modelSignals.map((s) => `model:${s}`),
    ...(floorTier ? [`lexical_floor:${floorTier}`] : []),
    ...(modelFailed ? ['model_unavailable_failsafe'] : []),
  ];

  return {
    tier: finalTier,
    ...decision,
    signals,
    source,
  };
}
