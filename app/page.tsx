'use client';

import { useState, useEffect, lazy, Suspense, useRef } from 'react';
import BreathGate from './components/BreathGate';

/*
  The Elder — root page v3
  ─────────────────────────
  All 12 design enhancements applied:
  1.  Breathing page title
  9.  Micro-flicker on first load (CSS class applied once)
  2-8, 10-12 live in Threshold / globals.css / OG image
*/

const Threshold = lazy(() => import('./components/Threshold'));

const TITLE_STATES = [
  'THE ELDER · Myth Diviner',
  'You did not choose your myth.',
  'THE ELDER · Myth Diviner',
  'Your myth chose you.',
];

export default function Home() {
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
      {!gateComplete && !skipGate && (
        <BreathGate onComplete={handleGateComplete} />
      )}
      {gateComplete && (
        <Suspense fallback={null}>
          <Threshold />
        </Suspense>
      )}
    </>
  );
}
