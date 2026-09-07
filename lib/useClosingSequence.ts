// lib/useClosingSequence.ts
//
// The Threshold Letter's closing has three moments, not one on/off flag:
//
//   active      — the four beats are still surfacing
//   contracting — the last beat is placed; the exhale ring is drawing in
//   settled     — the ring has finished its contraction; the ceremony has
//                 come to rest and a deliberate way out can be offered
//
// `markSettled` is meant to be driven off the ring's real transition-end
// event, not a second JS timer racing the CSS — see ThresholdLetter.tsx.
//
// Scoped to the Threshold Letter closing for now. It is the natural seed
// for a later shared `useCeremonyPhase`, but that generalization is out of
// scope here — don't widen it without the design attention that concept
// deserves.

import { useCallback, useState } from 'react';

export type ClosingPhase = 'active' | 'contracting' | 'settled';

export function useClosingSequence() {
  const [phase, setPhase] = useState<ClosingPhase>('active');

  const beginClosing = useCallback(() => {
    setPhase(p => (p === 'active' ? 'contracting' : p));
  }, []);

  const markSettled = useCallback(() => {
    setPhase('settled');
  }, []);

  return {
    phase,
    isContracting: phase === 'contracting',
    isSettled: phase === 'settled',
    beginClosing,
    markSettled,
  };
}
