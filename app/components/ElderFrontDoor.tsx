'use client';

// app/components/ElderFrontDoor.tsx
//
// The opening beat of the whole flow: a quiet textarea ("what do you
// ask"). Asking is the moment that lights the fire — submitting throws
// the log on: one bright flare at the base, a burst of ~34 sparks that
// fly outward/upward on randomized angles, then a handoff into the same
// line-by-line reveal the rest of the instrument uses, with the axis-
// mundi tree drawing itself up behind the words.
//
// Ported from a standalone concept (violet ground, K'iche' ceiba). This
// version is converted to the Elder's own container palette — obsidian
// ground, gold/ember strokes — per docs/fire-container-decision.md: no
// per-lineage re-skin, one fire.
//
// The ambient ember field is genuinely scattered: makeEmberField() gives
// every ember its own random position, size, drift, duration, and delay,
// so nothing sits on a modulo grid and nothing repeats visibly. The
// spark burst (makeSparkBurst) is distinct — short-lived, high energy,
// fired once per ignition, so the catch reads as a real event, not a
// loop.

import type React from 'react';
import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { suggestMarker, type MarkerType } from '../../lib/mythopoetics/cardConfig';

// ─── PALETTE (the one container — see FireAtmosphere.tsx header) ───────────────
const C = {
  obsidian: '#0a0806',
  gold:     '#d4a843',
  paleGold: '#e8c97a',
  ember:    '#c8601a',
  bone:     '#ede0c4',
  ash:      '#c4b89a',
  smoke:    '#a8916f',
};

export type FrontDoorResult = {
  question: string;
  reading: string;
  /** 'deepen' when the seeker chose "deepen this thread" rather than the
   *  plain "carry this to the fire" — the council reading should turn
   *  further into this thread, not just acknowledge it. */
  intent: 'continue' | 'deepen';
};

// The five returning-thread markers, in the canonical order used across
// the returning-arc code (lib/returning/markers.ts).
const MARKER_ORDER: MarkerType[] = ['wound', 'threshold', 'pattern', 'exile', 'figure'];

interface Props {
  /** Called once the seeker leaves the reading — carries the asked
   *  question and the reading text up so the rest of the flow can thread
   *  them into the sitting instead of asking again from scratch. */
  onContinue: (result: FrontDoorResult) => void;
  /** Lineage is not chosen yet at this point in the flow; the front-door
   *  reading is spoken in the default voice. */
  lineageKey?: string;
  narrativeRegister?: string;
  /** Signed-in seekers can keep the front-door reading as a threshold
   *  letter (the same POST /api/threshold-letters the council uses) and
   *  see their returning-thread markers. Anonymous seekers get the local
   *  keepsake acknowledgement only, same as the council. */
  signedIn?: boolean;
}

type Stage = 'idle' | 'igniting' | 'revealing' | 'error';

function randBetween(min: number, max: number) {
  return min + Math.random() * (max - min);
}

// A burst of sparks thrown up when the log catches — short-lived, high
// energy, travels outward/upward then fades. Distinct from the ambient
// ember field, which drifts slowly and continuously.
function makeSparkBurst(count: number) {
  return [...Array(count)].map((_, i) => {
    const angle = randBetween(-100, -80) + randBetween(-45, 45); // mostly upward, scattered
    const rad = (angle * Math.PI) / 180;
    const distance = randBetween(60, 220);
    return {
      id: `spark-${i}-${Math.random()}`,
      dx: Math.cos(rad) * distance,
      dy: Math.sin(rad) * distance,
      size: randBetween(1, 3.2),
      delay: randBetween(0, 0.25),
      duration: randBetween(0.7, 1.3),
      color: Math.random() > 0.3 ? C.gold : C.paleGold,
    };
  });
}

// Ambient embers: free-floating, scattered, each on its own independent
// drift loop so nothing reads as a repeating grid or pattern.
function makeEmberField(count: number) {
  return [...Array(count)].map((_, i) => ({
    id: `ember-${i}`,
    x: randBetween(4, 96),
    y: randBetween(6, 96),
    size: randBetween(0.7, 2.2),
    driftX: randBetween(-16, 16),
    driftY: randBetween(-24, -6),
    duration: randBetween(5, 11),
    delay: randBetween(0, 6),
    baseOpacity: randBetween(0.12, 0.4),
    color: Math.random() > 0.65 ? C.ember : C.gold,
  }));
}

function splitParagraphs(text: string): string[] {
  return text.split(/\n\n+/).map(s => s.trim()).filter(Boolean);
}

export default function ElderFrontDoor({ onContinue, lineageKey = 'default', narrativeRegister = 'adult', signedIn = false }: Props) {
  const [stage, setStage]       = useState<Stage>('idle');
  const [question, setQuestion] = useState('');
  const [paras, setParas]       = useState<string[]>([]);
  const [reading, setReading]   = useState('');
  const [phase, setPhase]       = useState(0);
  const [reduced, setReduced]   = useState(false);
  const [ignitionKey, setIgnitionKey] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');
  const [kept, setKept]         = useState(false);
  const [deepening, setDeepening] = useState(false);
  const [hoveredMarker, setHoveredMarker] = useState<MarkerType | null>(null);
  const [markerCounts, setMarkerCounts]   = useState<Partial<Record<MarkerType, number>>>({});
  const [activeMarker, setActiveMarker]   = useState<MarkerType | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  // reveal steps: one per paragraph, plus the closing line, plus the
  // continue action.
  const totalSteps = paras.length + 1;

  const sparks = useMemo(
    () => (stage === 'igniting' && !reduced ? makeSparkBurst(34) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ignitionKey, stage, reduced],
  );
  const embers = useMemo(() => (reduced ? [] : makeEmberField(26)), [reduced]);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mq.matches);
  }, []);

  // Returning-thread markers, drawn from the seeker's kept threshold
  // letters (each carries a confirmed marker). Only for signed-in
  // seekers; the row is hidden entirely when there is nothing real to
  // show rather than rendering placeholder dots.
  useEffect(() => {
    if (!signedIn) return;
    let cancelled = false;
    fetch('/api/threshold-letters')
      .then(r => r.json())
      .then((d: { letters?: Array<{ marker?: string | null }> }) => {
        if (cancelled || !Array.isArray(d?.letters)) return;
        const counts: Partial<Record<MarkerType, number>> = {};
        for (const l of d.letters) {
          const m = l?.marker;
          if (m && (MARKER_ORDER as string[]).includes(m)) {
            counts[m as MarkerType] = (counts[m as MarkerType] ?? 0) + 1;
          }
        }
        setMarkerCounts(counts);
        // getUserThresholdLetters returns newest-first (see RecallLetter
        // use in Threshold.tsx), so the first markered letter is the most
        // recently active thread.
        const latest = d.letters.find(l => l?.marker && (MARKER_ORDER as string[]).includes(l.marker));
        setActiveMarker((latest?.marker as MarkerType) ?? null);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [signedIn]);

  useEffect(() => () => { timers.current.forEach(clearTimeout); }, []);

  const askTheElder = useCallback(async () => {
    if (stage !== 'idle') return;
    const q = question.trim();
    if (!q) return;

    setIgnitionKey(k => k + 1);
    setStage('igniting');
    setErrorMsg('');

    const minBurn = reduced ? 0 : 1100;
    const started = Date.now();

    try {
      const res = await fetch('/api/divine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: q }],
          lineageKey,
          mode: 'reading',
          narrativeRegister,
        }),
      });
      const raw = await res.text();
      let data: { text?: string; error?: string };
      try { data = JSON.parse(raw); }
      catch { throw new Error(`The fire returned nothing legible (HTTP ${res.status}).`); }
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      const text = (data.text || '').trim();
      if (!text) throw new Error('The response contained no text.');

      const wait = Math.max(0, minBurn - (Date.now() - started));
      const t = setTimeout(() => {
        setReading(text);
        setParas(splitParagraphs(text));
        setStage('revealing');
      }, wait);
      timers.current.push(t);
    } catch (err) {
      const wait = Math.max(0, minBurn - (Date.now() - started));
      const t = setTimeout(() => {
        setErrorMsg(err instanceof Error ? err.message : 'Unknown error');
        setStage('error');
      }, wait);
      timers.current.push(t);
    }
  }, [stage, question, reduced, lineageKey, narrativeRegister]);

  // Line-by-line reveal, paced off a fixed cadence (the same shape the
  // rest of the instrument uses — see WordReveal / OracleResponse).
  useEffect(() => {
    if (stage !== 'revealing') return;
    if (reduced) { setPhase(totalSteps); return; }
    timers.current.forEach(clearTimeout);
    timers.current = [];
    for (let i = 1; i <= totalSteps; i++) {
      timers.current.push(setTimeout(() => setPhase(i), i * 1500));
    }
    return () => timers.current.forEach(clearTimeout);
  }, [stage, reduced, totalSteps]);

  const skipReveal = useCallback(() => {
    timers.current.forEach(clearTimeout);
    setPhase(totalSteps);
  }, [totalSteps]);

  // "keep this reading" — same shape as the council's keep-as-card: for a
  // signed-in seeker it POSTs a threshold letter (the server recomputes
  // the ceremonial phrases from lineageKey, so only returnGift + marker
  // are sent); anonymous seekers get the local keepsake acknowledgement
  // only. The front-door reading is default-voiced, so the letter is too.
  const keepReading = useCallback(() => {
    setKept(prev => {
      const next = !prev;
      if (next && signedIn && reading) {
        const closing = splitParagraphs(reading).slice(-1)[0] || reading;
        fetch('/api/threshold-letters', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lineageKey, returnGift: closing, marker: suggestMarker(closing) }),
        }).catch(() => {});
      }
      return next;
    });
  }, [signedIn, reading, lineageKey]);

  // "deepen this thread" — carry to the fire, but flagged so the council
  // reading turns further into this thread rather than only acknowledging
  // the front-door reading.
  const deepenThread = useCallback(() => {
    setDeepening(true);
    onContinue({ question: question.trim(), reading, intent: 'deepen' });
  }, [onContinue, question, reading]);

  const revealing = stage === 'revealing';
  const igniting  = stage === 'igniting';

  // Tree growth is tied to the reveal phase: roots first, then the trunk,
  // then the canopy opens over the last two beats.
  const rootProgress   = revealing ? Math.min(1, phase / 1) : 0;
  const trunkProgress  = revealing ? Math.min(1, Math.max(0, phase - 1) / 1) : 0;
  const canopyProgress = revealing ? Math.min(1, Math.max(0, phase - 2) / 2) : 0;

  return (
    <div
      onClick={revealing && phase < totalSteps ? skipReveal : undefined}
      style={{
        minHeight: '100vh',
        background: C.obsidian,
        color: C.bone,
        fontFamily: "'Gentium Plus', Georgia, 'Times New Roman', serif",
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '72px 24px 64px',
        cursor: revealing && phase < totalSteps ? 'pointer' : 'default',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <style>{`
        .fd-reading-line {
          opacity: 0;
          transform: translateY(10px);
          animation: fdRevealLine 0.9s cubic-bezier(0.22, 1, 0.36, 1) forwards;
        }
        @keyframes fdRevealLine { to { opacity: 1; transform: translateY(0); } }
        @keyframes fdSparkFly {
          0%   { transform: translate(0, 0) scale(1); opacity: 1; }
          70%  { opacity: 1; }
          100% { transform: translate(var(--dx), var(--dy)) scale(0.3); opacity: 0; }
        }
        @keyframes fdFlare {
          0%   { opacity: 0; transform: scale(0.6); }
          15%  { opacity: 0.9; transform: scale(1.1); }
          100% { opacity: 0; transform: scale(1.6); }
        }
        @keyframes fdEmberDrift {
          0%   { transform: translate(0, 0); opacity: var(--o); }
          50%  { transform: translate(var(--dx), var(--dy)); opacity: calc(var(--o) * 1.8); }
          100% { transform: translate(0, 0); opacity: var(--o); }
        }
        .fd-spark { animation: fdSparkFly var(--dur) ease-out var(--delay) forwards; }
        .fd-flare { animation: fdFlare 1s ease-out forwards; }
        .fd-ember { animation: fdEmberDrift var(--dur) ease-in-out var(--delay) infinite; }

        .fd-input {
          width: 100%;
          background: rgba(212,168,67,0.04);
          border: 1px solid rgba(212,168,67,0.24);
          border-radius: 2px;
          color: ${C.bone};
          font-family: 'Gentium Plus', Georgia, serif;
          font-size: 15px;
          line-height: 1.7;
          padding: 14px 16px;
          resize: none;
          outline: none;
          transition: border-color 0.25s ease;
        }
        .fd-input:focus { border-color: ${C.gold}; }
        .fd-button {
          margin-top: 16px;
          background: none;
          border: 1px solid ${C.gold};
          color: ${C.gold};
          font-family: 'Inter', Arial, sans-serif;
          font-size: 0.68rem;
          letter-spacing: 0.22em;
          text-transform: uppercase;
          padding: 11px 24px;
          border-radius: 2px;
          cursor: pointer;
          transition: background 0.25s ease, color 0.25s ease;
        }
        .fd-button:hover, .fd-button:focus-visible { background: ${C.gold}; color: ${C.obsidian}; }
        .fd-button:disabled { opacity: 0.4; cursor: default; }

        .fd-action {
          background: none; border: none; color: ${C.gold};
          font-family: 'Inter', Arial, sans-serif; font-size: 0.64rem;
          letter-spacing: 0.18em; text-transform: uppercase; cursor: pointer;
          padding: 8px 4px; border-bottom: 1px solid transparent;
          transition: border-color 0.25s ease;
        }
        .fd-action:hover, .fd-action:focus-visible { border-bottom-color: ${C.gold}; outline: none; }
        .fd-action:disabled { opacity: 0.5; cursor: default; }
        .fd-marker-dot { transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1); }
        .fd-marker-dot:focus-visible { outline: 2px solid ${C.bone}; outline-offset: 3px; }

        @media (prefers-reduced-motion: reduce) {
          .fd-reading-line, .fd-spark, .fd-flare, .fd-ember {
            animation: none !important; opacity: 1 !important; transform: none !important;
          }
        }
      `}</style>

      {/* the axis-mundi tree — draws itself up once the reading begins */}
      <svg
        viewBox="0 0 620 900"
        width="620"
        height="900"
        aria-hidden="true"
        style={{
          position: 'absolute', top: 40, left: '50%', transform: 'translateX(-50%)',
          pointerEvents: 'none', opacity: revealing ? 0.5 : 0, transition: 'opacity 1.6s ease',
        }}
      >
        <defs>
          <linearGradient id="fdTrunkGrad" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stopColor={C.smoke} stopOpacity="0.5" />
            <stop offset="100%" stopColor={C.gold} stopOpacity="0.75" />
          </linearGradient>
          <radialGradient id="fdCanopyGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={C.gold} stopOpacity="0.32" />
            <stop offset="100%" stopColor={C.gold} stopOpacity="0" />
          </radialGradient>
        </defs>
        <g
          stroke={C.smoke} strokeWidth="1.4" fill="none" strokeLinecap="round"
          style={{
            strokeDasharray: 400, strokeDashoffset: 400 * (1 - rootProgress),
            transition: 'stroke-dashoffset 1.3s cubic-bezier(0.22, 1, 0.36, 1)', opacity: 0.6,
          }}
        >
          <path d="M310 620 C 260 660, 220 690, 170 760" />
          <path d="M310 620 C 300 670, 290 710, 280 790" />
          <path d="M310 620 C 350 670, 380 700, 420 770" />
          <path d="M310 620 C 320 675, 340 720, 380 800" />
          <path d="M310 620 C 280 680, 250 720, 210 800" />
        </g>
        <path
          d="M310 620 L 310 300"
          stroke="url(#fdTrunkGrad)" strokeWidth="3" strokeLinecap="round"
          style={{
            strokeDasharray: 320, strokeDashoffset: 320 * (1 - trunkProgress),
            transition: 'stroke-dashoffset 1.3s cubic-bezier(0.22, 1, 0.36, 1)',
          }}
        />
        <g
          stroke={C.gold} strokeWidth="1.3" fill="none" strokeLinecap="round"
          style={{
            opacity: canopyProgress, transform: `scale(${0.85 + canopyProgress * 0.15})`,
            transformOrigin: '310px 300px',
            transition: 'opacity 1.8s ease, transform 1.8s cubic-bezier(0.22, 1, 0.36, 1)',
          }}
        >
          <path d="M310 300 C 250 260, 200 240, 130 210" />
          <path d="M310 300 C 260 230, 230 190, 180 130" />
          <path d="M310 300 C 300 220, 300 160, 290 90" />
          <path d="M310 300 C 330 220, 340 160, 350 90" />
          <path d="M310 300 C 360 230, 400 190, 450 130" />
          <path d="M310 300 C 370 260, 420 240, 490 210" />
        </g>
        <circle
          cx="310" cy="240" r="180" fill="url(#fdCanopyGlow)"
          style={{ opacity: canopyProgress * 0.8, transition: 'opacity 2s ease' }}
        />
      </svg>

      {/* flare — the log catching, one bright pulse at the base */}
      {igniting && !reduced && (
        <div
          className="fd-flare"
          style={{
            position: 'absolute', left: '50%', top: '62%', width: 260, height: 260,
            marginLeft: -130, marginTop: -130, borderRadius: '50%',
            background:
              `radial-gradient(circle, rgba(232,201,122,0.55) 0%, rgba(200,96,26,0.22) 45%, transparent 75%)`,
            pointerEvents: 'none',
          }}
        />
      )}

      {/* spark burst — fires once per ignition */}
      {igniting && (
        <svg width="100%" height="100%" style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} aria-hidden="true">
          {sparks.map(s => (
            <circle
              key={s.id}
              className="fd-spark"
              style={{
                '--dx': `${s.dx}px`,
                '--dy': `${s.dy}px`,
                '--dur': `${s.duration}s`,
                '--delay': `${s.delay}s`,
              } as React.CSSProperties}
              cx="50%" cy="62%" r={s.size} fill={s.color}
            />
          ))}
        </svg>
      )}

      {/* ambient ember field — free-floating, scattered, independent drift */}
      <svg width="100%" height="100%" style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} aria-hidden="true">
        {embers.map(e => (
          <circle
            key={e.id}
            className="fd-ember"
            style={{
              '--o': `${e.baseOpacity}`,
              '--dx': `${e.driftX}px`,
              '--dy': `${e.driftY}px`,
              '--dur': `${e.duration}s`,
              '--delay': `${e.delay}s`,
            } as React.CSSProperties}
            cx={`${e.x}%`} cy={`${e.y}%`} r={e.size} fill={e.color}
          />
        ))}
      </svg>

      <div style={{ maxWidth: 620, width: '100%', position: 'relative' }}>
        <div style={{
          fontFamily: "'Inter', Arial, sans-serif", fontSize: '0.62rem', letterSpacing: '0.4em',
          textTransform: 'uppercase', color: C.smoke, marginBottom: 40,
        }}>
          the elder
        </div>

        {stage === 'idle' && (
          <div>
            <div style={{ fontSize: 13, color: C.smoke, marginBottom: 10, fontStyle: 'italic' }}>
              what do you ask
            </div>
            <textarea
              className="fd-input"
              rows={3}
              value={question}
              onChange={e => setQuestion(e.target.value)}
              placeholder="Say what is actually on your mind."
              onKeyDown={e => {
                if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') askTheElder();
              }}
            />
            <div>
              <button className="fd-button" onClick={askTheElder} disabled={!question.trim()}>
                ask the elder
              </button>
            </div>
          </div>
        )}

        {stage === 'error' && (
          <div>
            <div style={{ fontSize: 13, color: C.smoke, marginBottom: 6, fontStyle: 'italic' }}>you asked</div>
            <div style={{ fontSize: 17, color: C.ash, fontStyle: 'italic', lineHeight: 1.5, marginBottom: 32 }}>
              &ldquo;{question}&rdquo;
            </div>
            <p style={{ color: C.ash, fontStyle: 'italic', lineHeight: 1.8, marginBottom: 20 }}>
              The fire guttered before it could speak. {errorMsg}
            </p>
            <button
              className="fd-button"
              onClick={() => { setStage('idle'); setPhase(0); }}
            >
              ask again
            </button>
          </div>
        )}

        {(igniting || revealing) && (
          <>
            <div style={{ marginBottom: 48 }}>
              <div style={{ fontSize: 13, color: C.smoke, marginBottom: 6, fontStyle: 'italic' }}>you asked</div>
              <div style={{ fontSize: 17, color: C.ash, fontStyle: 'italic', lineHeight: 1.5 }}>
                &ldquo;{question}&rdquo;
              </div>
            </div>

            <div style={{
              fontFamily: "'Cormorant Garamond', Georgia, serif", fontWeight: 400,
              fontSize: 'clamp(20px, 2.6vw, 25px)', lineHeight: 1.7, color: C.bone,
              textShadow: '0 0 26px rgba(212,168,67,0.10)',
              minHeight: igniting ? 120 : undefined,
            }}>
              {revealing && paras.map((para, i) => (
                <p
                  key={i}
                  className={phase > i ? 'fd-reading-line' : ''}
                  style={{ marginBottom: 26, opacity: phase > i ? undefined : 0 }}
                >
                  {para}
                </p>
              ))}
            </div>

            {revealing && (
              <div
                className={phase > totalSteps - 1 ? 'fd-reading-line' : ''}
                style={{ opacity: phase > totalSteps - 1 ? undefined : 0 }}
                onClick={e => e.stopPropagation()}
              >
                <div style={{
                  marginTop: 32, paddingTop: 28, borderTop: '1px solid rgba(212,168,67,0.18)',
                  display: 'flex', gap: 24, alignItems: 'center', flexWrap: 'wrap',
                }}>
                  <button
                    className="fd-action"
                    onClick={() => onContinue({ question: question.trim(), reading, intent: 'continue' })}
                  >
                    carry this to the fire
                  </button>
                  <button className="fd-action" onClick={deepenThread} disabled={deepening}>
                    {deepening ? 'deepening…' : 'deepen this thread'}
                  </button>
                  <button className="fd-action" onClick={keepReading}>
                    {kept ? 'kept ✓' : 'keep this reading'}
                  </button>
                </div>

                {kept && (
                  <div style={{
                    marginTop: 20, padding: '18px 20px',
                    background: 'rgba(212,168,67,0.05)',
                    borderLeft: `2px solid ${C.gold}`,
                    fontFamily: "'Gentium Plus', Georgia, serif",
                    fontSize: 14, lineHeight: 1.8, color: C.ash,
                    animation: reduced ? 'none' : 'fdRevealLine 0.6s ease forwards',
                  }}>
                    <div>You asked the fire before you chose a voice, and it answered.</div>
                    <div style={{ color: C.bone }}>
                      {signedIn
                        ? 'Kept — you can return to this reading from your letters.'
                        : 'Kept for this sitting. Sign in to carry it between fires.'}
                    </div>
                  </div>
                )}

                {signedIn && Object.keys(markerCounts).length > 0 && (
                  <div style={{
                    marginTop: 48, paddingTop: 24, borderTop: '1px solid rgba(212,168,67,0.1)',
                    display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap',
                  }}>
                    <span style={{
                      fontFamily: "'Inter', Arial, sans-serif", fontSize: '0.58rem',
                      letterSpacing: '0.2em', textTransform: 'uppercase', color: C.smoke, opacity: 0.7,
                    }}>
                      your returning threads
                    </span>
                    <div style={{ display: 'flex', gap: 10 }}>
                      {MARKER_ORDER.filter(m => markerCounts[m]).map(m => (
                        <button
                          key={m}
                          className="fd-marker-dot"
                          onMouseEnter={() => setHoveredMarker(m)}
                          onMouseLeave={() => setHoveredMarker(null)}
                          onFocus={() => setHoveredMarker(m)}
                          onBlur={() => setHoveredMarker(null)}
                          aria-label={`${m}, seen ${markerCounts[m]} time${markerCounts[m] === 1 ? '' : 's'}`}
                          style={{
                            width: 9, height: 9, borderRadius: '50%', border: 'none', padding: 0, cursor: 'pointer',
                            background: m === activeMarker ? C.gold : 'rgba(168,145,111,0.4)',
                            boxShadow: m === activeMarker ? `0 0 10px ${C.gold}` : 'none',
                            transform: hoveredMarker === m ? 'scale(1.6)' : 'scale(1)',
                          }}
                        />
                      ))}
                    </div>
                    {hoveredMarker && (
                      <span style={{ fontSize: 12, color: C.ash }}>
                        {hoveredMarker} &middot; {markerCounts[hoveredMarker]}&times;
                      </span>
                    )}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
