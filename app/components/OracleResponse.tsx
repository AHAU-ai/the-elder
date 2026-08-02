'use client';

import { useEffect, useRef, useState } from 'react';
import type { LineageKey } from '../../lib/lineages';
import { LINEAGES } from '../../lib/lineages';
import { lineageToVoiceKey } from '../../lib/lineageToVoiceKey';
import ThresholdLetter from './ThresholdLetter';

/*
  OracleResponse v2
  ──────────────────
  The oracle speaks. The vessel closes.

  Sequence:
  1. Lines surface as rising smoke (900ms between lines)
  2. ⟡ witness glyph appears (600ms after last line)
  3. Eight seconds of silence
  4. The vessel speaks its Ceremonial Closing — fixed, tradition-keyed,
     from the instrument itself, not the oracle. Smaller. Different register.
  5. Two seconds
  6. "return to the fire" appears
*/

interface OracleResponseProps {
  text: string;
  lineageKey?: LineageKey;
  onAskAgain: () => void;
  containerRef?: React.RefObject<HTMLDivElement>;
  onKeepAsCard?: (line: string) => void;
}

export default function OracleResponse({
  text,
  lineageKey = 'default',
  onAskAgain,
  containerRef,
  onKeepAsCard,
}: OracleResponseProps) {
  const [visibleLines,   setVisibleLines]   = useState<string[]>([]);
  const [showGlyph,      setShowGlyph]      = useState(false);
  const [showClosing,    setShowClosing]    = useState(false);
  const [showAskAgain,   setShowAskAgain]   = useState(false);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const ceremonialClosing = LINEAGES[lineageKey]?.ceremonialClosing
    ?? 'The fire has received what you brought. Carry what it returned.';

  function clearTimers() {
    timersRef.current.forEach(t => clearTimeout(t));
    timersRef.current = [];
  }

  function addTimer(fn: () => void, ms: number) {
    const t = setTimeout(fn, ms);
    timersRef.current.push(t);
  }

  useEffect(() => {
    if (!text) return;

    const lines = text
      .split('\n')
      .map(l => l.trim())
      .filter(l => l.length > 0);

    setVisibleLines([]);
    setShowGlyph(false);
    setShowClosing(false);
    setShowAskAgain(false);
    clearTimers();

    let i = 0;
    const totalReadTime = lines.length * 900 + 400;

    function revealNext() {
      if (i < lines.length) {
        const idx = i;
        setVisibleLines(prev => [...prev, lines[idx]]);
        i++;
        addTimer(revealNext, 900);
      } else {
        /* ⟡ glyph — 600ms after last line */
        addTimer(() => setShowGlyph(true), 600);
        /* 8 seconds of silence — then the vessel speaks */
        addTimer(() => setShowClosing(true), 8600);
        /* 2 more seconds — then ask again */
        addTimer(() => setShowAskAgain(true), 11200);
      }
    }

    addTimer(revealNext, 400);
    return clearTimers;
  }, [text]);

  if (!text) return null;

  return (
    <div style={styles.root}>
      {/* Oracle lines — rising smoke */}
      <div style={styles.linesContainer} ref={containerRef}>
        {visibleLines.map((line, i) => (
          <span
            key={i}
            className="oracle-line"
            style={{
              ...styles.line,
              fontStyle: line.startsWith('—') || line.startsWith('—')
                ? 'normal' : 'italic',
            }}
          >
            {line}
          </span>
        ))}

        {/* ⟡ witness glyph */}
        {showGlyph && (
          <span className="oracle-line" style={styles.glyph}>⟡</span>
        )}
      </div>

      {/* Ceremonial Closing — the vessel, not the oracle */}
      {showClosing && (
        <div className="oracle-line" style={styles.closing}>
          {ceremonialClosing}
        </div>
      )}

      {/* Threshold Letter — the return gift, then the way back */}
      {showAskAgain && (
        <ThresholdLetter
          voiceKey={lineageToVoiceKey(lineageKey)}
          onComplete={onAskAgain}
          onKeepAsCard={onKeepAsCard}
        />
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  root: {
    position: 'relative',
    width: '100%',
    maxWidth: 580,
    minHeight: 120,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '0 0 64px',
  },
  linesContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 0,
    width: '100%',
  },
  line: {
    display: 'block',
    fontFamily: "'Gentium Plus', Georgia, serif",
    fontSize: 19,
    lineHeight: 2,
    color: '#c09040',
    textAlign: 'center',
    letterSpacing: '0.02em',
  },
  glyph: {
    display: 'block',
    fontSize: 18,
    color: '#7a5025',
    marginTop: 18,
    marginBottom: 0,
    textAlign: 'center',
    fontStyle: 'normal',
  },
  closing: {
    display: 'block',
    fontFamily: "'Inter', Arial, sans-serif",
    fontSize: 11,
    letterSpacing: '0.18em',
    color: '#5c3a14',
    textAlign: 'center',
    marginTop: 28,
    lineHeight: 1.8,
    maxWidth: 420,
    fontStyle: 'normal',
    textTransform: 'uppercase',
  },
  askAgain: {
    marginTop: 28,
    fontFamily: "'Inter', Arial, sans-serif",
    fontSize: 9,
    letterSpacing: '0.32em',
    color: '#3a2008',
    background: 'none',
    border: 'none',
    cursor: 'none',
    opacity: 0,
    textTransform: 'uppercase',
  },
};
