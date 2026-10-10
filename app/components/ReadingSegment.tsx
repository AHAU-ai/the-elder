'use client';

import { useEffect, useRef, useState } from 'react';
import { WordReveal } from './WordReveal';

// One portion of a segmented Reading (lib/segmentedDelivery.ts).
//
// The Elder gives the telling in short portions, each closed by a single
// follow-up question. This component is what the seeker sees at the moment a
// portion arrives: the words are carved in one breath at a time, the closing
// question rises out of the fire only after the telling has landed, and the
// seeker is offered a way to answer without typing. Earlier portions settle
// into a quieter, static form so the newest one always holds the eye.

const C = {
  gold: '#d4a843',
  paleGold: '#e8c97a',
  ember: '#c8601a',
  bone: '#ede0c4',
  ash: '#c4b89a',
  smoke: '#a8916f',
};

/** Split a portion into its telling and its closing question (if any). */
export function splitQuestion(text: string): { body: string; question: string | null } {
  const trimmed = text.trim();
  const m = trimmed.match(/([^.!?…\n]*\?[”"')\]]*)\s*$/);
  if (!m) return { body: trimmed, question: null };
  const question = m[1].trim();
  const body = trimmed.slice(0, trimmed.length - m[0].length).trim();
  // A reply that is only a question has no telling to separate it from.
  if (!body) return { body: trimmed, question: null };
  return { body, question };
}

const REPLIES = ['Go on.', 'Say more about that.'];

interface Props {
  text: string;
  index: number;
  /** The seeker's reply that led into this portion (not shown for the first). */
  seekerReply?: string;
  /** The newest portion of a Reading still in progress. */
  isLatest: boolean;
  accent?: string;
  disabled?: boolean;
  onReply?: (text: string) => void;
  /** Figure Continuity: called once the portion has fully surfaced (telling and closing question), so
   *  anything that belongs beneath it (a pairing offer) appears only after it has landed. */
  onSettled?: () => void;
}

function Embers({ lit, accent, live }: { lit: number; accent: string; live: boolean }) {
  return (
    <div aria-hidden style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9, marginBottom: 18 }}>
      <div style={{ width: 34, height: 1, background: `linear-gradient(90deg,transparent,${accent})`, opacity: 0.55 }} />
      {Array.from({ length: lit }).map((_, i) => (
        <span key={i} style={{
          width: 6, height: 6, borderRadius: '50%', background: i === lit - 1 ? C.paleGold : accent,
          boxShadow: `0 0 ${i === lit - 1 ? 12 : 6}px ${i === lit - 1 ? C.paleGold : accent}`,
          opacity: i === lit - 1 ? 1 : 0.6,
          animation: live && i === lit - 1 ? 'readingSegGlow 3.4s ease-in-out infinite' : undefined,
        }} />
      ))}
      {live && (
        <span style={{
          width: 5, height: 5, borderRadius: '50%', border: `1px solid ${accent}`, opacity: 0.45,
          animation: 'readingSegBeckon 3.4s ease-in-out infinite',
        }} />
      )}
      <div style={{ width: 34, height: 1, background: `linear-gradient(270deg,transparent,${accent})`, opacity: 0.55 }} />
    </div>
  );
}

export default function ReadingSegment({ text, index, seekerReply, isLatest, accent = C.gold, disabled = false, onReply, onSettled }: Props) {
  const { body, question } = splitQuestion(text);
  const paras = body.split(/\n\n+/).filter(Boolean);

  const [reduceMotion, setReduceMotion] = useState(false);
  const [paraDone, setParaDone] = useState(0);
  const [questionShown, setQuestionShown] = useState(false);

  useEffect(() => {
    try {
      setReduceMotion(window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    } catch { /* no matchMedia: keep the animated path */ }
  }, []);

  useEffect(() => {
    setParaDone(0);
    setQuestionShown(false);
  }, [text]);

  const animated = isLatest && !reduceMotion;
  const tellingDone = !animated || paraDone >= paras.length;

  // The question follows the telling after a held breath.
  useEffect(() => {
    if (!tellingDone || questionShown) return;
    const t = setTimeout(() => setQuestionShown(true), animated ? 900 : 0);
    return () => clearTimeout(t);
  }, [tellingDone, questionShown, animated]);

  const onSettledRef = useRef(onSettled);
  onSettledRef.current = onSettled;
  const settledNow = tellingDone && (animated ? questionShown : true);
  useEffect(() => {
    if (settledNow) onSettledRef.current?.();
  }, [settledNow, text]);

  const quiet = !isLatest;

  return (
    <section
      aria-label={`The Elder's telling, portion ${index + 1}`}
      style={{
        marginBottom: quiet ? 22 : 8,
        opacity: quiet ? 0.78 : 1,
        animation: isLatest ? 'elderReveal 1.1s ease forwards' : undefined,
        transition: 'opacity 0.8s ease',
      }}
    >
      <style>{`
        @keyframes readingSegGlow { 0%,100% { opacity: .75; transform: scale(1); } 50% { opacity: 1; transform: scale(1.35); } }
        @keyframes readingSegBeckon { 0%,100% { opacity: .2; } 50% { opacity: .7; } }
        @keyframes readingSegRise { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        @media (prefers-reduced-motion: reduce) {
          [data-reading-seg] * { animation: none !important; }
        }
      `}</style>
      <div data-reading-seg>
        {index > 0 && seekerReply && (
          <div style={{
            color: C.smoke, fontSize: '0.82rem', fontStyle: 'italic', textAlign: 'right',
            marginBottom: 14, lineHeight: 1.7, opacity: 0.8,
          }}>
            {seekerReply}
          </div>
        )}

        <Embers lit={index + 1} accent={accent} live={isLatest} />

        <div style={{ fontStyle: 'italic', lineHeight: 2.0, color: C.bone, fontSize: quiet ? '1.0rem' : '1.14rem' }}>
          {paras.map((para, i) => (
            <p key={i} style={{ marginBottom: i < paras.length - 1 ? 16 : 0, whiteSpace: 'pre-wrap' }}>
              {animated
                ? (i < paraDone ? para : i === paraDone
                    ? <WordReveal key={`${text}-${i}`} text={para} carved breathSynced onComplete={() => setParaDone(d => d + 1)} />
                    : null)
                : para}
            </p>
          ))}
        </div>

        {question && (animated ? questionShown : true) && (
          <div style={{
            marginTop: 24, paddingTop: 20, textAlign: 'center', position: 'relative',
            borderTop: `1px solid ${accent}33`,
            animation: animated ? 'readingSegRise 1.2s ease forwards' : undefined,
          }}>
            <div aria-hidden style={{ color: accent, fontSize: '0.5rem', letterSpacing: '0.5em', marginBottom: 12, opacity: 0.8 }}>
              {'◆'}
            </div>
            <div style={{
              fontStyle: 'italic', fontSize: quiet ? '1.0rem' : '1.2rem', lineHeight: 1.85,
              color: quiet ? C.ash : C.paleGold,
              textShadow: quiet ? 'none' : `0 0 22px ${accent}55`,
            }}>
              {question}
            </div>
          </div>
        )}

        {isLatest && (animated ? questionShown : true) && onReply && (
          <div style={{
            marginTop: 20, display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap',
            animation: animated ? 'readingSegRise 1.2s ease 0.5s both' : undefined,
          }}>
            {REPLIES.map(r => (
              <button
                key={r}
                disabled={disabled}
                onClick={() => onReply(r)}
                style={{
                  background: 'transparent', border: `1px solid ${accent}77`, color: C.paleGold,
                  fontFamily: "'Gentium Plus',Georgia,serif", fontStyle: 'italic', fontSize: '0.92rem',
                  padding: '9px 18px', cursor: disabled ? 'not-allowed' : 'pointer',
                  opacity: disabled ? 0.4 : 1, borderRadius: 2, minHeight: 40,
                  transition: 'background 0.25s, border-color 0.25s',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = `${accent}18`; e.currentTarget.style.borderColor = accent; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = `${accent}77`; }}
              >
                {r}
              </button>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
