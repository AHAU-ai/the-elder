'use client';

// app/components/PhaseFade.tsx
//
// The one shared "new screen/phase/tab settles into view" wrapper for
// the whole app. Extracted from Threshold.tsx (where it used to be a
// private, unexported function) during the transition-consistency
// audit, which found at least 9 different bespoke duration/easing
// pairs across the app doing this exact job, uncoordinated with each
// other. Every navigational transition should use this, not a
// one-off inline `animation:`/`transition:` style.
//
// Entrance, plus an optional exit via `leaving` (Threshold's navigateTo
// fades the outgoing screen out, then swaps phases). Not a true overlapping
// crossfade -- a genuine
// crossfade would need the call sites that swap entirely different
// JSX trees (Threshold's phase branches, CouncilTabs' tab switches) to
// restructure into a single wrapper fed by a content variable instead
// of many independent early returns, which was assessed as the
// highest-risk part of this pass and deliberately deferred. What this
// still fixes: every previously-zero-transition hard cut gets a
// consistent fade-in (and, where wired, fade-out), and BreathGate's own fade-out timing is now
// coordinated to the same shared constant instead of being an
// independent number.
//
// Deliberately NOT for ceremonial content pacing (OracleResponse's
// word reveal, ThresholdLetter's per-beat cadence) -- those are
// intentional, slow, and not "a screen changed."

import { useEffect, useState } from 'react';
import { TRANSITION_EASING, transitionMs, transitionExitMs } from '../../lib/transitions';

interface PhaseFadeProps {
  children: React.ReactNode;
  /** True while this screen is on its way out (the caller has started a
   *  navigation but has not swapped phases yet). Fades opacity to 0 over the
   *  shared exit duration and stops the screen taking clicks, so a second
   *  tap can't fire a second navigation mid-fade. */
  leaving?: boolean;
}

export function PhaseFade({ children, leaving = false }: PhaseFadeProps) {
  const [visible, setVisible] = useState(false);
  const [exitMs] = useState(() => transitionExitMs());
  const [ms] = useState(() => transitionMs()); // read once per mount -- a mid-fade duration change would look worse than a stale one

  useEffect(() => {
    const id = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(id);
  }, []);

  return (
    // Opacity only, deliberately no transform: several phases render
    // position:fixed full-bleed elements (FireAtmosphere, ThresholdPause)
    // as children, and any transform on an ancestor becomes their CSS
    // containing block, breaking their viewport-relative positioning.
    <div
      style={{
        opacity: visible && !leaving ? 1 : 0,
        transition: `opacity ${leaving ? exitMs : ms}ms ${TRANSITION_EASING}`,
        pointerEvents: leaving ? 'none' : undefined,
      }}
    >
      {children}
    </div>
  );
}
