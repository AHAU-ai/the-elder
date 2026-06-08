'use client'; // v-council

import { useState, useRef, useEffect, useCallback } from 'react';
import LineageSelector from '../LineageSelector';
import { LineageKey, LINEAGES } from '../../lib/lineages';
import { buildSystemPrompt } from '../../lib/system-prompt-builder';
import OracleResponse from './OracleResponse';
import CouncilTabs from './CouncilTabs';
import { initTouchEmbers, initQuestionPulse, initPlaceholderCycle, watchConsultReady, initScrollFire, applyFirstFlicker, setMultilingualLang, playLineageTone } from './enhancements';
import FireAtmosphere from './FireAtmosphere';
import LanguageToggle from './LanguageToggle';
import { useLanguage } from '../../lib/i18n/LanguageContext';

// ─── PALETTE ──────────────────────────────────────────────────────────────────
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

// ─── THRESHOLD QUESTIONS ──────────────────────────────────────────────────────
const QUESTIONS = [
  {
    label: '"The same wound finds me, wherever I go."',
    text: 'I feel like I keep repeating the same pattern in my life — different people, different places, but the same wound finds me every time. What myth is living through me?',
  },
  {
    label: '"I was born for something I cannot yet name."',
    text: 'I have always felt I was born for something greater — a calling I cannot hear clearly, a purpose that eludes me. What myth am I living?',
  },
  {
    label: '"I am caught between two worlds, two selves."',
    text: 'I feel caught between two worlds — two identities, two loyalties, two ways of being. I do not know which one is truly me. What myth holds this tension?',
  },
  {
    label: '"I have descended. I am trying to find my way back."',
    text: 'I have experienced great loss — a death, a collapse, a shattering of the life I knew. I am in the dark and trying to understand what this descent means. What myth is this?',
  },
  {
    label: '"I feel nothing. I am numb to my own life."',
    text: 'I feel strangely disconnected from my own life — like I am watching it from a distance, unable to feel it fully. There is a numbness, a flatness. What myth lives in this emptiness?',
  },
];

const LOADING_LINES = [
  'The Elder reads the patterns in the fire…',
  'The myth is being named…',
  'The archetypes stir in the smoke…',
  'The Seer gazes into what lives through you…',
  'The fire speaks in shapes…',
  'What is hidden rises to the surface…',
];

type Question = typeof QUESTIONS[number];
type Phase = 'entry-gate' | 'lineage-select' | 'council' | 'idle' | 'loading' | 'reading' | 'thread' | 'error';
type Message = { role: 'user' | 'assistant'; content: string };
type ThreadEntry = { seeker: string; elder: string };

// ─── SUB-COMPONENTS ───────────────────────────────────────────────────────────
function Divider({ symbol = '✦' }: { symbol?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, margin: '18px 0', opacity: 0.38 }}>
      <div style={{ flex: 1, height: 1, background: `linear-gradient(90deg,transparent,${C.gold},transparent)` }} />
      <span style={{ color: C.gold, fontSize: '0.9rem' }}>{symbol}</span>
      <div style={{ flex: 1, height: 1, background: `linear-gradient(90deg,transparent,${C.gold},transparent)` }} />
    </div>
  );
}

function ElderEye() {
  return (
    <svg
      viewBox="0 0 70 70"
      fill="none"
      width="64"
      height="64"
      style={{
        display: 'block',
        margin: '0 auto 20px',
        filter: `drop-shadow(0 0 12px ${C.gold}) drop-shadow(0 0 28px rgba(212,168,67,0.22))`,
      }}
    >
      <circle cx="35" cy="35" r="32" stroke={C.gold} strokeWidth="0.5" strokeDasharray="4 6" opacity="0.35" />
      <circle cx="35" cy="35" r="22" stroke={C.gold} strokeWidth="0.3" strokeDasharray="2 8" opacity="0.18" />
      <path d="M4 35 Q35 7 66 35 Q35 63 4 35Z" stroke={C.gold} strokeWidth="1.2" fill="rgba(212,168,67,0.03)" />
      <circle cx="35" cy="35" r="10" stroke={C.ember} strokeWidth="1" fill="rgba(200,96,26,0.07)" />
      <circle cx="35" cy="35" r="5" fill={C.gold} opacity="0.92" />
      <circle cx="35" cy="35" r="2.2" fill="#050302" />
      {([[35, 20, 35, 15], [35, 50, 35, 55], [20, 35, 15, 35], [50, 35, 55, 35]] as const).map(
        ([x1, y1, x2, y2], i) => (
          <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={C.gold} strokeWidth="0.6" opacity="0.42" />
        )
      )}
    </svg>
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
          <span
            key={i}
            style={{
              display: 'inline-block',
              width: 7,
              height: 7,
              borderRadius: '50%',
              background: bg,
              animationName: 'elderBob',
              animationDuration: '1.6s',
              animationTimingFunction: 'ease-in-out',
              animationIterationCount: 'infinite',
              animationDelay: `${i * 0.28}s`,
            }}
          />
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
        <p
          key={i}
          style={{
            marginBottom: i < paras.length - 1 ? 18 : 0,
            fontStyle: 'italic',
            lineHeight: 2.0,
            color: C.bone,
            fontSize: '1.12rem',
          }}
        >
          {para.split('\n').map((line, j, arr) => (
            <span key={j}>
              {line}
              {j < arr.length - 1 && <br />}
            </span>
          ))}
        </p>
      ))}
    </>
  );
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
export default function Threshold() {
  const { t, languageName } = useLanguage();
  const [phase,        setPhase]        = useState<Phase>('entry-gate');
  // ── observability refs (anonymous, no PII) ──
  const _sid = useRef(typeof crypto !== 'undefined' ? crypto.randomUUID() : Math.random().toString(36).slice(2))
  const _t0  = useRef(Date.now())
  const _exc = useRef(0)
  const _rdg = useRef(false)
  const _lin = useRef('unknown')

  const _log = (completed: boolean) => {
    if (_exc.current === 0) return
    fetch('/api/log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: _sid.current,
        lineage: _lin.current,
        exchangeCount: _exc.current,
        readingTriggered: _rdg.current,
        readingCompleted: completed,
        durationSeconds: Math.round((Date.now() - _t0.current) / 1000),
        crisisFlag: false,
      }),
    }).catch(() => {})
  }

  useEffect(() => {
    const _bye = () => _log(false)
    window.addEventListener('beforeunload', _bye)
    return () => window.removeEventListener('beforeunload', _bye)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useEffect(() => {
    if (typeof lineage === 'string') _lin.current = lineage
    else if (lineage?.name) _lin.current = lineage.name
    else if (lineage?.id)   _lin.current = lineage.id
  }, [lineage])


  const [history,      setHistory]      = useState<Message[]>([]);
  const [firstReading, setFirstReading] = useState<string | null>(null);
  const [thread,       setThread]       = useState<ThreadEntry[]>([]);
  const [input,        setInput]        = useState('');
  const [showMirror,   setShowMirror]   = useState(false);
  const [inputReady,   setInputReady]   = useState(false);
  const [selectedQ,    setSelectedQ]    = useState<Question | null>(null);
  const [loadingText,  setLoadingText]  = useState(LOADING_LINES[0]);
  const [errorMsg,     setErrorMsg]     = useState('');
  const [lastAttempt,  setLastAttempt]  = useState('');
  const [shakeKey,     setShakeKey]     = useState(0);
  const [lineage,      setLineage]      = useState<LineageKey>('default');
  const [thresholdQ,   setThresholdQ]   = useState<string | null>(null);
  const [remaining,    setRemaining]    = useState<number | null>(null);
  const [readyToRead,  setReadyToRead]  = useState<boolean>(false);

  const [soundEnabled, setSoundEnabled] = useState(false);

  const threadEndRef = useRef<HTMLDivElement>(null);
  const intervalRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const inputRef      = useRef<HTMLInputElement>(null);
  const consultBtnRef = useRef<HTMLButtonElement>(null);
  const titleRef      = useRef<HTMLDivElement>(null);
  const rootRef       = useRef<HTMLDivElement>(null);

  useEffect(() => () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
  }, []);

  useEffect(() => {
    setMultilingualLang();
    applyFirstFlicker(titleRef.current);
    const c1 = initTouchEmbers();
    const c2 = initScrollFire(rootRef.current);
    const c3 = initQuestionPulse('.elder-q-card');
    const c4 = initPlaceholderCycle(inputRef.current);
    const c5 = watchConsultReady(inputRef.current, consultBtnRef.current);
    return () => { c1(); c2(); c3(); c4(); c5(); };
  }, []);

  const stopLoading = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = null;
  }, []);

  const startLoadingCycle = useCallback(() => {
    setLoadingText(LOADING_LINES[0]);
    let idx = 0;
    intervalRef.current = setInterval(() => {
      idx = (idx + 1) % LOADING_LINES.length;
      setLoadingText(LOADING_LINES[idx]);
    }, 2200);
  }, []);

  const runConsult = useCallback(
    async (userText: string, currentHistory: Message[], isFirst: boolean, isReadingMode: boolean = false) => {
      const savedHistory = currentHistory;
      const nextHistory: Message[] = [...currentHistory, { role: 'user', content: userText }];

      setPhase('loading');
      setErrorMsg('');
      startLoadingCycle();

      try {
        _exc.current += 1
        const res = await fetch('/api/divine', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages: nextHistory, lineageKey: lineage, mode: isReadingMode ? 'reading' : 'questioning' }),
        });

        const raw = await res.text();
        let data: any;
        try {
          data = JSON.parse(raw);
        } catch {
          throw new Error(`Server returned non-JSON (HTTP ${res.status}): ${raw.slice(0, 200)}`);
        }

        if (!res.ok) {
          throw new Error(data?.error || `HTTP ${res.status}`);
        }

        const elderText: string = data.text;
        if (!elderText) throw new Error('The response contained no text.');

        if (typeof data.remaining === 'number') {
          setRemaining(data.remaining);
        }
        if (data.readyToRead) {
          setReadyToRead(true);
        }

        const fullHistory: Message[] = [
          ...nextHistory,
          { role: 'assistant', content: elderText },
        ];
        setHistory(fullHistory);

        if (isFirst) {
          setFirstReading(elderText);
          _rdg.current = true
          setPhase('reading');
        } else {
          setThread(t => [...t, { seeker: userText, elder: elderText }]);
          _rdg.current = true; _log(true)
          setPhase('thread');
          setTimeout(
            () => threadEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
            120
          );
        }

        setInput('');
        setSelectedQ(null);
        setLastAttempt('');
      } catch (err: any) {
        setHistory(savedHistory);
        setErrorMsg(err?.message || 'Unknown error');
        setPhase('error');
      } finally {
        stopLoading();
      }
    },
    [startLoadingCycle, stopLoading, languageName, lineage]
  );

  const consult = useCallback(() => {
    if (phase === 'loading') return;
    const userText = input.trim() || selectedQ?.text || '';
    if (!userText) {
      setShakeKey(k => k + 1);
      inputRef.current?.focus();
      return;
    }
    setLastAttempt(userText);
    runConsult(userText, history, !firstReading, readyToRead && !firstReading);
  }, [phase, input, selectedQ, firstReading, history, runConsult]);

  const retry = useCallback(() => {
    if (lastAttempt) runConsult(lastAttempt, history, !firstReading);
  }, [lastAttempt, firstReading, history, runConsult]);

  const reset = useCallback(() => {
    stopLoading();
    setPhase('idle');
    setHistory([]);
    setFirstReading(null);
    setThread([]);
    setInput('');
    setSelectedQ(null);
    setErrorMsg('');
    setLastAttempt('');
    setReadyToRead(false);
  }, [stopLoading]);

  const isLoading  = phase === 'loading';
  const hasReading = phase === 'reading' || phase === 'thread';
  const isError    = phase === 'error';
  const isIdle     = phase === 'idle';

  const qBtnStyle = (q: Question): React.CSSProperties => ({
    background:
      selectedQ?.text === q.text ? 'rgba(212,168,67,0.05)' : 'transparent',
    border: `1px solid ${selectedQ?.text === q.text ? C.gold : 'rgba(212,168,67,0.17)'}`,
    color: selectedQ?.text === q.text ? C.paleGold : C.ash,
    fontFamily: 'Georgia,serif',
    fontSize: '0.9rem',
    padding: '10px 13px',
    cursor: 'pointer',
    textAlign: 'left',
    lineHeight: 1.5,
    fontStyle: 'italic',
    transition: 'border-color 0.25s, color 0.25s, background 0.25s',
  });

  const activePalette = LINEAGES[lineage].palette;

  if (phase === 'council') {
    return (
      <CouncilTabs
        lineage={lineage}
        soundEnabled={soundEnabled}
        onReturn={() => setPhase('lineage-select')}
      />
    );
  }

  if (phase === 'entry-gate') {
    return (
      <div style={{
        minHeight: '100vh',
        background: '#0a0806',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: "'Cormorant Garamond', Georgia, 'Times New Roman', serif",
        position: 'relative',
        overflow: 'hidden',
      }}>
        <FireAtmosphere soundEnabled={false} />
        <div style={{ position: 'relative', zIndex: 1, textAlign: 'center', padding: '0 32px' }}>
          <ElderEye />
          <div className="fire-shadow" style={{
            fontFamily: "'Cinzel Decorative', 'Cinzel', Georgia, serif",
            fontSize: 'clamp(1.8rem, 4.5vw, 2.8rem)',
            color: '#d4a843',
            letterSpacing: '0.24em',
            marginBottom: 10,
            textShadow: '0 0 50px rgba(212,168,67,0.32)',
          }}>
            THE ELDER
          </div>
          <div className="fire-shadow" style={{
            fontFamily: "'Cinzel', Georgia, serif",
            fontSize: '0.68rem',
            letterSpacing: '0.4em',
            color: '#8a7a6a',
            textTransform: 'uppercase',
            marginBottom: 48,
          }}>
            {t.threshold_subtitle}
          </div>
          <div style={{
            fontStyle: 'italic',
            color: '#c4b89a',
            fontSize: '1.05rem',
            lineHeight: 2.0,
            marginBottom: 52,
            opacity: 0.85,
          }}>
            You are about to cross a threshold.
          </div>
          <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button
              onClick={() => { setSoundEnabled(true); setPhase('lineage-select'); }}
              style={{
                background: 'transparent',
                border: '1px solid rgba(212,168,67,0.55)',
                color: '#d4a843',
                fontFamily: 'Georgia, serif',
                fontSize: '0.72rem',
                letterSpacing: '0.26em',
                padding: '14px 32px',
                cursor: 'pointer',
                textTransform: 'uppercase',
                transition: 'border-color 0.3s, color 0.3s',
              }}
            >
              Enter with Fire
            </button>
            <button
              onClick={() => { setSoundEnabled(false); setPhase('lineage-select'); }}
              style={{
                background: 'transparent',
                border: '1px solid rgba(196,184,154,0.25)',
                color: '#8a7a6a',
                fontFamily: 'Georgia, serif',
                fontSize: '0.72rem',
                letterSpacing: '0.26em',
                padding: '14px 32px',
                cursor: 'pointer',
                textTransform: 'uppercase',
                transition: 'border-color 0.3s, color 0.3s',
              }}
            >
              Enter in Silence
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (phase === 'lineage-select') {
    return (
      <div style={{
        minHeight: '100vh',
        background: '#0a0806',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: "'Cormorant Garamond', Georgia, 'Times New Roman', serif",
      }}>
        <FireAtmosphere soundEnabled={soundEnabled} />
        <div style={{ textAlign: 'center', marginBottom: 40, padding: '0 20px' }}>
          <div className="fire-shadow" style={{
            fontFamily: "'Cinzel Decorative', 'Cinzel', Georgia, serif",
            fontSize: 'clamp(1.8rem, 4.5vw, 2.8rem)',
            color: '#d4a843',
            letterSpacing: '0.24em',
            marginBottom: 10,
            textShadow: '0 0 50px rgba(212,168,67,0.32)',
          }}>
            THE ELDER
          </div>
          <div className="fire-shadow" style={{
            fontFamily: "'Cinzel', Georgia, serif",
            fontSize: '0.68rem',
            letterSpacing: '0.4em',
            color: '#8a7a6a',
            textTransform: 'uppercase',
          }}>
            Myth Diviner · Seer · Soothsayer
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 28 }}>
          <LanguageToggle />
        </div>
        <LineageSelector
          onSelect={(key, question) => {
            setLineage(key);
            setThresholdQ(question);
            setPhase('council');
          }}
        />
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: C.obsidian,
        color: C.bone,
        fontFamily: "Georgia,'Times New Roman',serif",
        position: 'relative',
        overflowX: 'hidden',
      }}
    >
      <FireAtmosphere soundEnabled={soundEnabled} />

      <div
        style={{
          maxWidth: 700,
          margin: '0 auto',
          padding: '0 20px 90px',
          position: 'relative',
          zIndex: 1,
        }}
      >
        {/* ── HEADER ── */}
        <div style={{ textAlign: 'center', padding: '54px 0 34px' }}>
          <ElderEye />
          <div
            style={{
              fontSize: 'clamp(1.9rem,5vw,2.9rem)',
              color: C.gold,
              fontWeight: 400,
              letterSpacing: '0.22em',
              marginBottom: 9,
              textShadow: '0 0 50px rgba(212,168,67,0.32), 0 0 100px rgba(212,168,67,0.10)',
            }}
          >
            THE ELDER
          </div>
          <div
            style={{
              fontSize: '0.76rem',
              letterSpacing: '0.32em',
              color: C.ash,
              textTransform: 'uppercase',
              marginBottom: 22,
            }}
          >
            Myth Diviner &nbsp;·&nbsp; Seer &nbsp;·&nbsp; Soothsayer
          </div>
          <Divider />
          <p
            style={{
              fontStyle: 'italic',
              color: C.paleGold,
              fontSize: '1.05rem',
              lineHeight: 2.0,
              maxWidth: 480,
              margin: '0 auto',
              textAlign: 'center',
            }}
          >
            You did not choose your myth.
            <br />
            Your myth chose you.
            <br />
            Speak truthfully — and the pattern living through your life
            <br />
            shall be named. In naming, it becomes navigable.
          </p>
        </div>

        {/* ── ORACLE WINDOW ── */}
        <div
          style={{
            background: 'rgba(8,6,4,0.93)',
            border: `1px solid ${
              hasReading
                ? 'rgba(212,168,67,0.42)'
                : isError
                ? 'rgba(122,26,26,0.4)'
                : 'rgba(212,168,67,0.16)'
            }`,
            position: 'relative',
            marginBottom: 16,
            minHeight: 190,
            transition: 'border-color 0.6s ease, box-shadow 0.6s ease',
            boxShadow: hasReading ? '0 0 40px rgba(212,168,67,0.04)' : 'none',
          }}
        >
          <OracleCorners />
          <div
            style={{
              padding: '32px 42px',
              minHeight: 190,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
            }}
          >
            {isIdle && showMirror && LINEAGES[lineage]?.lineageGreeting && (
              <div
                key={lineage}
                style={{
                  textAlign: 'center',
                  fontStyle: 'italic',
                  fontSize: '1.1rem',
                  lineHeight: 2.0,
                  color: 'rgba(212,168,67,0.85)',
                  padding: '2rem 0 1rem',
                  animation: 'mirrorRise 3s ease forwards',
                }}
              >
                {LINEAGES[lineage].lineageGreeting}
              </div>
            )}
            {isIdle && inputReady && (
              <div
                style={{
                  textAlign: 'center',
                  color: C.ash,
                  fontStyle: 'italic',
                  fontSize: '1.05rem',
                  lineHeight: 1.9,
                  opacity: 0.82,
                }}
              >
                The fire sees you.
                <br />
                Select a question below — or speak your own truth —
                <br />
                and the Elder shall read the myth moving through your life.
              </div>
            )}

            {isLoading && <EmberDots text={loadingText} />}

            {isError && (
              <div style={{ textAlign: 'center', animation: 'elderReveal 0.5s ease forwards' }}>
                <div
                  style={{
                    color: C.blood,
                    fontStyle: 'italic',
                    fontSize: '0.93rem',
                    marginBottom: 10,
                  }}
                >
                  The fire dims. The Elder cannot be reached at this moment.
                </div>
                <div
                  style={{
                    color: 'rgba(122,26,26,0.75)',
                    fontSize: '0.71rem',
                    wordBreak: 'break-word',
                    maxWidth: 440,
                    margin: '0 auto 16px',
                    lineHeight: 1.65,
                  }}
                >
                  {errorMsg}
                </div>
                {lastAttempt && (
                  <button
                    onClick={retry}
                    style={{
                      background: 'transparent',
                      border: `1px solid ${C.blood}`,
                      color: C.blood,
                      fontFamily: 'Georgia,serif',
                      fontSize: '0.61rem',
                      letterSpacing: '0.2em',
                      padding: '8px 18px',
                      cursor: 'pointer',
                      textTransform: 'uppercase',
                    }}
                  >
                    Try Again
                  </button>
                )}
              </div>
            )}

            {hasReading && firstReading && !isLoading && (
              <div style={{ animation: 'elderReveal 1.1s ease forwards' }}>
                <OracleResponse
                  text={firstReading}
                  lineageKey={lineage}
                  onAskAgain={() => { setPhase("idle"); setFirstReading(null); setTimeout(() => inputRef.current?.focus(), 100); }}
                />
              </div>
            )}
          </div>
        </div>

        {/* ── INPUT SECTION ── */}
        <div>
          <div
            style={{
              fontSize: '0.59rem',
              letterSpacing: '0.28em',
              color: C.smoke,
              textTransform: 'uppercase',
              marginBottom: 11,
              opacity: 0.78,
            }}
          >
            {hasReading
              ? 'Continue the divination:'
              : 'Speak your truth — or choose a threshold question:'}
          </div>

          {!hasReading && !isLoading && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))',
                gap: 8,
                marginBottom: 12,
              }}
            >
              {QUESTIONS.map((q, i) => (
                <button
                  key={i}
                  onClick={() => {
                    setSelectedQ(p => (p?.text === q.text ? null : q));
                    setInput('');
                  }}
                  className="elder-q-card"
                  style={qBtnStyle(q)}
                >
                  {q.label}
                </button>
              ))}
            </div>
          )}

          <div
            key={shakeKey}
            style={{
              display: 'flex',
              gap: 8,
              animationName: shakeKey > 0 ? 'elderShake' : 'none',
              animationDuration: '0.44s',
              animationTimingFunction: 'ease',
            }}
          >
            <input
              ref={inputRef}
              value={input}
              onChange={e => {
                setInput(e.target.value);
                if (e.target.value) setSelectedQ(null);
              }}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) consult();
              }}
              disabled={isLoading}
              placeholder={
                isLoading
                  ? 'The Elder is reading…'
                  : hasReading
                  ? 'Respond to the Elder, or ask what more you would know…'
                  : selectedQ
                  ? 'Selected above — or write your own words here…'
                  : 'Or speak freely: describe what you are living through…'
              }
              style={{
                flex: 1,
                background: 'rgba(255,255,255,0.022)',
                border: '1px solid rgba(212,168,67,0.18)',
                color: C.bone,
                fontFamily: 'Georgia,serif',
                fontStyle: 'italic',
                fontSize: '1.02rem',
                padding: '11px 16px',
                outline: 'none',
                opacity: isLoading ? 0.5 : 1,
                transition: 'opacity 0.3s',
              }}
            />
            <button
              ref={consultBtnRef}
              onClick={consult}
              disabled={isLoading}
              aria-label="Consult the Elder"
              style={{
                background: 'transparent',
                border: `1px solid ${C.gold}`,
                color: C.gold,
                fontFamily: 'Georgia,serif',
                fontSize: '0.63rem',
                letterSpacing: '0.22em',
                padding: '11px 20px',
                cursor: isLoading ? 'not-allowed' : 'pointer',
                textTransform: 'uppercase',
                whiteSpace: 'nowrap',
                opacity: isLoading ? 0.32 : 1,
                transition: 'opacity 0.25s',
              }}
            >
              {isLoading ? '…' : 'Consult'}
            </button>
          </div>

          {isIdle && !selectedQ && !input && (
            <div
              style={{
                fontSize: '0.57rem',
                color: C.smoke,
                fontStyle: 'italic',
                marginTop: 7,
                opacity: 0.48,
                paddingLeft: 2,
              }}
            >
              Choose a question above, or speak your own truth in the field.
            </div>
          )}

          {remaining !== null && remaining <= 3 && remaining > 0 && (
            <div
              style={{
                fontSize: '0.55rem',
                color: C.ember,
                fontStyle: 'italic',
                marginTop: 9,
                opacity: 0.65,
                letterSpacing: '0.04em',
              }}
            >
              {remaining} divination{remaining === 1 ? '' : 's'} remaining today.
            </div>
          )}
        </div>

        {/* ── CONVERSATION THREAD ── */}
        {thread.length > 0 && (
          <div style={{ marginTop: 32 }}>
            <Divider symbol="◆" />
            <div
              style={{
                textAlign: 'center',
                fontSize: '0.54rem',
                letterSpacing: '0.3em',
                color: C.smoke,
                textTransform: 'uppercase',
                marginBottom: 22,
                opacity: 0.48,
              }}
            >
              The Divination Continues
            </div>

            {thread.map((entry, i) => (
              <div
                key={i}
                style={{
                  marginBottom: 26,
                  paddingLeft: 20,
                  position: 'relative',
                  borderLeft: '2px solid rgba(212,168,67,0.10)',
                  animation: 'elderReveal 0.8s ease forwards',
                }}
              >
                <div
                  style={{
                    position: 'absolute',
                    left: -7,
                    top: 4,
                    color: C.gold,
                    fontSize: '0.48rem',
                  }}
                >
                  ◆
                </div>
                <div
                  style={{
                    fontSize: '0.53rem',
                    letterSpacing: '0.26em',
                    color: C.smoke,
                    textTransform: 'uppercase',
                    marginBottom: 6,
                  }}
                >
                  The Seeker speaks
                </div>
                <div
                  style={{
                    color: C.ash,
                    fontSize: '0.88rem',
                    fontStyle: 'italic',
                    marginBottom: 14,
                    lineHeight: 1.72,
                  }}
                >
                  {entry.seeker}
                </div>
                <div
                  style={{
                    fontSize: '0.53rem',
                    letterSpacing: '0.26em',
                    color: C.ember,
                    textTransform: 'uppercase',
                    marginBottom: 8,
                  }}
                >
                  The Elder answers
                </div>
                <OracleText text={entry.elder} />
              </div>
            ))}

            <div ref={threadEndRef} />

            {isLoading && <EmberDots text={loadingText} />}

            <button
              onClick={reset}
              style={{
                background: 'transparent',
                border: 'none',
                color: C.smoke,
                fontFamily: 'Georgia,serif',
                fontSize: '0.54rem',
                letterSpacing: '0.22em',
                cursor: 'pointer',
                textTransform: 'uppercase',
                padding: '10px 0',
                marginTop: 20,
                display: 'block',
                width: '100%',
                textAlign: 'center',
                opacity: 0.55,
                transition: 'opacity 0.2s',
              }}
            >
              ◇ &nbsp; Begin a New Divination &nbsp; ◇
            </button>
          </div>
        )}

        {/* ── FOOTER ── */}
        <div
          style={{
            textAlign: 'center',
            marginTop: 56,
            paddingTop: 24,
            borderTop: '1px solid rgba(212,168,67,0.07)',
          }}
        >
          <div
            style={{
              fontSize: '0.56rem',
              letterSpacing: '0.26em',
              color: C.smoke,
              textTransform: 'uppercase',
              opacity: 0.46,
              lineHeight: 2.2,
            }}
          >
            ✦ &nbsp; Temporal Bridges Institute &nbsp;·&nbsp; AHAU AI &nbsp; ✦
          </div>
          <div
            style={{
              fontSize: '0.47rem',
              letterSpacing: '0.17em',
              color: C.smoke,
              textTransform: 'uppercase',
              opacity: 0.28,
              lineHeight: 2,
              marginTop: 2,
            }}
          >
            Rooted in the Popol Wuj &nbsp;·&nbsp; In the lineage of the Ajq'ij &nbsp;·&nbsp; In the spirit of Homo Ludens
          </div>
        </div>
      </div>
    </div>
  );
}
