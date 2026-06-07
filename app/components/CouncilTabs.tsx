'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { LineageKey, LINEAGES } from '../../lib/lineages';
import { LINEAGE_ARCHETYPES, ArchetypeCard } from '../../lib/archetypes';
import OracleResponse from './OracleResponse';
import FireAtmosphere from './FireAtmosphere';

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
  if (!text) return null;
  const paras = text.split(/\n\n+/).filter(Boolean);
  return (
    <>
      {paras.map((para, i) => (
        <p key={i} style={{ marginBottom: i < paras.length - 1 ? 18 : 0, fontStyle: 'italic', lineHeight: 2.0, color: C.bone, fontSize: '1.12rem' }}>
          {para.split('\n').map((line, j, arr) => (
            <span key={j}>{line}{j < arr.length - 1 && <br />}</span>
          ))}
        </p>
      ))}
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
          color: C.bone, fontFamily: 'Georgia,serif', fontSize: '1rem',
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

function MythologyTab({ lineage }: { lineage: LineageKey }) {
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
                fontFamily: 'Georgia,serif', fontSize: '0.9rem',
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
          <div style={{ position: 'absolute', left: -6, top: 4, color: C.gold, fontSize: '0.48rem' }}>\u25c6</div>
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
            color: C.bone, fontFamily: 'Georgia,serif', fontStyle: 'italic', fontSize: '1.02rem',
            padding: '11px 16px', outline: 'none', opacity: loading ? 0.5 : 1,
          }}
        />
        <button
          onClick={ask}
          disabled={loading}
          style={{
            background: 'transparent', border: `1px solid ${accent}`,
            color: accent, fontFamily: 'Georgia,serif', fontSize: '0.63rem',
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

function ArchetypesTab({ lineage }: { lineage: LineageKey }) {
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
            ? 'Answer the three questions. The Elder will name what is active in you.'
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
                  color: C.bone, fontFamily: 'Georgia,serif', fontStyle: 'italic', fontSize: '0.98rem',
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
                color: accent, fontFamily: 'Georgia,serif', fontSize: '0.63rem',
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
          <Divider symbol="\u25c6" />
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
              fontFamily: 'Georgia,serif', fontSize: '0.54rem', letterSpacing: '0.22em',
              cursor: 'pointer', textTransform: 'uppercase', padding: '12px 0',
              marginTop: 18, display: 'block', width: '100%', textAlign: 'center', opacity: 0.55,
            }}
          >
            \u25c7 &nbsp; Return to the Questions &nbsp; \u25c7
          </button>
        </div>
      )}
    </div>
  );
}

// ─── TAB: COUNCIL (existing oracle flow) ──────────────────────────────────────

const COUNCIL_QUESTIONS = [
  { label: '"The same wound finds me, wherever I go."', text: 'I feel like I keep repeating the same pattern in my life \u2014 different people, different places, but the same wound finds me every time. What myth is living through me?' },
  { label: '"I was born for something I cannot yet name."', text: 'I have always felt I was born for something greater \u2014 a calling I cannot hear clearly, a purpose that eludes me. What myth am I living?' },
  { label: '"I am caught between two worlds, two selves."', text: 'I feel caught between two worlds \u2014 two identities, two loyalties, two ways of being. I do not know which one is truly me. What myth holds this tension?' },
  { label: '"I have descended. I am trying to find my way back."', text: 'I have experienced great loss \u2014 a death, a collapse, a shattering of the life I knew. I am in the dark and trying to understand what this descent means. What myth is this?' },
  { label: '"I feel nothing. I am numb to my own life."', text: 'I feel strangely disconnected from my own life \u2014 like I am watching it from a distance, unable to feel it fully. There is a numbness, a flatness. What myth lives in this emptiness?' },
];

function CouncilTab({ lineage }: { lineage: LineageKey }) {
  const lin = LINEAGES[lineage];
  const accent = lin.palette.primary;
  const [input, setInput] = useState('');
  const [selectedQ, setSelectedQ] = useState<typeof COUNCIL_QUESTIONS[number] | null>(null);
  const [history, setHistory] = useState<Message[]>([]);
  const [firstReading, setFirstReading] = useState<string | null>(null);
  const [thread, setThread] = useState<ThreadEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingText, setLoadingText] = useState(LOADING_LINES[0]);
  const [error, setError] = useState('');
  const [lastAttempt, setLastAttempt] = useState('');
  const [shakeKey, setShakeKey] = useState(0);
  const [remaining, setRemaining] = useState<number | null>(null);
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

  const runConsult = useCallback(async (userText: string, currentHistory: Message[]) => {
    const saved = currentHistory;
    const next: Message[] = [...currentHistory, { role: 'user', content: userText }];
    setLoading(true);
    setError('');
    startCycle();
    try {
      const res = await fetch('/api/divine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: next, lineageKey: lineage, mode: 'council' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      const elderText: string = data.text;
      const full: Message[] = [...next, { role: 'assistant', content: elderText }];
      setHistory(full);
      if (typeof data.remaining === 'number') setRemaining(data.remaining);
      if (!firstReading) {
        setFirstReading(elderText);
      } else {
        setThread(t => [...t, { seeker: userText, elder: elderText }]);
        setTimeout(() => threadEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 120);
      }
      setInput('');
      setSelectedQ(null);
      setLastAttempt('');
    } catch (err: any) {
      setHistory(saved);
      setError(err?.message || 'Unknown error');
    } finally {
      stopCycle();
      setLoading(false);
    }
  }, [lineage, firstReading, startCycle, stopCycle]);

  const consult = useCallback(() => {
    const text = input.trim() || selectedQ?.text || '';
    if (!text) { setShakeKey(k => k + 1); inputRef.current?.focus(); return; }
    setLastAttempt(text);
    runConsult(text, history);
  }, [input, selectedQ, history, runConsult]);

  const reset = useCallback(() => {
    stopCycle();
    setHistory([]);
    setFirstReading(null);
    setThread([]);
    setInput('');
    setSelectedQ(null);
    setError('');
    setLastAttempt('');
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
                <button onClick={() => runConsult(lastAttempt, history)} style={{
                  background: 'transparent', border: `1px solid ${C.blood}`, color: C.blood,
                  fontFamily: 'Georgia,serif', fontSize: '0.61rem', letterSpacing: '0.2em',
                  padding: '8px 18px', cursor: 'pointer', textTransform: 'uppercase',
                }}>Try Again</button>
              )}
            </div>
          )}
          {firstReading && !loading && (
            <div style={{ animation: 'elderReveal 1.1s ease forwards' }}>
              <OracleResponse
                text={firstReading}
                lineageKey={lineage}
                onAskAgain={() => { setFirstReading(null); setHistory([]); setTimeout(() => inputRef.current?.focus(), 100); }}
              />
            </div>
          )}
        </div>
      </div>

      {!firstReading && !loading && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 8, marginBottom: 12 }}>
          {COUNCIL_QUESTIONS.map((q, i) => (
            <button key={i} onClick={() => { setSelectedQ(p => p?.text === q.text ? null : q); setInput(''); }}
              style={{
                background: selectedQ?.text === q.text ? 'rgba(212,168,67,0.05)' : 'transparent',
                border: `1px solid ${selectedQ?.text === q.text ? C.gold : 'rgba(212,168,67,0.17)'}`,
                color: selectedQ?.text === q.text ? C.paleGold : C.ash,
                fontFamily: 'Georgia,serif', fontSize: '0.9rem', padding: '10px 13px',
                cursor: 'pointer', textAlign: 'left', lineHeight: 1.5, fontStyle: 'italic',
                transition: 'border-color 0.25s, color 0.25s',
              }}
            >{q.label}</button>
          ))}
        </div>
      )}

      <div key={shakeKey} style={{
        display: 'flex', gap: 8,
        animationName: shakeKey > 0 ? 'elderShake' : 'none',
        animationDuration: '0.44s', animationTimingFunction: 'ease',
      }}>
        <input
          ref={inputRef} value={input}
          onChange={e => { setInput(e.target.value); if (e.target.value) setSelectedQ(null); }}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) consult(); }}
          disabled={loading}
          placeholder={loading ? 'The Elder is reading\u2026' : firstReading ? 'Continue the divination\u2026' : selectedQ ? 'Selected above \u2014 or write your own\u2026' : 'Speak freely\u2026'}
          style={{
            flex: 1, background: 'rgba(255,255,255,0.022)', border: '1px solid rgba(212,168,67,0.18)',
            color: C.bone, fontFamily: 'Georgia,serif', fontStyle: 'italic', fontSize: '1.02rem',
            padding: '11px 16px', outline: 'none', opacity: loading ? 0.5 : 1,
          }}
        />
        <button onClick={consult} disabled={loading} style={{
          background: 'transparent', border: `1px solid ${C.gold}`, color: C.gold,
          fontFamily: 'Georgia,serif', fontSize: '0.63rem', letterSpacing: '0.22em',
          padding: '11px 20px', cursor: loading ? 'not-allowed' : 'pointer',
          textTransform: 'uppercase', whiteSpace: 'nowrap', opacity: loading ? 0.32 : 1,
        }}>
          {loading ? '\u2026' : 'Consult'}
        </button>
      </div>

      {remaining !== null && remaining <= 3 && remaining > 0 && (
        <div style={{ fontSize: '0.55rem', color: C.ember, fontStyle: 'italic', marginTop: 9, opacity: 0.65 }}>
          {remaining} divination{remaining === 1 ? '' : 's'} remaining today.
        </div>
      )}

      {thread.length > 0 && (
        <div style={{ marginTop: 28 }}>
          <Divider symbol="\u25c6" />
          {thread.map((entry, i) => (
            <div key={i} style={{
              marginBottom: 22, paddingLeft: 18, borderLeft: '2px solid rgba(212,168,67,0.10)',
              position: 'relative', animation: 'elderReveal 0.8s ease forwards',
            }}>
              <div style={{ position: 'absolute', left: -6, top: 4, color: C.gold, fontSize: '0.48rem' }}>\u25c6</div>
              <div style={{ fontSize: '0.52rem', letterSpacing: '0.26em', color: C.smoke, textTransform: 'uppercase', marginBottom: 5 }}>The Seeker speaks</div>
              <div style={{ color: C.ash, fontSize: '0.88rem', fontStyle: 'italic', marginBottom: 12, lineHeight: 1.72 }}>{entry.seeker}</div>
              <div style={{ fontSize: '0.52rem', letterSpacing: '0.26em', color: C.ember, textTransform: 'uppercase', marginBottom: 7 }}>The Elder answers</div>
              <OracleText text={entry.elder} />
            </div>
          ))}
          <div ref={threadEndRef} />
          <button onClick={reset} style={{
            background: 'transparent', border: 'none', color: C.smoke,
            fontFamily: 'Georgia,serif', fontSize: '0.54rem', letterSpacing: '0.22em',
            cursor: 'pointer', textTransform: 'uppercase', padding: '10px 0',
            marginTop: 16, display: 'block', width: '100%', textAlign: 'center', opacity: 0.55,
          }}>
            \u25c7 &nbsp; Begin a New Divination &nbsp; \u25c7
          </button>
        </div>
      )}
    </div>
  );
}

// ─── MAIN EXPORT ──────────────────────────────────────────────────────────────

interface CouncilTabsProps {
  lineage: LineageKey;
  onReturn: () => void;
}

export default function CouncilTabs({ lineage, onReturn }: CouncilTabsProps) {
  const [activeTab, setActiveTab] = useState<TabId>('mythology');
  const lin = LINEAGES[lineage];
  const accent = lin.palette.primary;

  const tabs: { id: TabId; label: string }[] = [
    { id: 'mythology',  label: 'Mythology'            },
    { id: 'archetypes', label: 'Archetypes'            },
    { id: 'council',    label: 'Council with The Elder' },
  ];

  return (
    <div style={{
      minHeight: '100vh', background: '#0a0806', color: '#ede0c4',
      fontFamily: "Georgia,'Times New Roman',serif", position: 'relative', overflowX: 'hidden',
    }}>
      <FireAtmosphere />

      <div style={{ maxWidth: 700, margin: '0 auto', padding: '0 20px 90px', position: 'relative', zIndex: 1 }}>
        {/* Header */}
        <div style={{ textAlign: 'center', padding: '38px 0 24px' }}>
          <div style={{ fontSize: '0.62rem', letterSpacing: '0.4em', color: accent, textTransform: 'uppercase', marginBottom: 6 }}>
            {lin.tradition} &nbsp;\u00b7&nbsp; {lin.teacherTitle}
          </div>
          <div style={{ fontFamily: "'Cinzel Decorative','Cinzel',Georgia,serif", fontSize: 'clamp(1.5rem,4vw,2.2rem)', color: C.gold, letterSpacing: '0.22em', textShadow: '0 0 50px rgba(212,168,67,0.32)' }}>
            THE ELDER
          </div>
          <div style={{ fontStyle: 'italic', color: '#8a7a6a', fontSize: '0.78rem', marginTop: 6 }}>
            {lin.invocation}
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid rgba(212,168,67,0.16)', marginBottom: 28 }}>
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                flex: 1, background: 'transparent',
                border: 'none',
                borderBottom: activeTab === tab.id ? `2px solid ${accent}` : '2px solid transparent',
                color: activeTab === tab.id ? C.paleGold : C.smoke,
                fontFamily: 'Georgia,serif', fontSize: '0.72rem',
                letterSpacing: '0.18em', padding: '12px 8px',
                cursor: 'pointer', textTransform: 'uppercase',
                transition: 'color 0.25s, border-color 0.25s',
                marginBottom: -1,
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {activeTab === 'mythology'  && <MythologyTab  lineage={lineage} />}
        {activeTab === 'archetypes' && <ArchetypesTab lineage={lineage} />}
        {activeTab === 'council'    && <CouncilTab    lineage={lineage} />}

        {/* Return */}
        <div style={{ textAlign: 'center', marginTop: 48 }}>
          <button onClick={onReturn} style={{
            background: 'transparent', border: 'none', color: '#8a7a6a',
            fontFamily: 'Georgia,serif', fontSize: '0.52rem', letterSpacing: '0.26em',
            cursor: 'pointer', textTransform: 'uppercase', opacity: 0.48,
          }}>
            \u25c7 &nbsp; Return to the Threshold &nbsp; \u25c7
          </button>
        </div>

        {/* Footer */}
        <div style={{ textAlign: 'center', marginTop: 40, paddingTop: 22, borderTop: '1px solid rgba(212,168,67,0.07)' }}>
          <div style={{ fontSize: '0.56rem', letterSpacing: '0.26em', color: '#8a7a6a', textTransform: 'uppercase', opacity: 0.46, lineHeight: 2.2 }}>
            \u2726 &nbsp; Temporal Bridges Institute &nbsp;\u00b7\u00b7&nbsp; AHAU AI &nbsp; \u2726
          </div>
        </div>
      </div>
    </div>
  );
}
