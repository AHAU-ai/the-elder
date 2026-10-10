// lib/elderAttention.ts
//
// The Elder's presence, felt in energy and not in form. There is no avatar, no
// sigil, no new light and no new sound: presence is a single quality the whole
// room takes on -- STILLNESS. When the Elder attends, the decorative world
// withdraws and the room holds its breath. This module is the pure model; the
// client layer (app/components/ElderPresence.tsx) writes the result to the
// --elder-stillness CSS variable, and anything decorative can read it.
//
// Omnipresent: the value never drops to zero. There is always a low baseline,
// on every route, so the Elder is never "off" -- only more or less attending.
//
// Distinct from lib/usePresence.ts, which reads the SEEKER's stillness. This is
// the Elder's own, and the two are independent.

export type ElderPhase = 'arrival' | 'composing' | 'unfolding' | 'council';

/** The floor. Never zero: the presence is everywhere, always. */
export const BASELINE_STILLNESS = 0.18;

/** How fully the Elder attends in each moment (0-1, higher = stiller room). */
export const PHASE_STILLNESS: Readonly<Record<ElderPhase, number>> = {
  arrival: 0.55,   // a field gathers before a word appears
  composing: 0.9,  // fully attending: the wait is being attended to, not loaded
  unfolding: 0.7,  // held under the words as the telling comes
  council: 0.35,   // a steady, low attention that stays
};

/**
 * The room's stillness given every phase currently claiming attention. The
 * deepest claim wins (composing outranks council), and the baseline is the
 * floor when nothing is claimed.
 */
export function resolveStillness(active: readonly ElderPhase[]): number {
  let s = BASELINE_STILLNESS;
  for (const p of active) s = Math.max(s, PHASE_STILLNESS[p]);
  return s;
}

/** The phase responsible for the current stillness, or 'baseline'. */
export function dominantPhase(active: readonly ElderPhase[]): ElderPhase | 'baseline' {
  let best: ElderPhase | 'baseline' = 'baseline';
  let bestS = BASELINE_STILLNESS;
  for (const p of active) {
    if (PHASE_STILLNESS[p] > bestS) { bestS = PHASE_STILLNESS[p]; best = p; }
  }
  return best;
}

/**
 * The set of moments currently claiming the Elder's attention. Pure and
 * framework-free so the bookkeeping is testable: claim() returns a release
 * function, overlapping claims (even of the same phase) are tracked
 * independently, and onChange fires with the new stillness and dominant phase.
 */
export function createClaimSet(
  onChange: (stillness: number, phase: ElderPhase | 'baseline') => void
) {
  const claims = new Map<number, ElderPhase>();
  let nextId = 0;
  const emit = () => {
    const active = Array.from(claims.values());
    onChange(resolveStillness(active), dominantPhase(active));
  };
  return {
    claim(phase: ElderPhase): () => void {
      const id = nextId++;
      claims.set(id, phase);
      emit();
      let released = false;
      return () => {
        if (released) return; // releasing twice must not disturb other claims
        released = true;
        claims.delete(id);
        emit();
      };
    },
    /** Emit the current (baseline) state without claiming anything. */
    refresh: emit,
  };
}

/** How far ambient, decorative layers withdraw at full stillness (0.6 = down to 40%). Never to nothing. */
export const AMBIENT_WITHDRAWAL = 0.6;

/** Opacity multiplier for ambient layers: they withdraw as the Elder attends. CSS callers use the same constant. */
export function ambientOpacityFactor(stillness: number): number {
  const s = Math.min(1, Math.max(0, stillness));
  return 1 - s * AMBIENT_WITHDRAWAL;
}
