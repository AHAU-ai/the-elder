// lib/openingBridge.ts
//
// The opening counterpart to the closing-exhale bridge. This module ships
// the TIMING mechanism plus ONE lineage-agnostic line -- the beat between
// the breath finishing and the first question of the sitting.
//
// What is explicitly NOT here, and does not get added without real
// authorization + a Shalom review (not a careful one-time wording pass):
//   - lineage-differentiated opening lines (a K'iche' greeting, a mekubal
//     greeting, ...). That is ungoverned ritual prescription, the same
//     category as the fabricated tradition-bearer authorizations already
//     caught and retracted once.
//   - instructive / imperative copy ("close your eyes", "breathe", "sit").
//     The guided breath (BreathGate) speaks in that meditation register;
//     the Elder's own voice does not. "Never instructive" is a claim that
//     has to be mechanically checked, not just true at time of writing --
//     see scripts/check-opening-register.mjs, run in the same CI step as
//     check-purpose-register.mjs.
//
// OPENING_BRIDGE_COPY is a single lineage-agnostic line under that guard.
// Flagged for Shalom review; not treated as blocking, on the same basis
// as the closing bridge -- one agnostic line, mechanically register-
// guarded, is not the thing that needs the full authorization gate.

export const OPENING_BRIDGE_COPY =
  'The breath has brought you here. The fire is in no hurry.';

// Patterns that would indicate the copy has drifted from witnessing to
// instructive, or toward flattery. Mirrors the FORBIDDEN approach in
// scripts/check-purpose-register.mjs; that script keeps its own copy of
// these and reads the source as text, so this export exists for parity
// with the closing bridge and for direct/unit use, not as the CI path.
const BANNED_PATTERNS: RegExp[] = [
  // sentence-initial bare imperative (the Elder witnesses, it does not direct)
  /^\s*(close|open|breathe|sit|stand|walk|step|feel|let|begin|come|enter|receive|give|take|say|speak|ask|choose|name|look|listen|hold|rest)\b/i,
  /\byou (must|should|need to|have to|will now)\b/i,
  // chosen-one / latent-power / higher-self flattery
  /\b(chosen|destined|rare soul|the one (it|the fire|we)(?:\s+\w+){0,3}\s+wait|higher self|special|awakening|unlock)\b/i,
];

// The line must stay anchored to the ceremony's own objects, not drift
// into generic affirmation.
const REQUIRED_ANCHOR = /\b(breath|fire|flame|ember|hearth|smoke)\b/i;

export function checkOpeningBridgeRegister(copy: string): { valid: boolean; reason?: string } {
  for (const pattern of BANNED_PATTERNS) {
    if (pattern.test(copy)) {
      return { valid: false, reason: `Banned pattern matched: ${pattern}` };
    }
  }
  if (!REQUIRED_ANCHOR.test(copy)) {
    return { valid: false, reason: 'Copy is not anchored to the fire/breath (REQUIRED_ANCHOR did not match)' };
  }
  return { valid: true };
}

/**
 * Fires `onBridge` after `holdMs`, the beat held between the opening line
 * finishing its reveal and the first question of the sitting appearing.
 * This function owns only the timing coordination -- the caller passes
 * its own hold duration; this module knows nothing about the reveal or
 * fade implementation. Mirrors scheduleClosingBridge.
 */
export function scheduleOpeningBridge(onBridge: () => void, holdMs: number): () => void {
  const timeoutId = setTimeout(onBridge, holdMs);
  return () => clearTimeout(timeoutId); // cleanup for unmount mid-hold
}
