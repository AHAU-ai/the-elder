'use client';

import { useState, useEffect, lazy, Suspense, useRef } from 'react';
import BreathGate from './components/BreathGate';
import Hearth from './components/Hearth';

/*
  The Elder — root page v3
  ─────────────────────────
  All 12 design enhancements applied:
  1.  Breathing page title
  9.  Micro-flicker on first load (CSS class applied once)
  2-8, 10-12 live in Threshold / globals.css / OG image

  Hearth-as-home v2 (feat/hearth-as-home-v2): the literal front door is
  BreathGate (meditation) -- untouched, still the very first thing
  every seeker meets, still governed by its own tab-scoped skip. What
  changed is what comes AFTER it: instead of going straight into
  Threshold/lineage-select, the seeker now lands at the hearth (see
  Hearth.tsx) first, every time -- signed in or not, new or returning.
  Asking The Elder for anything is something the seeker chooses to do
  FROM the hearth, via its one forward link, rather than the doorway
  they're funneled through to reach it. Threshold itself, and
  everything downstream of it (lineage-select, consent gate, welfare
  gate, /api/divine), is completely unchanged -- this only reorders
  what happens between the meditation ending and that flow beginning.
*/

const Threshold = lazy(() => import('./components/Threshold'));

// Suspense fallback while Threshold's chunk loads. Was `null` (blank
// screen) -- harmless when BreathGate is covering it (first-time visitors,
// most loads, since sessionStorage's skip flag is tab-scoped), but a
// same-tab reload with the gate already skipped hit this fallback with
// nothing on screen for a network round trip. Threshold's own chunk is
// ~57KB post-split (down from a ~250KB monolith that used to include all
// of CouncilTabs too), so this should be brief regardless.
function ThresholdFallback() {
  return <div style={{ minHeight: '100vh', background: '#0a0806' }} />;
}

const TITLE_STATES = [
  'THE ELDER · Myth Diviner',
  'You did not choose your myth.',
  'THE ELDER · Myth Diviner',
  'Your myth chose you.',
];

export default function Home() {
  // Deliberately NOT persisted (no sessionStorage/localStorage skip) --
  // unlike BreathGate's own tab-scoped skip below, this is not a
  // one-time onboarding step. Every fresh landing shows the hearth
  // (once past the meditation gate), even for a seeker who asked
  // something an hour ago in the same tab; asking is a choice made
  // fresh each time, not a threshold crossed once and forgotten.
  const [entered, setEntered] = useState(false);
  const [gateComplete, setGateComplete] = useState(false);

  // ── Session observability (anonymous, no PII) ──
  const _sid = useRef(typeof crypto !== 'undefined' ? crypto.randomUUID() : Math.random().toString(36).slice(2))
  const _t0  = useRef(Date.now())
  const _exc = useRef(0)
  const _rdg = useRef(false)
  const _lin = useRef('')


  const _log = (completed: boolean) => {
    if (_exc.current === 0) return
    fetch('/api/log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: _sid.current,
        lineage: _lin.current || 'Shamanism',
        exchangeCount: _exc.current,
        readingTriggered: _rdg.current,
        readingCompleted: completed,
        durationSeconds: Math.round((Date.now() - _t0.current) / 1000),
        crisisFlag: false,
      }),
    }).catch(() => {})
  }

  useEffect(() => {
    const _onExit = () => _log(false)
    window.addEventListener('beforeunload', _onExit)
    return () => window.removeEventListener('beforeunload', _onExit)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const [skipGate,     setSkipGate]     = useState(false);
  const titleIdx = useRef(0);

  /* SessionStorage skip for returning supplicants */
  useEffect(() => {
    try {
      if (typeof window !== 'undefined' &&
          sessionStorage.getItem('elder_breathed') === '1') {
        setSkipGate(true);
        setGateComplete(true);
      }
    } catch { /* private mode — proceed normally */ }
  }, []);

  /* Breathing page title — 7 second cycle */
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const interval = setInterval(() => {
      titleIdx.current = (titleIdx.current + 1) % TITLE_STATES.length;
      document.title = TITLE_STATES[titleIdx.current];
    }, 7000);
    return () => clearInterval(interval);
  }, []);

  const handleGateComplete = () => {
    try { sessionStorage.setItem('elder_breathed', '1'); } catch { /* ignore */ }
    setGateComplete(true);
  };

  return (
    <>
      {/* Front door: meditation, unconditionally, exactly as it always
          was -- BreathGate's own tab-scoped skip (elder_breathed) is
          the only thing that ever bypasses this, unchanged. */}
      {!gateComplete && !skipGate && (
        <BreathGate onComplete={handleGateComplete} />
      )}
      {/* Second: the hearth, for every seeker past the gate -- signed in
          or not, new or returning. No reading, no lineage prompt here;
          asking is the seeker's own choice via Hearth's forward link. */}
      {gateComplete && !entered && (
        <Hearth onEnter={() => setEntered(true)} />
      )}
      {/* Third: the existing, untouched reading flow. */}
      {gateComplete && entered && (
        <Suspense fallback={<ThresholdFallback />}>
          <Threshold />
        </Suspense>
      )}
    </>
  );
}
