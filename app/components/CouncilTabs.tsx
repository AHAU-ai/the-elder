'use client'
import { WordReveal } from './WordReveal';

import { useState, useRef, useEffect, useCallback } from 'react';
import { LineageKey, LINEAGES } from '../../lib/lineages';
import { LINEAGE_ARCHETYPES, ArchetypeCard } from '../../lib/archetypes';
import OracleResponse from './OracleResponse';
import { startHeartbeatDrum, stopHeartbeatDrum, INQUIRY_BPM } from '../../lib/heartbeatDrum';
import ReadingSignal from './ReadingSignal';
import FireAtmosphere from './FireAtmosphere';
import { usePresence } from '../../lib/usePresence';
import SaveMythPrompt from './SaveMythPrompt';
import ShareableCard from './ShareableCard';
import { lineageToVoiceKey } from '../../lib/lineageToVoiceKey';
import { suggestMarker, pullQuote, type MarkerType, type CardQuote } from '../../lib/mythopoetics/cardConfig';
import type { NarrativeRegister } from './RegisterSwitch';

// ─── PALETTE ─────────────────────────────────────────────────────────────────
const C = {
  obsidian: '#0a0806',
  gold:     '#d4a843',
  paleGold: '#e8c97a',
  ember:    '#c8601a',
  bone:     '#ede0c4',
  ash:      '#c4b89a',
  smoke:    '#8a7a6a',
  blood:    '#7a1a1a',
};

const LOADING_LINES = [
  'The Elder reads the patterns in the fire\u2026',
  'The myth is being named\u2026',
  'The archetypes stir in the smoke\u2026',
  'The Seer gazes into what lives through you\u2026',
  'The fire speaks in shapes\u2026',
  'What is hidden rises to the surface\u2026',
];

type TabId = 'mythology' | 'archetypes' | 'council';
type Message = { role: 'user' | 'assistant'; content: string };
type ThreadEntry = { seeker: string; elder: string };

// ─── SUB-COMPONENTS ───────────────────────────────────────────────────────────

function Divider({ symbol = '\u2726' }: { symbol?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, margin: '18px 0', opacity: 0.38 }}>
      <div style={{ flex: 1, height: 1, background: `linear-gradient(90deg,transparent,${C.gold},transparent)` }} />
      <span style={{ color: C.gold, fontSize: '0.9rem' }}>{symbol}</span>
      <div style={{ flex: 1, height: 1, background: `linear-gradient(90deg,transparent,${C.gold},transparent)` }} />
    </div>
  );
}

function OracleCorners() {
  return (
    <>
      <div style={{ position: 'absolute', top: 8, left: 8, width: 16, height: 16, borderTop: `1px solid ${C.gold}`, borderLeft: `1px solid ${C.gold}`, opacity: 0.5 }} />
      <div style={{ position: 'absolute', top: 8, right: 8, width: 16, height: 16, borderTop: `1px solid ${C.gold}`, borderRight: `1px solid ${C.gold}`, opacity: 0.5 }} />
      <div style={{ position: 'absolute', bottom: 8, left: 8, width: 16, height: 16, borderBottom: `1px solid ${C.gold}`, borderLeft: `1px solid ${C.gold}`, opacity: 0.5 }} />
      <div style={{ position: 'absolute', bottom: 8, right: 8, width: 16, height: 16, borderBottom: `1px solid ${C.gold}`, borderRight: `1px solid ${C.gold}`, opacity: 0.5 }} />
    </>
  );
}

function EmberDots({ text }: { text: string }) {
  return (
    <div style={{ textAlign: 'center', padding: '38px 0' }}>
      <div style={{ display: 'flex', justifyContent: 'center', gap: 12, marginBottom: 16 }}>
        {[C.ember, C.gold, C.ember].map((bg, i) => (
          <span key={i} style={{
            display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: bg,
            animationName: 'elderBob', animationDuration: '1.6s',
            animationTimingFunction: 'ease-in-out', animationIterationCount: 'infinite',
            animationDelay: `${i * 0.28}s`,
          }} />
        ))}
      </div>
      <div style={{ fontStyle: 'italic', color: C.smoke, fontSize: '0.88rem' }}>{text}</div>
    </div>
  );
}

function OracleText({ text }: { text: string }) {
  const [revealedThrough, setRevealedThrough] = useState(0);

  useEffect(() => {
    setRevealedThrough(0);
  }, [text]);

  if (!text) return null;
  const paras = text.split(/\n\n+/).filter(Boolean);

  let globalLineIndex = -1;

  return (
    <>
      {paras.map((para, i) => {
        const lines = para.split('\n');
        return (
          <p key={i} style={{ marginBottom: i < paras.length - 1 ? 18 : 0, fontStyle: 'italic', lineHeight: 2.0, color: C.bone, fontSize: '1.12rem' }}>
            {lines.map((line, j) => {
              globalLineIndex++;
              const idx = globalLineIndex;
              const isBr = j < lines.length - 1;

              if (idx > revealedThrough) return null; // not reached yet

              if (idx === revealedThrough) {
                return (
                  <span key={j}>
                    <WordReveal text={line} carved breathSynced onComplete={() => setRevealedThrough(r => r + 1)} />
                    {isBr && <br />}
                  </span>
                );
              }

              return <span key={j}>{line}{isBr && <br />}</span>;
            })}
          </p>
        );
      })}
    </>
  );
}

// ─── ARCHETYPE CARD ───────────────────────────────────────────────────────────

function ArchetypeCardDisplay({ card, accent }: { card: ArchetypeCard; accent: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{
      border: `1px solid ${open ? accent : 'rgba(212,168,67,0.18)'}`,
      background: open ? 'rgba(212,168,67,0.03)' : 'transparent',
      marginBottom: 10,
      transition: 'border-color 0.3s, background 0.3s',
      position: 'relative',
    }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', background: 'transparent', border: 'none',
          color: C.bone, fontFamily: "'Gentium Plus',Georgia,serif", fontSize: '1rem',
          padding: '14px 18px', cursor: 'pointer', textAlign: 'left',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}
      >
        <span>
          <span style={{ color: accent, fontSize: '0.72rem', letterSpacing: '0.22em', textTransform: 'uppercase', marginRight: 10 }}>
            {card.role}
          </span>
          <span style={{ fontStyle: 'italic', fontWeight: 400 }}>{card.name}</span>
        </span>
        <span style={{ color: C.smoke, fontSize: '0.7rem', marginLeft: 12 }}>{open ? '\u25b2' : '\u25bc'}</span>
      </button>
      {open && (
        <div style={{ padding: '0 18px 18px', animation: 'elderReveal 0.4s ease forwards' }}>
          <Divider />
          {[
            ['Existential Field', card.existentialField],
            ['Gift', card.gift],
            ['Shadow', card.shadow],
            ['Canonical Anchor', card.canonicalAnchor],
          ].map(([label, val]) => (
            <div key={label} style={{ marginBottom: 12 }}>
              <div style={{ fontSize: '0.54rem', letterSpacing: '0.28em', color: accent, textTransform: 'uppercase', marginBottom: 4, opacity: 0.8 }}>{label}</div>
              <div style={{ color: C.ash, fontSize: '0.92rem', fontStyle: 'italic', lineHeight: 1.75 }}>{val}</div>
            </div>
          ))}
          <div style={{ marginTop: 16, borderTop: `1px solid rgba(212,168,67,0.12)`, paddingTop: 14 }}>
            <div style={{ fontSize: '0.54rem', letterSpacing: '0.28em', color: C.ember, textTransform: 'uppercase', marginBottom: 6 }}>The Elder Asks</div>
            <div style={{ color: C.paleGold, fontSize: '0.98rem', fontStyle: 'italic', lineHeight: 1.8 }}>{card.elderQuestion}</div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── TAB: MYTHOLOGY ───────────────────────────────────────────────────────────

function MythologyTab({ lineage, onAsk }: { lineage: LineageKey; onAsk?: () => void }) {
  const lin = LINEAGES[lineage];
  const accent = lin.palette.primary;
  const [topic, setTopic] = useState('');
  const [response, setResponse] = useState('');
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<Message[]>([]);
  const [thread, setThread] = useState<ThreadEntry[]>([]);
  const [error, setError] = useState('');
  const [loadingText, setLoadingText] = useState(LOADING_LINES[0]);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const threadEndRef = useRef<HTMLDivElement>(null);

  const stopCycle = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
  }, []);

  const startCycle = useCallback(() => {
    setLoadingText(LOADING_LINES[0]);
    let idx = 0;
    intervalRef.current = setInterval(() => {
      idx = (idx + 1) % LOADING_LINES.length;
      setLoadingText(LOADING_LINES[idx]);
    }, 2200);
  }, []);

  useEffect(() => () => stopCycle(), [stopCycle]);

  const ask = useCallback(async () => {
    const text = topic.trim();
    if (!text || loading) return;
    const next: Message[] = [...history, { role: 'user', content: text }];
    setLoading(true);
    setError('');
    onAsk?.();
    startCycle();
    try {
      const res = await fetch('/api/divine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: next, lineageKey: lineage, mode: 'mythology' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      const elderText: string = data.text;
      const full: Message[] = [...next, { role: 'assistant', content: elderText }];
      setHistory(full);
      if (!response) {
        setResponse(elderText);
      } else {
        setThread(t => [...t, { seeker: text, elder: elderText }]);
        setTimeout(() => threadEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 120);
      }
      setTopic('');
    } catch (err: any) {
      setError(err?.message || 'Unknown error');
    } finally {
      stopCycle();
      setLoading(false);
    }
  }, [topic, loading, history, lineage, response, startCycle, stopCycle]);

  const MYTH_TOPICS = [
    `Tell me the central myth of the ${lin.tradition} tradition.`,
    `Who are the great teachers and figures of the ${lin.tradition} lineage?`,
    `What is the cosmology — the shape of the universe — in the ${lin.tradition} tradition?`,
    `What do the ${lin.tradition} teachings say about death and what follows it?`,
    `What is the nature of the shadow — the underworld, the dark — in the ${lin.tradition} tradition?`,
  ];

  return (
    <div>
      <div style={{ marginBottom: 22, textAlign: 'center' }}>
        <div style={{ fontSize: '0.62rem', letterSpacing: '0.38em', color: accent, textTransform: 'uppercase', marginBottom: 6 }}>
          {lin.teacherTitle}
        </div>
        <div style={{ fontStyle: 'italic', color: C.ash, fontSize: '1.0rem', lineHeight: 1.8 }}>
          The {lin.teacherTitle} speaks from within the {lin.tradition} field.
          <br />
          Choose a threshold to enter — or speak your own question.
        </div>
      </div>

      {!response && !loading && (
        <div style={{ display: 'grid', gap: 8, marginBottom: 14 }}>
          {MYTH_TOPICS.map((t, i) => (
            <button
              key={i}
              onClick={() => setTopic(t)}
              style={{
                background: topic === t ? 'rgba(212,168,67,0.05)' : 'transparent',
                border: `1px solid ${topic === t ? accent : 'rgba(212,168,67,0.17)'}`,
                color: topic === t ? C.paleGold : C.ash,
                fontFamily: "'Gentium Plus',Georgia,serif", fontSize: '0.9rem',
                padding: '10px 14px', cursor: 'pointer', textAlign: 'left',
                lineHeight: 1.5, fontStyle: 'italic',
                transition: 'border-color 0.25s, color 0.25s',
              }}
            >
              {t}
            </button>
          ))}
        </div>
      )}

      {loading && <EmberDots text={loadingText} />}

      {error && (
        <div style={{ color: C.blood, fontStyle: 'italic', fontSize: '0.88rem', textAlign: 'center', marginBottom: 14 }}>
          The fire dims — {error}
        </div>
      )}

      {response && !loading && (
        <div style={{
          background: 'rgba(8,6,4,0.93)', border: `1px solid rgba(212,168,67,0.28)`,
          padding: '28px 36px', marginBottom: 18, position: 'relative', animation: 'elderReveal 1.1s ease forwards',
        }}>
          <OracleCorners />
          <div style={{ fontSize: '0.54rem', letterSpacing: '0.3em', color: accent, textTransform: 'uppercase', marginBottom: 14, opacity: 0.8 }}>
            The {lin.teacherTitle} speaks
          </div>
          <OracleText text={response} />
        </div>
      )}

      {thread.map((entry, i) => (
        <div key={i} style={{
          marginBottom: 22, paddingLeft: 18, borderLeft: `2px solid rgba(212,168,67,0.10)`,
          position: 'relative', animation: 'elderReveal 0.8s ease forwards',
        }}>
          <div style={{ position: 'absolute', left: -6, top: 4, color: C.gold, fontSize: '0.48rem' }}>◆</div>
          <div style={{ fontSize: '0.52rem', letterSpacing: '0.26em', color: C.smoke, textTransform: 'uppercase', marginBottom: 5 }}>The Seeker asks</div>
          <div style={{ color: C.ash, fontSize: '0.88rem', fontStyle: 'italic', marginBottom: 12, lineHeight: 1.72 }}>{entry.seeker}</div>
          <div style={{ fontSize: '0.52rem', letterSpacing: '0.26em', color: accent, textTransform: 'uppercase', marginBottom: 7 }}>The {lin.teacherTitle} answers</div>
          <OracleText text={entry.elder} />
        </div>
      ))}
      <div ref={threadEndRef} />

      <div style={{ display: 'flex', gap: 8, marginTop: response ? 18 : 0 }}>
        <input
          ref={inputRef}
          value={topic}
          onChange={e => setTopic(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') ask(); }}
          disabled={loading}
          placeholder={response ? 'Ask the teacher what more you would know\u2026' : 'Or speak your own question to the ' + lin.teacherTitle + '\u2026'}
          style={{
            flex: 1, background: 'rgba(255,255,255,0.022)', border: '1px solid rgba(212,168,67,0.18)',
            color: C.bone, fontFamily: "'Gentium Plus',Georgia,serif", fontStyle: 'italic', fontSize: '1.02rem',
            padding: '11px 16px', outline: 'none', opacity: loading ? 0.5 : 1,
          }}
        />
        <button
          onClick={ask}
          disabled={loading}
          style={{
            background: 'transparent', border: `1px solid ${accent}`,
            color: accent, fontFamily: "'Gentium Plus',Georgia,serif", fontSize: '0.63rem',
            letterSpacing: '0.22em', padding: '11px 20px', cursor: loading ? 'not-allowed' : 'pointer',
            textTransform: 'uppercase', whiteSpace: 'nowrap', opacity: loading ? 0.32 : 1,
          }}
        >
          {loading ? '\u2026' : 'Enter'}
        </button>
      </div>
    </div>
  );
}

// ─── TAB: ARCHETYPES ──────────────────────────────────────────────────────────

type ArchPhase = 'questions' | 'surfacing' | 'revealed';

function ArchetypesTab({ lineage, onAsk }: { lineage: LineageKey; onAsk?: () => void }) {
  const lin = LINEAGES[lineage];
  const accent = lin.palette.primary;
  const data = LINEAGE_ARCHETYPES[lineage];
  const [phase, setPhase] = useState<ArchPhase>('questions');
  const [answers, setAnswers] = useState<string[]>(['', '', '']);
  const [revealed, setRevealed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingText, setLoadingText] = useState(LOADING_LINES[0]);
  const [surfaceText, setSurfaceText] = useState('');
  const [error, setError] = useState('');
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopCycle = useCallback(() => { if (intervalRef.current) clearInterval(intervalRef.current); }, []);
  const startCycle = useCallback(() => {
    let idx = 0;
    intervalRef.current = setInterval(() => { idx = (idx + 1) % LOADING_LINES.length; setLoadingText(LOADING_LINES[idx]); }, 2200);
  }, []);
  useEffect(() => () => stopCycle(), [stopCycle]);

  const surface = useCallback(async () => {
    const filled = answers.filter(a => a.trim().length > 0);
    if (filled.length < 2 || loading) return;
    setLoading(true);
    setError('');
    onAsk?.();
    startCycle();
    const payload = data.diagnosticQuestions.map((q, i) => `Q: ${q}\nA: ${answers[i] || '(no answer)'}`).join('\n\n');
    const messages: Message[] = [{
      role: 'user',
      content: `The seeker has answered the diagnostic questions. Based on these answers, name the archetypes from the ${lin.tradition} field that are most active for this seeker. Introduce them briefly before the card display.\n\n${payload}`,
    }];
    try {
      const res = await fetch('/api/divine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages, lineageKey: lineage, mode: 'archetypes' }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d?.error || `HTTP ${res.status}`);
      setSurfaceText(d.text);
      setPhase('revealed');
    } catch (err: any) {
      setError(err?.message || 'Unknown error');
    } finally {
      stopCycle();
      setLoading(false);
    }
  }, [answers, loading, data, lin, lineage, startCycle, stopCycle]);

  return (
    <div>
      <div style={{ marginBottom: 22, textAlign: 'center' }}>
        <div style={{ fontSize: '0.62rem', letterSpacing: '0.38em', color: accent, textTransform: 'uppercase', marginBottom: 6 }}>
          Archetypes of the {lin.tradition} Field
        </div>
        <div style={{ fontStyle: 'italic', color: C.ash, fontSize: '1.0rem', lineHeight: 1.8 }}>
          {phase === 'questions'
            ? <WordReveal text="Answer the three questions. The Elder will name what is active in you." />
            : 'The archetypes present in you, drawn from the ' + lin.tradition + ' field.'}
        </div>
      </div>

      {phase === 'questions' && (
        <div>
          {data.diagnosticQuestions.map((q, i) => (
            <div key={i} style={{ marginBottom: 18 }}>
              <div style={{ fontStyle: 'italic', color: C.paleGold, fontSize: '0.96rem', lineHeight: 1.8, marginBottom: 8 }}>{q}</div>
              <textarea
                value={answers[i]}
                onChange={e => { const a = [...answers]; a[i] = e.target.value; setAnswers(a); }}
                rows={3}
                style={{
                  width: '100%', background: 'rgba(255,255,255,0.022)', border: '1px solid rgba(212,168,67,0.18)',
                  color: C.bone, fontFamily: "'Gentium Plus',Georgia,serif", fontStyle: 'italic', fontSize: '0.98rem',
                  padding: '10px 14px', outline: 'none', resize: 'vertical', boxSizing: 'border-box',
                }}
              />
            </div>
          ))}
          {error && <div style={{ color: C.blood, fontStyle: 'italic', fontSize: '0.88rem', marginBottom: 10 }}>{error}</div>}
          {loading ? <EmberDots text={loadingText} /> : (
            <button
              onClick={surface}
              disabled={answers.filter(a => a.trim()).length < 2}
              style={{
                background: 'transparent', border: `1px solid ${accent}`,
                color: accent, fontFamily: "'Gentium Plus',Georgia,serif", fontSize: '0.63rem',
                letterSpacing: '0.22em', padding: '12px 28px', cursor: 'pointer',
                textTransform: 'uppercase', display: 'block', margin: '8px auto 0',
                opacity: answers.filter(a => a.trim()).length < 2 ? 0.35 : 1,
              }}
            >
              Surface the Archetypes
            </button>
          )}
        </div>
      )}

      {phase === 'revealed' && (
        <div style={{ animation: 'elderReveal 1.1s ease forwards' }}>
          {surfaceText && (
            <div style={{
              background: 'rgba(8,6,4,0.93)', border: `1px solid rgba(212,168,67,0.28)`,
              padding: '24px 32px', marginBottom: 22, position: 'relative',
            }}>
              <OracleCorners />
              <div style={{ fontSize: '0.54rem', letterSpacing: '0.3em', color: accent, textTransform: 'uppercase', marginBottom: 12, opacity: 0.8 }}>
                The Elder names what stirs
              </div>
              <OracleText text={surfaceText} />
            </div>
          )}
          <Divider symbol="◆" />
          <div style={{ fontSize: '0.56rem', letterSpacing: '0.3em', color: C.smoke, textTransform: 'uppercase', marginBottom: 18, opacity: 0.55, textAlign: 'center' }}>
            The Archetypes of the {lin.tradition} Field
          </div>
          {data.archetypes.map((card, i) => (
            <ArchetypeCardDisplay key={i} card={card} accent={accent} />
          ))}
          <button
            onClick={() => { setPhase('questions'); setAnswers(['', '', '']); setSurfaceText(''); }}
            style={{
              background: 'transparent', border: 'none', color: C.smoke,
              fontFamily: "'Gentium Plus',Georgia,serif", fontSize: '0.54rem', letterSpacing: '0.22em',
              cursor: 'pointer', textTransform: 'uppercase', padding: '12px 0',
              marginTop: 18, display: 'block', width: '100%', textAlign: 'center', opacity: 0.55,
            }}
          >
            ◇ &nbsp; Return to the Questions &nbsp; ◇
          </button>
        </div>
      )}
    </div>
  );
}

// ─── TAB: COUNCIL (existing oracle flow) ──────────────────────────────────────

const COUNCIL_QUESTIONS = [
  { label: '"The same wound finds me, wherever I go."', text: 'I feel like I keep repeating the same pattern in my life — different people, different places, but the same wound finds me every time. What myth is living through me?' },
  { label: '"I was born for something I cannot yet name."', text: 'I have always felt I was born for something greater — a calling I cannot hear clearly, a purpose that eludes me. What myth am I living?' },
  { label: '"I am caught between two worlds, two selves."', text: 'I feel caught between two worlds — two identities, two loyalties, two ways of being. I do not know which one is truly me. What myth holds this tension?' },
  { label: '"I have descended. I am trying to find my way back."', text: 'I have experienced great loss — a death, a collapse, a shattering of the life I knew. I am in the dark and trying to understand what this descent means. What myth is this?' },
  { label: '"I feel nothing. I am numb to my own life."', text: 'I feel strangely disconnected from my own life — like I am watching it from a distance, unable to feel it fully. There is a numbness, a flatness. What myth lives in this emptiness?' },
];

type AskMode = 'own' | 'choose' | null;

function CouncilTab({ lineage, priorMythContext, signedIn, soundEnabled = false, onAsk, narrativeRegister, birthDate }: { lineage: LineageKey; priorMythContext?: string; signedIn?: boolean; soundEnabled?: boolean; onAsk?: () => void; narrativeRegister?: NarrativeRegister; birthDate?: string }) {
  const lin = LINEAGES[lineage];
  const accent = lin.palette.primary;
  const [askMode, setAskMode] = useState<AskMode>(null);
  const [input, setInput] = useState('');
  const [selectedQ, setSelectedQ] = useState<typeof COUNCIL_QUESTIONS[number] | null>(null);
  const [history, setHistory] = useState<Message[]>([]);
  const [firstReading, setFirstReading] = useState<string | null>(null);
  // The machine-readable provenance stamp for firstReading specifically --
  // threaded to ShareableCard so it can be embedded in the exported PNG
  // and, for a signed-in seeker, the persisted share_card row. Only ever
  // set alongside firstReading itself (see runConsult below), never for a
  // thread follow-up -- the card feature only ever cards the first reading.
  const [firstReadingProvenance, setFirstReadingProvenance] = useState<Record<string, unknown> | null>(null);
  const [thread, setThread] = useState<ThreadEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingText, setLoadingText] = useState(LOADING_LINES[0]);
  const [error, setError] = useState('');
  const [lastAttempt, setLastAttempt] = useState('');
  const [readyToRead, setReadyToRead] = useState(false);
  const [shakeKey, setShakeKey] = useState(0);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [cardOpen,   setCardOpen]   = useState(false);
  // Placeholder cast: never rendered as-is -- cardOpen only flips true
  // right after setCardLine receives a real pullQuote() result below.
  const [cardLine,   setCardLine]   = useState<CardQuote>('' as CardQuote);
  const [cardMarker, setCardMarker] = useState<MarkerType>('pattern');
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const threadEndRef = useRef<HTMLDivElement>(null);

  const stopCycle = useCallback(() => { if (intervalRef.current) clearInterval(intervalRef.current); }, []);
  const startCycle = useCallback(() => {
    setLoadingText(LOADING_LINES[0]);
    let idx = 0;
    intervalRef.current = setInterval(() => { idx = (idx + 1) % LOADING_LINES.length; setLoadingText(LOADING_LINES[idx]); }, 2200);
  }, []);
  useEffect(() => () => stopCycle(), [stopCycle]);

  const runConsult = useCallback(async (userText: string, currentHistory: Message[], isReadingMode: boolean) => {
    const saved = currentHistory;
    const next: Message[] = [...currentHistory, { role: 'user', content: userText }];
    setLoading(true);
    setError('');
    onAsk?.();
    startCycle();
    // The inquiry has been made — the fire quickens while it is held there.
    // If a reading follows, OracleResponse eases this back to resting pace
    // as the words begin; if it errors out below, this stops on its own.
    if (soundEnabled) {
      startHeartbeatDrum(INQUIRY_BPM);
    }
    try {
      const res = await fetch('/api/divine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: next, lineageKey: lineage, mode: isReadingMode ? 'reading' : 'council', priorMythContext, narrativeRegister, birthDate }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      const elderText: string = data.text;
      const full: Message[] = [...next, { role: 'assistant', content: elderText }];
      setHistory(full);
      if (typeof data.remaining === 'number') setRemaining(data.remaining);
      if (data.readyToRead) setReadyToRead(true);

      // A response that still carries the READY signal is the model asking
      // its one allowed clarifying question, not delivering the Reading —
      // per the clarify-before-decline instruction in system-prompt-builder.ts.
      // Keep firstReading unset so the seeker's reply is still treated as the
      // opening exchange and gets resent with mode: 'reading' (forcing a real
      // answer, not a second question). Mirrors Threshold.tsx's runConsult.
      const isClarifyingQuestion = !isReadingMode && data.readyToRead;

      if (!firstReading && !isClarifyingQuestion) {
        setFirstReading(elderText);
        setFirstReadingProvenance(data._provenance ?? null);
        // OracleResponse is about to mount on this new text and will claim
        // the still-running (quickened) drum ref itself — leave it running.
      } else {
        setThread(t => [...t, { seeker: userText, elder: elderText }]);
        setTimeout(() => threadEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 120);
        // A clarifying exchange or thread follow-up never changes
        // `firstReading`, so OracleResponse's effect won't re-run to claim
        // this ref — release it now or the quickened drum never stops.
        if (soundEnabled) {
          stopHeartbeatDrum();
        }
      }
      setInput('');
      setSelectedQ(null);
      setLastAttempt('');
    } catch (err: any) {
      setHistory(saved);
      setError(err?.message || 'Unknown error');
      // No reading follows an error, so OracleResponse never mounts to take
      // over this ref — release it here or the quickened drum plays forever.
      if (soundEnabled) {
        stopHeartbeatDrum();
      }
    } finally {
      stopCycle();
      setLoading(false);
      // On success, ownership of the still-running (quickened) drum passes
      // to OracleResponse, which will claim the existing ref instead of
      // adding its own, ease it to resting tempo, and stop it once the
      // reveal completes.
    }
  }, [lineage, firstReading, startCycle, stopCycle, priorMythContext, narrativeRegister, birthDate, soundEnabled]);

  const consult = useCallback(() => {
    if (loading) return;
    const text = input.trim() || selectedQ?.text || '';
    if (!text) { setShakeKey(k => k + 1); inputRef.current?.focus(); return; }
    setLastAttempt(text);
    runConsult(text, history, readyToRead && !firstReading);
  }, [input, selectedQ, history, runConsult, loading, readyToRead, firstReading]);

  const reset = useCallback(() => {
    stopCycle();
    setHistory([]);
    setFirstReading(null);
    setFirstReadingProvenance(null);
    setThread([]);
    setInput('');
    setSelectedQ(null);
    setError('');
    setLastAttempt('');
    setAskMode(null);
    setReadyToRead(false);
  }, [stopCycle]);

  return (
    <div>
      <div style={{ marginBottom: 22, textAlign: 'center' }}>
        <div style={{ fontSize: '0.62rem', letterSpacing: '0.38em', color: accent, textTransform: 'uppercase', marginBottom: 6 }}>
          Council with The Elder
        </div>
        <div style={{ fontStyle: 'italic', color: C.ash, fontSize: '1.0rem', lineHeight: 1.8 }}>
          Speak truthfully. The myth living through your life shall be named.
        </div>
      </div>

      <div style={{
        background: 'rgba(8,6,4,0.93)',
        border: `1px solid ${firstReading ? 'rgba(212,168,67,0.42)' : error ? 'rgba(122,26,26,0.4)' : 'rgba(212,168,67,0.16)'}`,
        position: 'relative', marginBottom: 16, minHeight: 120,
        transition: 'border-color 0.6s ease',
      }}>
        <OracleCorners />
        <div style={{ padding: '28px 38px', minHeight: 120, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          {!firstReading && !loading && !error && (
            <div style={{ textAlign: 'center', color: C.ash, fontStyle: 'italic', fontSize: '1.0rem', lineHeight: 1.9, opacity: 0.82 }}>
              {lin.lineageGreeting}
            </div>
          )}
          {loading && <EmberDots text={loadingText} />}
          {error && (
            <div style={{ textAlign: 'center' }}>
              <div style={{ color: C.blood, fontStyle: 'italic', fontSize: '0.9rem', marginBottom: 10 }}>
                The fire dims. The Elder cannot be reached at this moment.
              </div>
              <div style={{ color: 'rgba(122,26,26,0.75)', fontSize: '0.71rem', wordBreak: 'break-word', maxWidth: 420, margin: '0 auto 14px', lineHeight: 1.65 }}>{error}</div>
              {lastAttempt && (
                <button onClick={() => runConsult(lastAttempt, history, readyToRead && !firstReading)} style={{
                  background: 'transparent', border: `1px solid ${C.blood}`, color: C.blood,
                  fontFamily: "'Gentium Plus',Georgia,serif", fontSize: '0.61rem', letterSpacing: '0.2em',
                  padding: '8px 18px', cursor: 'pointer', textTransform: 'uppercase',
                }}>Rekindle the Fire</button>
              )}
            </div>
          )}
          {firstReading && !loading && (
            <div style={{ animation: 'elderReveal 1.1s ease forwards' }}>
              <OracleResponse
                text={firstReading}
                lineageKey={lineage}
                onAskAgain={() => { setFirstReading(null); setFirstReadingProvenance(null); setHistory([]); setTimeout(() => inputRef.current?.focus(), 100); }}
                soundEnabled={soundEnabled}
                onKeepAsCard={(returnGiftLine) => {
                  const marker = suggestMarker(returnGiftLine);
                  setCardLine(pullQuote(returnGiftLine));
                  setCardMarker(marker);
                  setCardOpen(true);
                  if (signedIn) {
                    // volatilizationPhrase/returnPhrase/thresholdImage aren't
                    // sent -- /api/threshold-letters recomputes them itself
                    // from lineageKey (its own comment: "so a kept letter
                    // can't be fabricated with arbitrary text"), so
                    // computing them here too was a redundant client-side
                    // call into psychopompLayer.ts's ~110KB of per-lineage
                    // content for values the server was already discarding.
                    fetch('/api/threshold-letters', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ lineageKey: lineage, returnGift: returnGiftLine, marker }),
                    }).catch(() => {});
                  }
                }}
              />
              {cardOpen && (
                <ShareableCard
                  line={cardLine}
                  marker={cardMarker}
                  voiceKey={lineageToVoiceKey(lineage)}
                  signedIn={!!signedIn}
                  provenance={firstReadingProvenance}
                  onMarkerChange={setCardMarker}
                  onClose={() => setCardOpen(false)}
                />
              )}
              <ReadingSignal
                sessionId={typeof crypto !== 'undefined' ? crypto.randomUUID() : String(Date.now())}
                lineage={lineage}
              />
              {!signedIn && !priorMythContext && <SaveMythPrompt accent={accent} />}
            </div>
          )}
        </div>
      </div>

      {!firstReading && !loading && askMode === null && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, marginBottom: 14 }}>
          <button
            onClick={() => { setAskMode('own'); setTimeout(() => inputRef.current?.focus(), 50); }}
            style={{
              background: 'rgba(212,168,67,0.04)', border: `1px solid rgba(212,168,67,0.28)`,
              color: C.paleGold, fontFamily: "'Gentium Plus',Georgia,serif", fontSize: '1rem',
              padding: '22px 18px', cursor: 'pointer', textAlign: 'center', lineHeight: 1.5, fontStyle: 'italic',
              transition: 'border-color 0.25s, background 0.25s',
            }}
          >
            Ask Your Own Question
            <div style={{ fontSize: '0.62rem', letterSpacing: '0.12em', color: C.smoke, fontStyle: 'normal', marginTop: 8, opacity: 0.75 }}>
              Speak freely — the Elder will read what you bring.
            </div>
          </button>
          <button
            onClick={() => setAskMode('choose')}
            style={{
              background: 'rgba(212,168,67,0.04)', border: `1px solid rgba(212,168,67,0.28)`,
              color: C.paleGold, fontFamily: "'Gentium Plus',Georgia,serif", fontSize: '1rem',
              padding: '22px 18px', cursor: 'pointer', textAlign: 'center', lineHeight: 1.5, fontStyle: 'italic',
              transition: 'border-color 0.25s, background 0.25s',
            }}
          >
            Choose a Question
            <div style={{ fontSize: '0.62rem', letterSpacing: '0.12em', color: C.smoke, fontStyle: 'normal', marginTop: 8, opacity: 0.75 }}>
              Select from questions others have carried to the fire.
            </div>
          </button>
        </div>
      )}

      {!firstReading && !loading && askMode === 'choose' && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 8, marginBottom: 10 }}>
            {COUNCIL_QUESTIONS.map((q, i) => (
              <button key={i} onClick={() => setSelectedQ(p => p?.text === q.text ? null : q)}
                style={{
                  background: selectedQ?.text === q.text ? 'rgba(212,168,67,0.05)' : 'transparent',
                  border: `1px solid ${selectedQ?.text === q.text ? C.gold : 'rgba(212,168,67,0.17)'}`,
                  color: selectedQ?.text === q.text ? C.paleGold : C.ash,
                  fontFamily: "'Gentium Plus',Georgia,serif", fontSize: '0.9rem', padding: '10px 13px',
                  cursor: 'pointer', textAlign: 'left', lineHeight: 1.5, fontStyle: 'italic',
                  transition: 'border-color 0.25s, color 0.25s',
                }}
              >{q.label}</button>
            ))}
          </div>
          <button onClick={() => { setAskMode(null); setSelectedQ(null); }} style={{
            background: 'transparent', border: 'none', color: C.smoke,
            fontFamily: "'Gentium Plus',Georgia,serif", fontSize: '0.56rem', letterSpacing: '0.2em',
            cursor: 'pointer', textTransform: 'uppercase', padding: '4px 0', opacity: 0.6,
          }}>
            {String.fromCharCode(8592)} Back
          </button>
        </div>
      )}

      {(askMode === 'own' || firstReading) && (
        <div key={shakeKey} style={{
          display: 'flex', gap: 8, marginBottom: askMode === 'own' && !firstReading ? 8 : 0,
          animationName: shakeKey > 0 ? 'elderShake' : 'none',
          animationDuration: '0.44s', animationTimingFunction: 'ease',
        }}>
          <input
            ref={inputRef} value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) consult(); }}
            disabled={loading}
            placeholder={loading ? 'The Elder is reading\u2026' : firstReading ? 'Continue the divination\u2026' : 'Speak freely\u2026'}
            style={{
              flex: 1, background: 'rgba(255,255,255,0.022)', border: '1px solid rgba(212,168,67,0.18)',
              color: C.bone, fontFamily: "'Gentium Plus',Georgia,serif", fontStyle: 'italic', fontSize: '1.02rem',
              padding: '11px 16px', outline: 'none', opacity: loading ? 0.5 : 1,
            }}
          />
          <button onClick={consult} disabled={loading} style={{
            background: 'transparent', border: `1px solid ${C.gold}`, color: C.gold,
            fontFamily: "'Gentium Plus',Georgia,serif", fontSize: '0.63rem', letterSpacing: '0.22em',
            padding: '11px 20px', cursor: loading ? 'not-allowed' : 'pointer',
            textTransform: 'uppercase', whiteSpace: 'nowrap', opacity: loading ? 0.32 : 1,
          }}>
            {loading ? '\u2026' : 'Consult'}
          </button>
        </div>
      )}

      {askMode === 'own' && !firstReading && !loading && (
        <button onClick={() => { setAskMode(null); setInput(''); }} style={{
          background: 'transparent', border: 'none', color: C.smoke,
          fontFamily: "'Gentium Plus',Georgia,serif", fontSize: '0.56rem', letterSpacing: '0.2em',
          cursor: 'pointer', textTransform: 'uppercase', padding: '4px 0', opacity: 0.6,
        }}>
          {String.fromCharCode(8592)} Back
        </button>
      )}

      {askMode === 'choose' && selectedQ && !firstReading && !loading && (
        <button onClick={consult} disabled={loading} style={{
          background: 'transparent', border: `1px solid ${C.gold}`, color: C.gold,
          fontFamily: "'Gentium Plus',Georgia,serif", fontSize: '0.63rem', letterSpacing: '0.22em',
          padding: '11px 20px', cursor: loading ? 'not-allowed' : 'pointer',
          textTransform: 'uppercase', whiteSpace: 'nowrap', display: 'block', margin: '4px auto 0',
        }}>
          Consult the Elder
        </button>
      )}

      {remaining !== null && remaining <= 3 && remaining > 0 && (
        <div style={{ fontSize: '0.55rem', color: C.ember, fontStyle: 'italic', marginTop: 9, opacity: 0.65 }}>
          {remaining} divination{remaining === 1 ? '' : 's'} remaining today.
        </div>
      )}

      {thread.length > 0 && (
        <div style={{ marginTop: 28 }}>
          <Divider symbol="◆" />
          {thread.map((entry, i) => (
            <div key={i} style={{
              marginBottom: 22, paddingLeft: 18, borderLeft: '2px solid rgba(212,168,67,0.10)',
              position: 'relative', animation: 'elderReveal 0.8s ease forwards',
            }}>
              <div style={{ position: 'absolute', left: -6, top: 4, color: C.gold, fontSize: '0.48rem' }}>◆</div>
              <div style={{ fontSize: '0.52rem', letterSpacing: '0.26em', color: C.smoke, textTransform: 'uppercase', marginBottom: 5 }}>The Seeker speaks</div>
              <div style={{ color: C.ash, fontSize: '0.88rem', fontStyle: 'italic', marginBottom: 12, lineHeight: 1.72 }}>{entry.seeker}</div>
              <div style={{ fontSize: '0.52rem', letterSpacing: '0.26em', color: C.ember, textTransform: 'uppercase', marginBottom: 7 }}>The Elder answers</div>
              <OracleText text={entry.elder} />
            </div>
          ))}
          <div ref={threadEndRef} />
          <button onClick={reset} style={{
            background: 'transparent', border: 'none', color: C.smoke,
            fontFamily: "'Gentium Plus',Georgia,serif", fontSize: '0.54rem', letterSpacing: '0.22em',
            cursor: 'pointer', textTransform: 'uppercase', padding: '10px 0',
            marginTop: 16, display: 'block', width: '100%', textAlign: 'center', opacity: 0.55,
          }}>
            ◇ &nbsp; Begin a New Divination &nbsp; ◇
          </button>
        </div>
      )}
    </div>
  );
}

// ─── MAIN EXPORT ──────────────────────────────────────────────────────────────

interface CouncilTabsProps {
  lineage: LineageKey;
  soundEnabled?: boolean;
  intensity?: number;
  pulse?: number;
  onReturn: () => void;
  priorMythContext?: string;
  signedIn?: boolean;
  narrativeRegister?: NarrativeRegister;
  birthDate?: string;
}

export default function CouncilTabs({ lineage, soundEnabled = false, intensity = 0, pulse = 0, onReturn, priorMythContext, signedIn, narrativeRegister, birthDate }: CouncilTabsProps) {
  const [activeTab, setActiveTab] = useState<TabId>('council');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const lin = LINEAGES[lineage];
  const accent = lin.palette.primary;

  // Each tab (council / mythology / archetypes) runs its own independent
  // fetch to /api/divine — none of them share Threshold's firePulse, so the
  // prop above never moves while any of them is actually being used. This
  // local pulse is what actually flares the fire when a question is asked
  // in any tab; combined with the inherited prop rather than replacing it.
  const [tabPulse, setTabPulse] = useState(0);
  const bumpFire = useCallback(() => setTabPulse(p => p + 1), []);
  const presence = usePresence();

  const advancedTabs: { id: TabId; label: string }[] = [
    { id: 'mythology',  label: 'Mythology'  },
    { id: 'archetypes', label: 'Archetypes' },
  ];

  return (
    <div style={{
      minHeight: '100vh', background: '#0a0806', color: '#ede0c4',
      fontFamily: "'Gentium Plus',Georgia,'Times New Roman',serif", position: 'relative', overflowX: 'hidden',
    }}>
      <FireAtmosphere soundEnabled={soundEnabled} intensity={intensity} pulse={pulse + tabPulse} presence={presence} />

      <div style={{ maxWidth: 700, margin: '0 auto', padding: '0 20px 90px', position: 'relative', zIndex: 1 }}>
        {/* Header */}
        <div style={{ textAlign: 'center', padding: '38px 0 24px' }}>
          <div style={{ fontSize: '0.62rem', letterSpacing: '0.4em', color: accent, textTransform: 'uppercase', marginBottom: 6 }}>
            {lin.tradition} &nbsp;·&nbsp; {lin.teacherTitle}
          </div>
          <div className="fire-shadow" style={{ fontFamily: "'Cormorant Garamond',Georgia,serif", fontSize: 'clamp(1.5rem,4vw,2.2rem)', color: C.gold, letterSpacing: '0.22em', }}>
            THE ELDER
          </div>
          <div style={{ fontStyle: 'italic', color: '#8a7a6a', fontSize: '0.78rem', marginTop: 6 }}>
            {lin.invocation}
          </div>
        </div>

        {/* Advanced tab strip — only shown once expanded */}
        {showAdvanced && (
          <div style={{ display: 'flex', borderBottom: '1px solid rgba(212,168,67,0.16)', marginBottom: 28 }}>
            {[{ id: 'council' as TabId, label: 'Council with The Elder' }, ...advancedTabs].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  flex: 1, background: 'transparent',
                  border: 'none',
                  borderBottom: activeTab === tab.id ? `2px solid ${accent}` : '2px solid transparent',
                  color: activeTab === tab.id ? C.paleGold : C.smoke,
                  fontFamily: "'Gentium Plus',Georgia,serif", fontSize: '0.7rem',
                  letterSpacing: '0.14em', padding: '12px 8px',
                  cursor: 'pointer', textTransform: 'uppercase',
                  transition: 'color 0.25s, border-color 0.25s',
                  marginBottom: -1,
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>
        )}

        {/* Tab content */}
        {activeTab === 'mythology'  && <MythologyTab  lineage={lineage} onAsk={bumpFire} />}
        {activeTab === 'archetypes' && <ArchetypesTab lineage={lineage} onAsk={bumpFire} />}
        {activeTab === 'council'    && <CouncilTab    lineage={lineage} priorMythContext={priorMythContext} signedIn={signedIn} soundEnabled={soundEnabled} onAsk={bumpFire} narrativeRegister={narrativeRegister} birthDate={birthDate} />}

        {/* Advanced toggle */}
        <div style={{ textAlign: 'center', marginTop: 26 }}>
          <button
            onClick={() => { setShowAdvanced(a => !a); if (showAdvanced) setActiveTab('council'); }}
            style={{
              background: 'transparent', border: 'none', color: '#8a7a6a',
              fontFamily: "'Gentium Plus',Georgia,serif", fontSize: '0.5rem', letterSpacing: '0.24em',
              cursor: 'pointer', textTransform: 'uppercase', opacity: 0.4,
            }}
          >
            {showAdvanced ? '◇ Hide deeper paths ◇' : '◇ Deeper paths: Mythology · Archetypes ◇'}
          </button>
        </div>

        {/* Return */}
        <div style={{ textAlign: 'center', marginTop: 48 }}>
          <button onClick={onReturn} style={{
            background: 'transparent', border: 'none', color: '#8a7a6a',
            fontFamily: "'Gentium Plus',Georgia,serif", fontSize: '0.52rem', letterSpacing: '0.26em',
            cursor: 'pointer', textTransform: 'uppercase', opacity: 0.48,
          }}>
            ◇ &nbsp; Return to the Threshold &nbsp; ◇
          </button>
        </div>

        {/* Footer */}
        <div style={{ textAlign: 'center', marginTop: 40, paddingTop: 22, borderTop: '1px solid rgba(212,168,67,0.07)' }}>
          <div style={{ fontSize: '0.56rem', letterSpacing: '0.26em', color: '#8a7a6a', textTransform: 'uppercase', opacity: 0.46, lineHeight: 2.2 }}>
            ✦ &nbsp; Temporal Bridges Institute &nbsp;·&nbsp; AHAU AI &nbsp; ✦
          </div>
        </div>
      </div>
    </div>
  );
}
