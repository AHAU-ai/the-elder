'use client';

import { useEffect, useRef, useState } from 'react';

/*
  Enhancement 6: Rising smoke oracle response
  ─────────────────────────────────────────────
  Text surfaces line by line from the bottom — no box, no border.
  Each line fades in from transparent, drifts up 8px, settles.
  Ember sparks slow during reading.
  Silence for 8 seconds after last line, then ask-again appears.
  Enhancement 10: Post-reading silence before ask-again.
*/

interface OracleResponseProps {
  text: string;
  onAskAgain: () => void;
  slowing?: boolean;
}

export default function OracleResponse({ text, onAskAgain }: OracleResponseProps) {
  const [visibleLines, setVisibleLines] = useState<string[]>([]);
  const [showAskAgain, setShowAskAgain] = useState(false);
  const [showGlyph, setShowGlyph] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!text) return;
    const lines = text
      .split('\n')
      .map(l => l.trim())
      .filter(l => l.length > 0);

    setVisibleLines([]);
    setShowAskAgain(false);
    setShowGlyph(false);

    let i = 0;
    function revealNext() {
      if (i < lines.length) {
        setVisibleLines(prev => [...prev, lines[i]]);
        i++;
        /* Pace: 900ms between lines — slow, like an oracle speaking */
        timerRef.current = setTimeout(revealNext, 900);
      } else {
        /* Enhancement 9: ⟡ appears after last line */
        timerRef.current = setTimeout(() => setShowGlyph(true), 600);
        /* Enhancement 10: 8 seconds of silence, then ask-again */
        timerRef.current = setTimeout(() => setShowAskAgain(true), 8600);
      }
    }
    timerRef.current = setTimeout(revealNext, 400);

    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [text]);

  if (!text) return null;

  return (
    <div style={styles.root}>
      {/* Lines surface like smoke */}
      <div style={styles.linesContainer}>
        {visibleLines.map((line, i) => (
          <span
            key={i}
            className="oracle-line"
            style={{
              ...styles.line,
              animationDelay: '0ms', /* already staggered by setTimeout */
              fontStyle: line.startsWith('\u2014') || line.startsWith('—')
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

      {/* Enhancement 10: Ask again — after 8s silence */}
      {showAskAgain && (
        <button
          className="elder-ask-again"
          onClick={onAskAgain}
          style={styles.askAgain}
        >
          ask again
        </button>
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
    padding: '0 0 48px',
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
    fontFamily: "'EB Garamond', Georgia, serif",
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
    textAlign: 'center',
    fontStyle: 'normal',
  },
  askAgain: {
    marginTop: 32,
    fontFamily: "'Cinzel', serif",
    fontSize: 10,
    letterSpacing: '0.28em',
    color: '#3a2008',
    background: 'none',
    border: 'none',
    cursor: 'none',
    opacity: 0,
  },
};
