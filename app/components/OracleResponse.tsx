'use client';

import { useEffect, useRef, useState } from 'react';
import type { LineageKey } from '../../lib/lineages';
import { LINEAGES } from '../../lib/lineages';
import { lineageToVoiceKey } from '../../lib/lineageToVoiceKey';
import ThresholdLetter from './ThresholdLetter';
import { startHeartbeatDrum, stopHeartbeatDrum, setHeartbeatTempo, isHeartbeatDrumActive, RESTING_BPM } from '../../lib/heartbeatDrum';

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
  soundEnabled?: boolean;
}

// Speech-paced word reveal: short words pass quickly, longer words take a
// beat longer to "say", and punctuation gets a real pause — a comma a
// breath, a period or ellipsis a fuller stop. This replaces the old
// flat 900ms-per-line timer with something closer to how the reading
// would actually sound spoken aloud.
const BASE_WORD_MS = 90;
const PER_CHAR_MS = 18;
const MAX_CHAR_BONUS = 10; // cap so very long words don't stall the pace
const COMMA_PAUSE_MS = 160;
const SENTENCE_PAUSE_MS = 340;
const LINE_BREATH_MS = 260; // the pause a speaker takes between lines

function wordDelayMs(word: string): number {
  const bare = word.replace(/[.,;:!?—…"'\u201c\u201d]+$/, '');
  let delay = BASE_WORD_MS + Math.min(bare.length, MAX_CHAR_BONUS) * PER_CHAR_MS;
  const last = word[word.length - 1];
  if (last === '.' || last === '!' || last === '?' || last === '\u2026') {
    delay += SENTENCE_PAUSE_MS;
  } else if (last === ',' || last === ';' || last === ':' || last === '\u2014') {
    delay += COMMA_PAUSE_MS;
  }
  return delay;
}

export default function OracleResponse({
  text,
  lineageKey = 'default',
  onAskAgain,
  containerRef,
  onKeepAsCard,
  soundEnabled = false,
}: OracleResponseProps) {
  const [completedLines, setCompletedLines] = useState<string[]>([]);
  const [partialLine,    setPartialLine]    = useState<string[]>([]); // words revealed so far in the in-progress line
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
    const linesOfWords = lines.map(l => l.split(/\s+/).filter(Boolean));

    setCompletedLines([]);
    setPartialLine([]);
    setShowGlyph(false);
    setShowClosing(false);
    setShowAskAgain(false);
    clearTimers();

    if (soundEnabled) {
      // If the fire was already being consulted (CouncilTab's inquiry-phase
      // drum, running quickened), take over its existing ref and ease it
      // back down to resting pace as the words begin arriving — don't add
      // a second ref, or the eventual single stop() below would under-close
      // it. If nothing was running, start fresh at resting pace.
      if (isHeartbeatDrumActive()) {
        setHeartbeatTempo(RESTING_BPM);
      } else {
        startHeartbeatDrum(RESTING_BPM);
      }
    }

    let li = 0;
    let wi = 0;
    let building: string[] = [];

    function revealNextWord() {
      if (li >= linesOfWords.length) {
        if (soundEnabled) {
          stopHeartbeatDrum();
        }
        addTimer(() => setShowGlyph(true), 600);
        addTimer(() => setShowClosing(true), 8600);
        addTimer(() => setShowAskAgain(true), 11200);
        return;
      }

      const words = linesOfWords[li];
      const word = words[wi];
      building = [...building, word];
      setPartialLine(building);
      wi++;

      if (wi >= words.length) {
        const finishedLine = building;
        addTimer(() => {
          setCompletedLines(prev => [...prev, finishedLine.join(' ')]);
          setPartialLine([]);
          building = [];
          li++;
          wi = 0;
          revealNextWord();
        }, LINE_BREATH_MS);
      } else {
        addTimer(revealNextWord, wordDelayMs(word));
      }
    }

    addTimer(revealNextWord, 400);
    return () => {
      clearTimers();
      if (soundEnabled) {
        stopHeartbeatDrum();
      }
    };
  }, [text]);

  if (!text) return null;

  return (
    <div style={styles.root}>
      {/* Oracle lines — rising smoke, one word at a time */}
      <div style={styles.linesContainer} ref={containerRef}>
        {completedLines.map((line, i) => (
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

        {partialLine.length > 0 && (
          <span
            className="oracle-line"
            style={{
              ...styles.line,
              fontStyle: partialLine[0]?.startsWith('—') ? 'normal' : 'italic',
              animation: 'none',
              opacity: 1,
            }}
          >
            {partialLine.map((word, i) => (
              <span key={i} className="oracle-word" style={{ marginRight: '0.32em' }}>
                {word}
              </span>
            ))}
          </span>
        )}

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
          soundEnabled={soundEnabled}
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
