'use client'

import { useState, useRef, useEffect, useCallback, lazy, Suspense } from 'react';
import LineageSelector from '../LineageSelector';
import { LineageKey, LINEAGES } from '../../lib/lineages';
import { buildSystemPrompt } from '../../lib/system-prompt-builder';
import OracleResponse from './OracleResponse';
// Split out of this file's own chunk -- CouncilTabs pulls in OracleResponse,
// ShareableCard, and ThresholdLetter too, and none of it is needed until
// well after lineage-select. Loading it eagerly meant every visitor
// downloaded and parsed ~250KB of Council-chat code before picking a
// lineage, behind a Suspense boundary with fallback={null} (blank screen)
// in app/page.tsx. importCouncilTabs() below is called proactively the
// moment lineage-select begins, so it's downloading in the background
// during the up-to-15s wisdom-quote overlay (LineageSelector.tsx) instead
// of blocking on first render of the council phase.
const importCouncilTabs = () => import('./CouncilTabs');
const CouncilTabs = lazy(importCouncilTabs);
import { initTouchEmbers, initQuestionPulse, initPlaceholderCycle, watchConsultReady, initScrollFire, applyFirstFlicker, setMultilingualLang, playLineageTone } from './enhancements';
import FireAtmosphere from './FireAtmosphere';
import LanguageToggle from './LanguageToggle';
import { useLanguage } from '../../lib/i18n/LanguageContext';
import ReadingSignal from './ReadingSignal';
import ThresholdPause from './ThresholdPause';
import ShareableCard from './ShareableCard';
import { useLineSelection } from './useLineSelection';
import { suggestMarker, pullQuote, type MarkerType, type CardQuote } from '../../lib/mythopoetics/cardConfig';
import BreathingWait from './BreathingWait';
import { BREATH_CYCLE_MS } from '../../lib/breathTiming';
import { computeCruzMaya, todaysDaySign } from '../../lib/chol-qij';
import RecallLetter from './RecallLetter';
import { RegisterSwitch, type NarrativeRegister } from './RegisterSwitch';
import { PhaseFade } from './PhaseFade';
import { WordReveal } from './WordReveal';
import ElderFrontDoor from './ElderFrontDoor';

// ─── PALETTE ──────────────────────────────────────────────────────────────────
const C = {
  obsidian: '#0a0806',
  gold:     '#d4a843',
  paleGold: '#e8c97a',
  ember:    '#c8601a',
  bone:     '#ede0c4',
  ash:      '#c4b89a',
  smoke:    '#a8916f',
  blood:    '#7a1a1a',
};

// Suspense fallback for the CouncilTabs chunk (see importCouncilTabs above).
// Deliberately minimal and quick -- normally on screen for at most a
// network round trip, since the chunk is usually already cached by now.
function CouncilTabsFallback() {
  return (
    <div style={{
      minHeight: '100vh',
      background: C.obsidian,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      <div style={{
        fontFamily: "'Gentium Plus', Georgia, 'Times New Roman', serif",
        fontStyle: 'italic',
        fontSize: '0.95rem',
        color: C.smoke,
        opacity: 0.6,
      }}>
        &hellip;
      </div>
    </div>
  );
}

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
  'There is no edge where you end and the fire begins…',
];

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`;
}

function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  if (isNaN(then)) return 'a while ago';
  const days = Math.floor((Date.now() - then) / 86400000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 30) return `${days} days ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} month${months === 1 ? '' : 's'} ago`;
  const years = Math.floor(months / 12);
  return `${years} year${years === 1 ? '' : 's'} ago`;
}

type Question = typeof QUESTIONS[number];
type Phase = 'ask' | 'age-register' | 'myth-home' | 'myth-choice' | 'myth-transition' | 'lineage-select' | 'council' | 'idle' | 'loading' | 'reading' | 'thread' | 'error';

// Ceremonial intensity baseline per phase — the fire's felt presence at each stage.
// 'loading' (divining) surges, 'error' gutters rather than surging.
const PHASE_INTENSITY: Record<Phase, number> = {
  ask: 0.3,
  'age-register': 0.3,
  'myth-home': 0.28,
  'myth-choice': 0.3,
  'myth-transition': 0.3,
  'lineage-select': 0.35,
  council: 0.4,
  idle: 0.45,
  loading: 0.85,
  reading: 0.55,
  thread: 0.5,
  error: 0.22,
};

// Persistent fire memory (myth-as-home design, Part A §2): a small,
// additive baseline floor for a signed-in seeker with a current Core Myth
// Statement -- carries a qualitative warmth across sittings, distinct
// from the session-scoped phase/depth/presence layers above. Deliberately
// a single scalar, not per-marker addressable embers: FireAtmosphere has
// no architecture for discrete embers, and building one risks both
// reopening its own C8 governance decision (docs/fire-container-
// decision.md -- "the fire is ONE container") and reading as a de facto
// progress indicator once a seeker started noticing which embers glow
// steadier. No numeric readout anywhere, same discipline as depth-stage.
const MYTH_STATEMENT_FIRE_FLOOR = 0.15;
type Message = { role: 'user' | 'assistant'; content: string };
type ThreadEntry = { seeker: string; elder: string };
type MythEntry = {
  id: number;
  lineageKey: string;
  archetypeName: string;
  summary: string;
  peopleCircumstances: string;
  readingCount: number;
  updatedAt: string;
};
type ThresholdLetterEntry = {
  id: number;
  lineageKey: string;
  volatilizationPhrase: string;
  returnPhrase: string;
  returnGift: string;
  thresholdImage: string;
  createdAt: string;
};

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

// PhaseFade now lives in its own file (app/components/PhaseFade.tsx) --
// shared across the whole app, not just Threshold's own phase swaps.
// See that file's header for why it's entrance-only.

// ─── MAIN ─────────────────────────────────────────────────────────────────────
export default function Threshold() {
  const { languageName } = useLanguage();
  // Age-tiered narrative register (docs/age-register-spec.md §5): its own
  // onboarding beat, before lineage-select, since register is a rendering
  // concern that should be settled before lineage choices begin.
  const [phase,        setPhase]        = useState<Phase>('ask');
  // ── observability refs (anonymous, no PII) ──
  const _sid = useRef(typeof crypto !== 'undefined' ? crypto.randomUUID() : Math.random().toString(36).slice(2))
  const _t0  = useRef(Date.now())
  const _exc = useRef(0)
  const _rdg = useRef(false)
  const _lin = useRef('unknown')
  const _ceiling = useRef<string|null>(null)
  const _prov    = useRef<{ corpusVersion?: string; modelVersion?: string; contractVersion?: string } | null>(null)

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
        ceilingNamed: !!_ceiling.current,
        referralFired: (_ceiling.current ?? '').startsWith('referral:'),
        referralCategory: (_ceiling.current ?? '').startsWith('referral:')
          ? _ceiling.current!.split(':')[1]
          : null,
        hardCeilingHit: ['initiation','transmission','crisis','certainty'].includes(_ceiling.current ?? '')
          ? _ceiling.current
          : null,
      }),
    }).catch(() => {})
  }

  useEffect(() => {
    const _bye = () => _log(false)
    window.addEventListener('beforeunload', _bye)
    return () => window.removeEventListener('beforeunload', _bye)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Prefetch the CouncilTabs chunk the moment lineage-select begins, not
  // when phase first becomes 'council'. The wisdom-quote overlay
  // (LineageSelector.tsx's ActivationOverlay) holds for up to 15s after a
  // lineage is picked -- by design, that's a free download window. Fires
  // once; webpack dedupes/caches the import so this is a no-op if the
  // Suspense boundary above already resolved it first.
  useEffect(() => {
    if (phase === 'lineage-select') { importCouncilTabs(); }
  }, [phase])


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

  const [soundEnabled, setSoundEnabled] = useState(true);
  const [firePulse, setFirePulse] = useState(0);
  // Progressive-immersion, council-boundary unification: CouncilTabs no
  // longer owns its own FireAtmosphere -- it reports its own pulse
  // contribution (base pulse + its per-tab bumps) up here via
  // onPulseChange, and the council phase's single hoisted fire (below)
  // reads this instead of firePulse while that phase is active.
  const [councilPulse, setCouncilPulse] = useState(0);

  // Age-tiered narrative register (docs/age-register-spec.md). Default
  // adult per §5. 'child' NEVER persists (§9 COPPA mitigation) — it lives
  // only in this React state, regardless of sign-in status. young_adult/
  // adult persist for signed-in seekers via /api/register, keyed off the
  // existing session cookie (lib/auth.ts), same precedent as myth_archetype.
  const [narrativeRegister, setNarrativeRegisterState] = useState<NarrativeRegister>('adult');
  const [childTierEnabled,  setChildTierEnabled]        = useState(false);

  useEffect(() => {
    fetch('/api/register')
      .then(r => r.json())
      .then(d => {
        if (d?.childTierEnabled) setChildTierEnabled(true);
        // Only ever 'young_adult' or 'adult' can come back here (see the
        // hard constraint in lib/narrativeRegister.ts) — a signed-in
        // seeker's stored register. Anonymous seekers get the 'adult'
        // default from the same endpoint, which is already this state's
        // initial value, so there's nothing to apply in that case.
        if (d?.register === 'young_adult' || d?.register === 'adult') {
          setNarrativeRegisterState(d.register);
        }
      })
      .catch(() => {});
  }, []);

  const [authEmail,        setAuthEmail]        = useState<string | null>(null);
  const [savedMyths,       setSavedMyths]        = useState<MythEntry[]>([]);
  // Myth-as-home (Part A §1/§2). Server-computed, read once at session
  // start alongside the other signed-in fetches below -- never inferred
  // client-side. null for every seeker without a current statement
  // (including everyone until the Core Myth Statement branch this stacks
  // on top of actually lands), which is the same as "feature not present
  // yet" -- no separate stub path needed.
  const [currentMythStatement, setCurrentMythStatement] = useState<{ bodyText: string; version: number } | null>(null);
  const [priorMythContext, setPriorMythContext]  = useState<string>('');
  // The opening-beat reading (phase 'ask'), kept separate from
  // priorMythContext because that one is deliberately cleared/replaced
  // when a lineage or returning myth is picked. A second, lineage-voiced
  // reading is still intended at the council -- this just gives it the
  // front-door question and reading as context so it doesn't start cold.
  const [frontDoorContext, setFrontDoorContext] = useState<string>('');
  const [continuingMyth,   setContinuingMyth]    = useState<MythEntry | null>(null);
  const patternsPromiseRef = useRef<Promise<string> | null>(null);

  // Changing the register takes effect on the next generated reading, not
  // retroactively (§6) — this setter just updates local state and, for
  // young_adult/adult, fires the persistence call; runConsult reads
  // whatever this state holds at call time, so nothing needs to be
  // re-threaded for the "next reading" behavior to hold.
  // Where the sitting goes once the age-register beat is done (answered or
  // skipped, per §5 no-answer defaults to adult). Mirrors the destination
  // the lineage-select-only myth-choice effect above would otherwise have
  // picked, since that effect intentionally doesn't fire while still on
  // this step.
  const advanceFromAgeRegister = useCallback(() => {
    // Myth-home takes priority: a seeker who has written a Core Myth
    // Statement arrives there first, then chooses to continue on to
    // myth-choice/lineage-select from that unforced threshold screen --
    // this is "before lineage-select, not instead of it" (Part A §1),
    // not a replacement for the existing myth-choice returning path.
    setPhase(currentMythStatement ? 'myth-home' : savedMyths.length > 0 ? 'myth-choice' : 'lineage-select');
  }, [savedMyths, currentMythStatement]);

  // Sets the register (local state, plus persistence for young_adult/adult
  // signed-in seekers). Used both by the onboarding beat and by the
  // mid-sitting RegisterSwitch (§6) — the switch must NOT also change
  // `phase`, so phase-advancing lives only in the onboarding handler below.
  const setRegister = useCallback((tier: NarrativeRegister) => {
    setNarrativeRegisterState(tier);
    if (tier !== 'child') {
      // never persisted — see lib/narrativeRegister.ts
      fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ register: tier }),
      }).catch(() => {});
    }
  }, []);

  // Onboarding-only: set the register, then advance past this beat.
  const chooseRegister = useCallback((tier: NarrativeRegister) => {
    setRegister(tier);
    advanceFromAgeRegister();
  }, [setRegister, advanceFromAgeRegister]);

  const [archetypeArc, setArchetypeArc] = useState<Record<string, number>>({});
  const [recallLetter, setRecallLetter] = useState<ThresholdLetterEntry | null>(null);
  const [letterDismissed, setLetterDismissed] = useState(false);
  const [daySignToday, setDaySignToday] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/auth/me')
      .then(r => r.json())
      .then(data => {
        if (!data?.email) return;
        setAuthEmail(data.email);
        fetch('/api/myth').then(r => r.json()).then(d => {
          const myths = d?.myths ?? [];
          setSavedMyths(myths);
          // Only auto-advance out of lineage-select — the age-register beat
          // (§5) always gets its own turn first and decides where to go
          // next itself (see advanceFromAgeRegister below), so a myths
          // fetch landing while still on that step must not skip it.
          if (myths.length > 0) setPhase(p => (p === 'lineage-select' ? 'myth-choice' : p));
        });
        // Defensive against the still-open feat/marker-depth-stage base
        // not yet on main by the time this stacks there for real -- the
        // route itself is present on this branch, but a 404/500 here
        // (schema not migrated on whatever DB this runs against) must
        // never break the rest of the returning-seeker flow above.
        fetch('/api/elder/core-myth-statement').then(r => r.json()).then(d => {
          if (d?.current?.bodyText) {
            setCurrentMythStatement({ bodyText: d.current.bodyText, version: d.current.version });
            // Same priority-race guarantee as the myths auto-advance above:
            // whichever of these two fetches resolves first while the
            // seeker is still on age-register wins the redirect the OTHER
            // one would otherwise have made from 'lineage-select' -- myth-
            // home always wins over myth-choice if both apply, matching
            // advanceFromAgeRegister's own priority order.
            setPhase(p => (p === 'lineage-select' || p === 'myth-choice' ? 'myth-home' : p));
          }
        }).catch(() => {});
        fetch('/api/myth/arc').then(r => r.json()).then(d => {
          const counts: Record<string, number> = {};
          (d?.arc ?? []).forEach((a: { archetypeName: string; count: number }) => {
            counts[a.archetypeName] = a.count;
          });
          setArchetypeArc(counts);
        }).catch(() => {});
        fetch('/api/threshold-letters').then(r => r.json()).then(d => {
          const letters: ThresholdLetterEntry[] = d?.letters ?? [];
          if (letters.length > 0) setRecallLetter(letters[0]);
        }).catch(() => {});
      })
      .catch(() => {});
  }, []);

  // Chol Q'ij personal day-sign nudge — entirely client-side, only fires for
  // seekers who already gave a birth date for readings. Honest, not engineered.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const raw = localStorage.getItem('elder_birthdate');
    if (!raw) return;
    try {
      const birthDate = new Date(raw);
      if (isNaN(birthDate.getTime())) return;
      const natal = computeCruzMaya(birthDate).center.nahual.name;
      const today = todaysDaySign().nahual.name;
      if (natal === today) setDaySignToday(today);
    } catch { /* malformed stored birthdate — silently skip the nudge */ }
  }, []);

  useEffect(() => {
    try {
      if (sessionStorage.getItem('elder_letter_dismissed') === '1') setLetterDismissed(true);
    } catch { /* private mode — always show once */ }
  }, []);

  const dismissRecallLetter = useCallback(() => {
    setLetterDismissed(true);
    try { sessionStorage.setItem('elder_letter_dismissed', '1'); } catch { /* ignore */ }
  }, []);

  const signOut = useCallback(() => {
    fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
    setAuthEmail(null);
    setSavedMyths([]);
  }, []);

  // ── Shareable card ──
  const readingRef = useRef<HTMLDivElement>(null);
  const { selection, clearSelection } = useLineSelection(readingRef);
  const [cardOpen,   setCardOpen]   = useState(false);
  // Placeholder cast: never rendered as-is -- cardOpen only flips true
  // right after setCardLine receives a real pullQuote() result below.
  const [cardLine,   setCardLine]   = useState<CardQuote>('' as CardQuote);
  const [cardMarker, setCardMarker] = useState<MarkerType>('pattern');

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
    }, BREATH_CYCLE_MS);
  }, []);

  const runConsult = useCallback(
    async (userText: string, currentHistory: Message[], isFirst: boolean, isReadingMode: boolean = false) => {
      const savedHistory = currentHistory;
      const nextHistory: Message[] = [...currentHistory, { role: 'user', content: userText }];

      setPhase('loading');
      setErrorMsg('');
      setFirePulse(p => p + 1);
      startLoadingCycle();

      try {
        _exc.current += 1
        const res = await fetch('/api/divine', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages: nextHistory, lineageKey: lineage, mode: isReadingMode ? 'reading' : 'questioning', birthDate: typeof window !== 'undefined' ? localStorage.getItem('elder_birthdate') || undefined : undefined, narrativeRegister }),
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
        if (data.ceilingCategory) {
          _ceiling.current = data.ceilingCategory;
        }
        if (data._provenance) { _prov.current = data._provenance; }

        const fullHistory: Message[] = [
          ...nextHistory,
          { role: 'assistant', content: elderText },
        ];
        setHistory(fullHistory);

        // A questioning-mode response that comes back still carrying the
        // READY signal is the model asking its one allowed clarifying
        // question, not delivering the Reading — per the clarify-before-
        // decline instruction in system-prompt-builder.ts. Keep firstReading
        // unset so the seeker's reply is still treated as "first" and gets
        // sent back with mode: 'reading' (forcing a real answer, not a
        // second question). Route it through the existing thread display
        // rather than the full reveal, since it isn't the Reading yet.
        const isClarifyingQuestion = !isReadingMode && data.readyToRead;

        if (isFirst && !isClarifyingQuestion) {
          setFirstReading(elderText);
          _rdg.current = true;
          if (data._provenance?.voice) {
            fetch('/api/altar', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                sessionId: _sid.current,
                timestamp: new Date().toISOString(),
                nahual: 'unknown',
                trecena: 1,
                lineage: data._provenance.voice,
                signal: 'landed',
                // _provenance now comes from provenanceMetadata() (snake_case
                // keys, its own established shape) instead of a hand-rolled
                // camelCase duplicate -- /api/altar's own request contract is
                // unchanged (still camelCase), so only the read side here
                // needed updating, not the write side.
                corpusVersion:   data._provenance.corpus_version,
                modelVersion:    data._provenance.model_version,
                contractVersion: data._provenance.contract_version,
                mode: 'adult_individual',
              }),
            }).catch(() => {});
          }
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
    [startLoadingCycle, stopLoading, languageName, lineage, narrativeRegister]
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
    _ceiling.current = null;
  }, [stopLoading]);

  // Phase sets the ceremonial baseline; within reading/thread, depth of the
  // conversation nudges it further — a returning arc still deepens the fire,
  // it just no longer overrides the phase's own arc the way the old formula did.
  // (reading/thread are provably unreachable now -- see the dead-code note
  // at the bottom of this component -- so this branch is inert, but the
  // formula is shared with fireIntensity's use across every reachable
  // phase block below and isn't worth touching to prove that further.)
  const DEPTH_STEP = 0.02;
  const MAX_DEPTH_STEPS = 5;
  const phaseIntensity =
    phase === 'reading' || phase === 'thread'
      ? Math.min(1, PHASE_INTENSITY[phase] + Math.min(thread.length, MAX_DEPTH_STEPS) * DEPTH_STEP)
      : PHASE_INTENSITY[phase];
  // Persistent fire memory floor -- additive, never replacing the
  // session-scoped phase/depth layer above. See MYTH_STATEMENT_FIRE_FLOOR's
  // own comment for why this is one scalar, not per-marker embers.
  const fireIntensity = currentMythStatement
    ? Math.max(phaseIntensity, MYTH_STATEMENT_FIRE_FLOOR)
    : phaseIntensity;

  if (phase === 'ask') {
    // The opening beat: the seeker's own question lights the fire and a
    // first reading is spoken in the default voice, before lineage is
    // chosen. The asked question and that reading are threaded forward as
    // prior context so the council doesn't start cold.
    return (
      <PhaseFade key="ask">
        <ElderFrontDoor
          lineageKey="default"
          narrativeRegister={narrativeRegister}
          signedIn={!!authEmail}
          onContinue={({ question, reading, intent }) => {
            setThresholdQ(question);
            setFrontDoorContext(
              `The seeker's opening question at the fire: "${question}"\n\n` +
              `A first reading was already spoken in the default voice, before a lineage was chosen:\n${reading}\n\n` +
              (intent === 'deepen'
                ? `The seeker asked to deepen this thread. Speak now in your own lineage's voice -- take this further, do not restate it.`
                : `Speak now in your own lineage's voice -- a second reading that deepens or turns this, not a repetition.`)
            );
            setPhase('age-register');
          }}
        />
      </PhaseFade>
    );
  }

  if (phase === 'council') {
    return (
      <>
        {/* Hoisted outside PhaseFade -- same sibling-persistence pattern as
            every other phase below (see the note on the myth-transition
            branch). This completes the progressive-immersion pass: the
            fire lit at age-register now persists all the way through the
            actual reading, not just up to lineage-select. CouncilTabs no
            longer renders its own FireAtmosphere; it reports its own pulse
            contribution (tab-switch bumps) up via onPulseChange instead,
            which feeds this single instance's pulse during this phase. */}
        <FireAtmosphere soundEnabled={soundEnabled} intensity={fireIntensity} pulse={councilPulse} />
        <PhaseFade key="council">
        {/* Fallback should be rare in practice -- importCouncilTabs() is fired
            as soon as lineage-select begins (see below), so this chunk is
            usually already cached by the time this renders. It only shows on
            a slow connection or an unusually fast click-through. */}
        <Suspense fallback={<CouncilTabsFallback />}>
          <CouncilTabs
            lineage={lineage}
            soundEnabled={soundEnabled}
            pulse={firePulse}
            onPulseChange={setCouncilPulse}
            onReturn={() => { setPriorMythContext(''); setContinuingMyth(null); setCouncilPulse(0); setPhase('lineage-select'); }}
            priorMythContext={[frontDoorContext, priorMythContext].filter(Boolean).join('\n\n') || undefined}
            signedIn={!!authEmail}
            narrativeRegister={narrativeRegister}
            birthDate={typeof window !== 'undefined' ? localStorage.getItem('elder_birthdate') || undefined : undefined}
            hasMythStatement={!!currentMythStatement}
          />
        </Suspense>
        {/* Mid-sitting register switch (docs/age-register-spec.md §6). Always
            visible once seated at the fire, never a settings-menu affair.
            setRegister (not chooseRegister) on purpose -- it must only
            change the register, never advance `phase`, per the comment on
            setRegister's definition above. */}
        <div style={{ position: 'fixed', bottom: 16, left: 16, zIndex: 5 }}>
          <RegisterSwitch
            register={narrativeRegister}
            onChange={setRegister}
            childTierEnabled={childTierEnabled}
          />
        </div>
        </PhaseFade>
      </>
    );
  }

  if (phase === 'myth-transition' && continuingMyth) {
    return (
      <>
        {/* Hoisted OUTSIDE PhaseFade's keyed subtree (progressive-immersion
            pass) so it's the same element at the same tree position across
            every non-council phase -- React preserves this instance across
            phase changes instead of tearing it down and remounting, and
            FireAtmosphere's own internal `transition: filter/transform 1.4s
            ease` (unchanged) then genuinely ramps intensity instead of
            hard-jumping. Deliberately still INSIDE each phase's `if` branch,
            not lifted above the whole function -- see the design note on
            why full crossfade/persistence across the council boundary was
            assessed as too risky to also attempt this pass. */}
        <FireAtmosphere soundEnabled={soundEnabled} intensity={fireIntensity} pulse={firePulse} />
        <PhaseFade key="myth-transition">
        <ThresholdPause
          nahual={undefined}
          glyphColor={LINEAGES[continuingMyth.lineageKey as LineageKey]?.palette.primary ?? '#d4a843'}
          durationMs={6000}
          responsePromise={patternsPromiseRef.current ?? undefined}
          onComplete={(patterns) => {
            if (patterns) {
              setPriorMythContext(prev => `${prev}\n\nRecurring across your other stored myths: ${patterns}`);
            }
            setPhase('council');
          }}
        />
        </PhaseFade>
      </>
    );
  }

  if (phase === 'age-register') {
    // Age-tiered narrative register onboarding beat (docs/age-register-spec.md
    // §5). Its own step, before lineage-select — register is a rendering
    // concern that should be settled before lineage choices begin. Framed
    // in-voice ("turnings of the sun"), not as an age-band form field.
    // No-answer/skip defaults to adult (already this state's initial value).
    const buckets: { tier: NarrativeRegister; label: string }[] = [
      ...(childTierEnabled
        ? [{ tier: 'child' as const, label: 'Just a few turnings' }]
        : []),
      { tier: 'young_adult', label: 'A handful more, still finding my footing' },
      { tier: 'adult', label: "Many turnings — I've walked further than that" },
    ];
    return (
      <>
        {/* Hoisted outside PhaseFade -- see the note on this same pattern
            in the myth-transition branch above. */}
        <FireAtmosphere soundEnabled={soundEnabled} intensity={fireIntensity} pulse={firePulse} />
        <PhaseFade key="age-register">
        <div style={{
          minHeight: '100vh',
          background: '#0a0806',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: "'Gentium Plus', Georgia, 'Times New Roman', serif",
          padding: '40px 20px',
        }}>
          <div style={{ textAlign: 'center', marginBottom: 34, position: 'relative', zIndex: 1, maxWidth: 520, padding: '0 20px' }}>
            <div className="fire-shadow" style={{
              fontFamily: "'Cormorant Garamond', Georgia, serif",
              fontSize: 'clamp(1.5rem, 4vw, 2.2rem)',
              color: '#d4a843',
              letterSpacing: '0.06em',
              marginBottom: 18,
              fontStyle: 'italic',
            }}>
              How many turnings of the sun have shaped you?
            </div>
          </div>
          <div style={{ display: 'grid', gap: 12, width: '100%', maxWidth: 480, position: 'relative', zIndex: 1, marginBottom: 20 }}>
            {buckets.map(b => (
              <button
                key={b.tier}
                onClick={() => chooseRegister(b.tier)}
                style={{
                  background: 'rgba(212,168,67,0.04)',
                  border: '1px solid rgba(212,168,67,0.24)',
                  color: '#e8c97a',
                  fontFamily: "'Gentium Plus',Georgia,serif",
                  fontStyle: 'italic',
                  fontSize: '0.98rem',
                  padding: '16px 22px',
                  textAlign: 'left',
                  cursor: 'pointer',
                }}
              >
                {b.label}
              </button>
            ))}
          </div>
          <button
            onClick={advanceFromAgeRegister}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#5a4a3a',
              fontFamily: "'Gentium Plus', Georgia, serif",
              fontSize: '0.6rem',
              letterSpacing: '0.18em',
              padding: '8px 0',
              cursor: 'pointer',
              textTransform: 'uppercase',
              textDecoration: 'underline',
              position: 'relative',
              zIndex: 1,
            }}
          >
            Skip — the fire will assume many turnings
          </button>
        </div>
        </PhaseFade>
      </>
    );
  }

  if (phase === 'myth-home') {
    // Chrome-off threshold screen, mirroring the existing Threshold Letter
    // closing-screen treatment (Part A §1) -- but as an opening beat, not
    // a closing one. No CTA pressure: the path onward is present but
    // unforced, same standing (non-expiring) posture as the Core Myth
    // Statement invitation itself.
    return (
      <>
        <FireAtmosphere soundEnabled={soundEnabled} intensity={fireIntensity} pulse={firePulse} />
        <PhaseFade key="myth-home">
        <div style={{
          minHeight: '100vh',
          background: '#0a0806',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: "'Gentium Plus', Georgia, 'Times New Roman', serif",
          padding: '40px 20px',
        }}>
          <div style={{ maxWidth: 560, position: 'relative', zIndex: 1, textAlign: 'center' }}>
            <div style={{ fontSize: '0.56rem', letterSpacing: '0.28em', color: '#d4a843', textTransform: 'uppercase', opacity: 0.7, marginBottom: 28 }}>
              Your Core Myth Statement
            </div>
            {currentMythStatement && (
              <div style={{ fontStyle: 'italic', color: '#fdf6e8', fontSize: '1rem', lineHeight: 1.9, marginBottom: 44 }}>
                <WordReveal text={currentMythStatement.bodyText} breathSynced carved />
              </div>
            )}
            <button
              onClick={() => setPhase(savedMyths.length > 0 ? 'myth-choice' : 'lineage-select')}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#5a4a3a',
                fontFamily: "'Gentium Plus', Georgia, serif",
                fontSize: '0.62rem',
                letterSpacing: '0.18em',
                padding: '8px 0',
                cursor: 'pointer',
                textTransform: 'uppercase',
                textDecoration: 'underline',
              }}
            >
              Enter the fire
            </button>
          </div>
        </div>
        </PhaseFade>
      </>
    );
  }

  if (phase === 'myth-choice') {
    return (
      <>
        <FireAtmosphere soundEnabled={soundEnabled} intensity={fireIntensity} pulse={firePulse} />
        <PhaseFade key="myth-choice">
      <div style={{
        minHeight: '100vh',
        background: '#0a0806',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: "'Gentium Plus', Georgia, 'Times New Roman', serif",
        padding: '40px 20px',
      }}>
        <div style={{ textAlign: 'center', marginBottom: 34, position: 'relative', zIndex: 1 }}>
          <div className="fire-shadow" style={{
            fontFamily: "'Cormorant Garamond', Georgia, serif",
            fontSize: 'clamp(1.6rem, 4vw, 2.4rem)',
            color: '#d4a843',
            letterSpacing: '0.2em',
            marginBottom: 10,
          }}>
            YOUR MYTH IS STILL BURNING
          </div>
          <div style={{ fontStyle: 'italic', color: '#c4b89a', fontSize: '0.92rem', opacity: 0.8 }}>
            Continue what has already been named — or begin again.
          </div>
          {savedMyths[0]?.updatedAt && (
            <div style={{ fontSize: '0.68rem', color: '#5a4a3a', letterSpacing: '0.08em', marginTop: 10 }}>
              The fire has been resting since {formatRelative(savedMyths[0].updatedAt)}.
            </div>
          )}
          {daySignToday && (
            <div style={{ fontSize: '0.72rem', color: '#d4a843', letterSpacing: '0.06em', marginTop: 8, fontStyle: 'italic' }}>
              Today is {daySignToday} — your day.
            </div>
          )}
        </div>

        <div style={{ display: 'grid', gap: 12, width: '100%', maxWidth: 560, position: 'relative', zIndex: 1, marginBottom: 24 }}>
          {savedMyths.map(m => (
            <button
              key={m.id}
              onClick={() => {
                setLineage((m.lineageKey as LineageKey) in LINEAGES ? (m.lineageKey as LineageKey) : 'default');
                setPriorMythContext(
                  `Archetype: ${m.archetypeName}\n\n${m.summary}` +
                  (m.peopleCircumstances ? `\n\nPeople and circumstances already named: ${m.peopleCircumstances}` : '')
                );
                patternsPromiseRef.current = fetch('/api/myth/patterns')
                  .then(r => r.json())
                  .then(d => d?.patterns ?? '')
                  .catch(() => '');
                setContinuingMyth(m);
                setPhase('myth-transition');
              }}
              style={{
                background: 'rgba(212,168,67,0.04)',
                border: '1px solid rgba(212,168,67,0.24)',
                color: '#e8c97a',
                fontFamily: "'Gentium Plus',Georgia,serif",
                padding: '18px 22px',
                textAlign: 'left',
                cursor: 'pointer',
              }}
            >
              <div style={{ fontSize: '1.02rem', fontStyle: 'italic', marginBottom: 6 }}>{m.archetypeName}</div>
              <div style={{ fontSize: '0.72rem', color: '#a8916f', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>
                {LINEAGES[m.lineageKey as LineageKey]?.tradition ?? m.lineageKey} &nbsp;·&nbsp; {m.readingCount} reading{m.readingCount === 1 ? '' : 's'}
              </div>
              <div style={{ fontSize: '0.82rem', color: '#c4b89a', lineHeight: 1.6, opacity: 0.85 }}>
                {m.summary.slice(0, 140)}{m.summary.length > 140 ? '…' : ''}
              </div>
              {archetypeArc[m.archetypeName] >= 2 && (
                <div style={{ fontSize: '0.66rem', color: '#a8916f', fontStyle: 'italic', marginTop: 8 }}>
                  This is the {ordinal(archetypeArc[m.archetypeName])} time the {m.archetypeName} has shown up.
                </div>
              )}
            </button>
          ))}
        </div>

        <button
          onClick={() => setPhase('lineage-select')}
          style={{
            background: 'transparent',
            border: '1px solid rgba(212,168,67,0.35)',
            color: '#d4a843',
            fontFamily: "'Gentium Plus', Georgia, serif",
            fontSize: '0.68rem',
            letterSpacing: '0.22em',
            padding: '12px 26px',
            cursor: 'pointer',
            textTransform: 'uppercase',
            position: 'relative',
            zIndex: 1,
          }}
        >
          Begin a New Myth
        </button>

        {authEmail && (
          <div style={{ marginTop: 26, fontSize: '0.6rem', color: '#5a4a3a', letterSpacing: '0.1em', position: 'relative', zIndex: 1 }}>
            signed in as {authEmail} &nbsp;·&nbsp;{' '}
            <a href="/letters" style={{ color: '#5a4a3a', textDecoration: 'underline' }}>
              your kept letters
            </a>
            &nbsp;·&nbsp;{' '}
            <a href="/journal" style={{ color: '#5a4a3a', textDecoration: 'underline' }}>
              your journal
            </a>
            &nbsp;·&nbsp;{' '}
            <a href="/tree" style={{ color: '#5a4a3a', textDecoration: 'underline' }}>
              your tree
            </a>
            &nbsp;·&nbsp;{' '}
            <button onClick={signOut} style={{ background: 'none', border: 'none', color: '#5a4a3a', cursor: 'pointer', textDecoration: 'underline', fontSize: '0.6rem' }}>
              sign out
            </button>
          </div>
        )}
      </div>
        </PhaseFade>
      </>
    );
  }

  if (phase === 'lineage-select') {
    return (
      <>
        <FireAtmosphere soundEnabled={soundEnabled} intensity={fireIntensity} pulse={firePulse} />
        <PhaseFade key="lineage-select">
      <div style={{
        minHeight: '100vh',
        background: '#0a0806',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: "'Gentium Plus', Georgia, 'Times New Roman', serif",
      }}>
        <div style={{ textAlign: 'center', marginBottom: 40, padding: '0 20px' }}>
          <div className="fire-shadow" style={{
            fontFamily: "'Cormorant Garamond', Georgia, serif",
            fontSize: 'clamp(1.8rem, 4.5vw, 2.8rem)',
            color: '#d4a843',
            letterSpacing: '0.24em',
            marginBottom: 10,
            textShadow: '0 0 50px rgba(212,168,67,0.32)',
          }}>
            THE ELDER
          </div>
          <div className="fire-shadow" style={{
            fontFamily: "'Inter', Arial, sans-serif",
            fontSize: '0.68rem',
            letterSpacing: '0.4em',
            color: '#a8916f',
            textTransform: 'uppercase',
          }}>
            Myth Diviner · Seer · Soothsayer
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 28 }}>
          <LanguageToggle />
        </div>
        {recallLetter && !letterDismissed && (
          <RecallLetter letter={recallLetter} onDismiss={dismissRecallLetter} />
        )}
        <LineageSelector
          onSelect={(key, question) => {
            setLineage(key);
            _lin.current = key;
            setThresholdQ(question);
            setPriorMythContext('');
            if (authEmail) {
              fetch(`/api/myth/lineage-recall?lineageKey=${encodeURIComponent(key)}`)
                .then(r => r.json())
                .then(d => { if (d?.recall) setPriorMythContext(d.recall); })
                .catch(() => {})
                .finally(() => setPhase('council'));
            } else {
              setPhase('council');
            }
          }}
        />
      </div>
        </PhaseFade>
      </>
    );
  }

  // 'idle' | 'loading' | 'reading' | 'thread' | 'error' -- the original
  // inline reading UI, from before CouncilTabs existed. Provably
  // unreachable: every setPhase() call in this file was traced, and none
  // of the phases reachable from the initial state (age-register,
  // myth-choice, myth-transition, lineage-select, council) ever transition
  // into this group. ~590 lines of dead JSX removed here 2026-08-16 as
  // part of splitting CouncilTabs into its own chunk -- this dead weight
  // was shipping in Threshold's own chunk, on the critical path to
  // lineage-select, for no reason. Returns null rather than asserting
  // unreachable, so a future phase added without updating this comment
  // fails soft (blank) instead of crashing.
  return null;
}
