'use client';

// app/components/ThresholdReception.tsx
//
// The beat between the breath finishing and the first question of the
// sitting. Before this, the breath handed straight off to age-register --
// a form question arriving with no acknowledgement that the seeker had
// just crossed in. This holds a single lineage-agnostic line
// (OPENING_BRIDGE_COPY, register-guarded -- see lib/openingBridge.ts)
// over the persistent fire, then advances itself.
//
// Only shown on a cold open (page.tsx passes showReception={!skipGate});
// a returning supplicant whose breath gate was skipped this tab does not
// sit through it again.

import { useCallback, useEffect, useRef, useState } from 'react';
import { WordReveal } from './WordReveal';
import { OPENING_BRIDGE_COPY, scheduleOpeningBridge } from '../../lib/openingBridge';

const C = {
  gold:  '#d4a843',
  ember: '#c8601a',
  smoke: '#a8916f',
};

// Held after the line finishes revealing, before age-register emerges --
// roughly one breath's rest. ThresholdReception passes this to
// scheduleOpeningBridge, which owns only the timing (lib/openingBridge.ts).
const RECEPTION_HOLD_MS = 2600;

function WatchingEye() {
  return (
    <svg
      viewBox="0 0 70 70"
      fill="none"
      width="58"
      height="58"
      aria-hidden="true"
      style={{
        display: 'block',
        margin: '0 auto 26px',
        filter: `drop-shadow(0 0 12px ${C.gold}) drop-shadow(0 0 28px rgba(212,168,67,0.22))`,
      }}
    >
      <circle cx="35" cy="35" r="32" stroke={C.gold} strokeWidth="0.5" strokeDasharray="4 6" opacity="0.32" />
      <path d="M4 35 Q35 7 66 35 Q35 63 4 35Z" stroke={C.gold} strokeWidth="1.2" fill="rgba(212,168,67,0.03)" />
      <circle cx="35" cy="35" r="10" stroke={C.ember} strokeWidth="1" fill="rgba(200,96,26,0.07)" />
      <circle cx="35" cy="35" r="5" fill={C.gold} opacity="0.92" />
      <circle cx="35" cy="35" r="2.2" fill="#050302" />
    </svg>
  );
}

interface Props {
  onDone: () => void;
}

export default function ThresholdReception({ onDone }: Props) {
  const [revealed, setRevealed] = useState(false);
  const firedRef = useRef(false);

  // Advance at most once, whichever path gets there first.
  const advance = useCallback(() => {
    if (firedRef.current) return;
    firedRef.current = true;
    onDone();
  }, [onDone]);

  // Once the line has finished revealing, hold a beat, then advance.
  useEffect(() => {
    if (!revealed) return;
    return scheduleOpeningBridge(advance, RECEPTION_HOLD_MS);
  }, [revealed, advance]);

  // Hard fallback -- never leave the seeker stranded on this beat if the
  // reveal's onComplete somehow doesn't fire.
  useEffect(() => {
    const t = setTimeout(advance, 14000);
    return () => clearTimeout(t);
  }, [advance]);

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'transparent',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px 24px',
        fontFamily: "'Gentium Plus', Georgia, 'Times New Roman', serif",
        position: 'relative',
        zIndex: 1,
      }}
    >
      <div style={{ maxWidth: 440, textAlign: 'center' }}>
        <WatchingEye />
        <div
          style={{
            fontStyle: 'italic',
            fontSize: 'clamp(1.05rem, 3.4vw, 1.35rem)',
            lineHeight: 1.9,
            color: '#e4d9bf',
            textShadow: '0 0 34px rgba(212,168,67,0.18)',
          }}
        >
          <WordReveal
            text={OPENING_BRIDGE_COPY}
            breathSynced
            onComplete={() => setRevealed(true)}
          />
        </div>
      </div>

      {/* Quiet, keyboard-reachable way past the hold -- not a hard gate. */}
      <button
        onClick={advance}
        style={{
          position: 'absolute',
          bottom: 34,
          background: 'transparent',
          border: 'none',
          color: '#6a5843',
          fontFamily: "'Gentium Plus', Georgia, serif",
          fontStyle: 'italic',
          fontSize: '0.8rem',
          letterSpacing: '0.04em',
          cursor: 'pointer',
          opacity: revealed ? 0 : 0.7,
          transition: 'opacity 0.8s ease',
          pointerEvents: revealed ? 'none' : 'auto',
        }}
      >
        go on
      </button>
    </div>
  );
}
