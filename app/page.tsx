'use client';

import { useState, useEffect, lazy, Suspense, useRef } from 'react';
import BreathGate from './components/BreathGate';
import PortalGate from './components/PortalGate';
import { PhaseFade } from './components/PhaseFade';

/*
  The Elder — root page v3
  ─────────────────────────
  All 12 design enhancements applied:
  1.  Breathing page title
  9.  Micro-flicker on first load (CSS class applied once)
  2-8, 10-12 live in Threshold / globals.css / OG image

  The quiet hearth (formerly Hearth.tsx, /hearth, /api/hearth) has been
  removed from the app entirely -- both as a forced step in this flow
  and as its own standalone route. Meditation (BreathGate) is the
  literal, unconditional opener for every seeker, straight into
  Threshold (age-register -> lineage-select -> wisdom-quote -> council)
  exactly as it worked before any hearth work landed. See
  remove/quiet-hearth-route for the full removal.

  The portal (PortalGate) now stands in front of that, on a cold open
  only: a quiet cold room with a seam of ember light in the wall, a door
  the seeker opens with their own hand, and the crossing lands exactly where
  BreathGate's herald begins. BreathGate is untouched -- it is still the
  literal opener of the sitting proper; the portal is the doorway to it.
  See docs/portal-crossing.md.
*/

const Threshold = lazy(() => import('./components/Threshold'));

// Suspense fallback while Threshold's chunk loads. Was fully blank --
// harmless when BreathGate is covering it (first-time visitors, most
// loads, since sessionStorage's skip flag is tab-scoped), but a
// same-tab reload with the gate already skipped hit this fallback with
// nothing on screen for a network round trip. Threshold's own chunk is
// ~57KB post-split (down from a ~250KB monolith that used to include all
// of CouncilTabs too), so this should be brief regardless. Now matches
// CouncilTabsFallback's minimal-but-not-blank treatment (found during
// the transition-consistency audit to be the only other Suspense
// boundary in the flow, previously inconsistent with this one).
function ThresholdFallback() {
  return (
    <div style={{
      minHeight: 'var(--vh-full)', background: '#0a0806',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        fontFamily: "'Gentium Plus', Georgia, 'Times New Roman', serif",
        fontStyle: 'italic', fontSize: '0.95rem', color: '#a8916f', opacity: 0.6,
      }}>
        &hellip;
      </div>
    </div>
  );
}

const TITLE_STATES = [
  'THE ELDER · Myth Diviner',
  'You did not choose your myth.',
  'THE ELDER · Myth Diviner',
  'Your myth chose you.',
];

// Device-local hint only (never authority): this device last saw the member's
// standing choice to go straight in, so hold the door back until it is confirmed.
const BYPASS_HINT = 'elder_portal_bypass_hint';

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
  // The portal stays mounted a beat past the crossing (its flare fades over
  // the herald), so "portal mounted" and "breath started" are separate.
  const [portalMounted, setPortalMounted] = useState(true);
  const [breathStarted, setBreathStarted] = useState(false);
  // Signed-in members are offered a way past the door. Everyone else always
  // meets it. Unknown / failed lookup = not a member: the door shows.
  const [member, setMember] = useState(false);
  const titleIdx = useRef(0);

  // Held (nothing drawn) only while a device that last saw the member's
  // standing choice waits to learn whether it still holds, so a member who
  // has chosen to go straight in never sees the door flash up first. Capped:
  // a slow or failed lookup means the door shows.
  const [portalHeld, setPortalHeld] = useState(false);
  const startedRef = useRef(false);
  useEffect(() => {
    let live = true;
    let hinted = false;
    try { hinted = localStorage.getItem(BYPASS_HINT) === '1'; } catch { /* ignore */ }
    if (hinted) setPortalHeld(true);
    const cap = window.setTimeout(() => { if (live) setPortalHeld(false); }, 1500);
    fetch('/api/user/portal')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!live) return;
        const isMember = !!d && d.member === true;
        setMember(isMember);
        const bypass = isMember && d.bypass === true;
        try {
          if (bypass) localStorage.setItem(BYPASS_HINT, '1'); else localStorage.removeItem(BYPASS_HINT);
        } catch { /* ignore */ }
        if (bypass && !startedRef.current) {
          startedRef.current = true;
          setPortalMounted(false);
          setBreathStarted(true);
        }
      })
      .catch(() => { /* not a member as far as we can tell: the door stays */ })
      .finally(() => { window.clearTimeout(cap); if (live) setPortalHeld(false); });
    return () => { live = false; window.clearTimeout(cap); };
  }, []);

  /* Warm the Threshold chunk while the seeker is still at the door, so the
     end of the breath never lands on the Suspense fallback. Idle-time, so it
     never competes with the first paint of the cold room. */
  useEffect(() => {
    const warm = () => { void import('./components/Threshold'); };
    const w = window as Window & { requestIdleCallback?: (cb: () => void) => number };
    if (typeof w.requestIdleCallback === 'function') {
      w.requestIdleCallback(warm);
      return;
    }
    const t = setTimeout(warm, 1500);
    return () => clearTimeout(t);
  }, []);

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
      {/* The portal. Cold open only. onCross mounts the breath underneath at
          the instant the door gives way; the portal's flare then clears over
          it and onDone unmounts it. onSkip hands straight to Threshold, the
          same place BreathGate's own skip lands. */}
      {portalMounted && !portalHeld && !skipGate && !gateComplete && (
        <PortalGate
          member={member}
          onCross={() => { startedRef.current = true; setBreathStarted(true); }}
          onBypass={(remember) => {
            startedRef.current = true;
            setBreathStarted(true);
            setPortalMounted(false);
            if (remember) {
              try { localStorage.setItem(BYPASS_HINT, '1'); } catch { /* ignore */ }
              fetch('/api/user/portal', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ bypass: true }),
              }).catch(() => {});
            }
          }}
          onDone={() => setPortalMounted(false)}
          onSkip={() => { startedRef.current = true; handleGateComplete(); setPortalMounted(false); }}
        />
      )}
      {!gateComplete && !skipGate && breathStarted && (
        <BreathGate onComplete={handleGateComplete} />
      )}
      {/* Was a hard cut into Threshold with no transition at all.
          PhaseFade's entrance now coordinates with BreathGate's own
          fade-out (both on the shared TRANSITION_MS constant). */}
      {gateComplete && (
        <PhaseFade>
          <Suspense fallback={<ThresholdFallback />}>
            {/* showReception: only on a cold open. A returning supplicant
                whose breath gate was skipped this tab (skipGate) goes
                straight to the first question. */}
            <Threshold showReception={!skipGate} />
          </Suspense>
        </PhaseFade>
      )}
    </>
  );
}
