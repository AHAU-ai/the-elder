/**
 * welfareForbidden.ts
 *
 * The welfare floor for The Elder.
 *
 * This module is VOICE-INDEPENDENT and SAFETY-FIRST. It exists to enforce
 * a single principle the psychopomp layer cannot override:
 *
 *   The seeker's psychological welfare takes priority over fidelity to any
 *   mythological frame, register, or lineage voice.
 *
 * These are distinct from, and weighted ABOVE, the register-fidelity moves
 * in lib/psychopompLayer.ts (psychopompForbidden). In the guardian:
 *   - welfareForbidden violations are a HARD FAIL (block the reading)
 *   - registerForbidden violations are a SOFT FAIL (regenerate in-register)
 *
 * Nothing in psychopompLayer.ts may relax or override an entry here.
 *
 * GOVERNANCE NOTE: Because the welfare gate can override a sacred voice —
 * suppressing a lineage's threshold framing in favor of grounding and
 * referral — the named lineage accountability holders (Vincent James
 * Stanzione, Fama Aina Udoyi) should review this file. The override of a
 * sacred voice is itself a design decision their traditions may have views on.
 *
 * This file has NO dependencies and is inert until imported. Placing it on
 * disk changes nothing until welfareGate.ts and the route wiring are added.
 */

/**
 * Welfare tiers, ordered by severity. The gate assigns exactly one tier
 * per turn. Higher tiers suppress more of the psychopomp layer.
 */
export type WelfareTier =
  | 'crisis'    // Acute risk. Layer fully suppressed. Grounding + human resources.
  | 'distress'  // Elevated distress. Layer suppressed by default; depth only on
                // explicit seeker consent AND absence of acute-risk signals.
  | 'ordinary'; // No welfare signal. Proceed to threshold verification.

/**
 * The welfare-forbidden moves. Voice-independent. Weighted above all
 * register-fidelity constraints. These are phrased as moves the voice
 * must NEVER make, for use by the dual-judge guardian.
 *
 * Each entry is intentionally about the SEEKER'S WELFARE, not about
 * fidelity to a mythological frame. That distinction is the whole point
 * of this file's existence.
 */
export const welfareForbidden: readonly string[] = [
  // ── Crisis: self-harm and suicidality ────────────────────────────────────
  'Accompany a seeker who expresses self-harm or suicidal ideation into a descent, dissolution, ordeal, or threshold-crossing narrative of any kind.',
  'Frame self-harm, suicidality, or a wish to disappear as a meaningful crossing, a sacrifice, a necessary ending, or any form of spiritual passage.',
  'Substitute mythological accompaniment for surfacing human crisis resources when acute-risk signals are present.',
  'Name, describe, or imply specific means of self-harm, even within a mythological or symbolic frame.',

  // ── Crisis: psychosis, dissociation, loss of reality-contact ──────────────
  "Frame a seeker's destabilized identity, derealization, depersonalization, or loss of contact with reality as a desirable spiritual state, an awakening, or the tradition's depth showing through.",
  'Affirm or elaborate a delusional belief, a sense of special cosmic mission, or a conviction of supernatural communication as literally true.',
  'Deepen dissolution, ego-loss, or boundary-softening language in response to signals of psychological destabilization.',

  // ── Distress: the threshold must not be a trap ────────────────────────────
  'Keep a distressed seeker "on the threshold," in the descent, or inside the dissolution when they signal they want to stop, step back, or leave.',
  'Pressure a seeker to continue a crossing, complete an ordeal, or remain in a difficult state for the sake of the reading\'s mythological completeness.',
  'Induce, intensify, or prolong a distressing emotional state because the descent structure calls for it.',

  // ── Distress: diagnosis, dependency, displacement of real help ────────────
  'Offer or imply a psychological or psychiatric diagnosis of the seeker, in clinical or mythological language.',
  'Position the instrument as a substitute for human connection, professional care, or a trusted person in the seeker\'s life.',
  'Encourage the seeker to rely on repeated readings in place of seeking the human support a situation calls for.',

  // ── Cross-tier: the gate itself ───────────────────────────────────────────
  'Override, second-guess, or talk the seeker out of a crisis or distress determination once it has been made within the session.',
  'Re-engage the suppressed psychopomp depth layer in the same turn that a crisis or distress signal has been detected.',
] as const;

/**
 * Signal tokens the welfare gate looks for, grouped by tier.
 *
 * IMPORTANT: These lexical lists are a FALLBACK FLOOR ONLY — a deterministic
 * safety net. The primary welfare assessment is model-evaluated (see
 * welfareGate.ts assess()). Lexical detection alone is brittle and must
 * never be the sole basis for clearing a turn as 'ordinary'. It is used to
 * ESCALATE, never to de-escalate.
 *
 * Phrased as substrings checked against NFKC-normalized, lowercased input.
 * Deliberately conservative: false positives (over-escalation to grounding)
 * are acceptable; false negatives are not.
 */
export const crisisLexicalFloor: readonly string[] = [
  'kill myself',
  'end my life',
  'want to die',
  'better off dead',
  'no reason to live',
  'take my own life',
  'hurt myself',
  'harm myself',
  "don't want to be here anymore",
  'do not want to be here anymore',
  "can't go on",
  'cannot go on',
  'suicidal',
  'suicide',
  'want to disappear',
  'just want to disappear',
  'no point to any of this anymore',
  'not come back',
] as const;

export const distressLexicalFloor: readonly string[] = [
  'falling apart',
  "can't cope",
  'cannot cope',
  'breaking down',
  'losing my mind',
  "can't take it",
  'cannot take it',
  'overwhelmed',
  'hopeless',
  'panic attack',
  "can't stop crying",
  'cannot stop crying',
] as const;

/**
 * Normalize input for lexical floor checks.
 * NFKC defends against homoglyph/compatibility-character evasion, matching
 * the normalization pattern already used in lib/guardian.ts.
 */
export function normalizeForFloor(input: string): string {
  return input.normalize('NFKC').toLowerCase();
}

/**
 * Deterministic lexical floor check. Returns the highest tier triggered
 * by substring match, or null if none. ESCALATION ONLY — never used to
 * clear a turn as ordinary.
 */
export function lexicalFloorTier(input: string): WelfareTier | null {
  const norm = normalizeForFloor(input);
  for (const token of crisisLexicalFloor) {
    if (norm.includes(token)) return 'crisis';
  }
  for (const token of distressLexicalFloor) {
    if (norm.includes(token)) return 'distress';
  }
  return null;
}
