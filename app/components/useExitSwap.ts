'use client';

// app/components/useExitSwap.ts
//
// "Fade the current thing out, THEN swap to the next one." PhaseFade only
// fades a screen in, so any swap done with a bare setState is: old content
// vanishes instantly, new content fades up from nothing -- a hard cut to
// empty. This hook is the exit half, shared by every place that swaps one
// view for another on a user gesture (Threshold's phase changes,
// CouncilTabs' tab switches) so the timer/guard logic lives once.
//
// Usage: const { leaving, go } = useExitSwap(setThing);
//   - pass `leaving` to the outgoing view's <PhaseFade leaving={leaving}>
//   - call go(next) instead of setThing(next)
//
// Behaviour:
//   - go() while a swap is already in flight is ignored, so a second tap
//     mid-fade cannot queue a second navigation.
//   - under prefers-reduced-motion, transitionExitMs() is 0 and the swap is
//     immediate (no held delay, no leaving state).
//   - the pending timer is cleared on unmount.
//
// Not for swaps that already run their own timed crossing (LineageSelector's
// activation, ThresholdPause's hold) or for swaps driven by code rather than
// a gesture -- those have no outgoing gesture to fade from.

import { useCallback, useEffect, useRef, useState } from 'react';
import { transitionExitMs } from '../../lib/transitions';

export function useExitSwap<T>(commit: (next: T) => void) {
  const [leaving, setLeaving] = useState(false);
  const leavingRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  const go = useCallback((next: T) => {
    if (leavingRef.current) return;
    const ms = transitionExitMs();
    if (ms === 0) { commit(next); return; }
    leavingRef.current = true;
    setLeaving(true);
    timerRef.current = setTimeout(() => {
      leavingRef.current = false;
      timerRef.current = null;
      setLeaving(false);
      commit(next);
    }, ms);
  }, [commit]);

  return { leaving, go };
}
