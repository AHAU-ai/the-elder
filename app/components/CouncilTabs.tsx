'use client'
import { WordReveal } from './WordReveal';
import { PhaseFade } from './PhaseFade';

import { useState, useRef, useEffect, useCallback, Fragment } from 'react';
import { LineageKey, LINEAGES } from '../../lib/lineages';
import { useLanguage } from '../../lib/i18n/LanguageContext';
import { useLocalizedLineages } from '../../lib/i18n/useLocalizedLineages';
import { apiErrorMessage } from '../../lib/i18n/apiError';
import type { MessageKey } from '../../lib/i18n/translate';
import { LINEAGE_ARCHETYPES, ArchetypeCard } from '../../lib/archetypes';
import OracleResponse from './OracleResponse';
import CrisisNotice from './CrisisNotice';
import ReadingSegment from './ReadingSegment';
import { startHeartbeatDrum, stopHeartbeatDrum, INQUIRY_BPM } from '../../lib/heartbeatDrum';
import { startHapticBreathPulse, stopHapticBreathPulse } from '../../lib/hapticBreathPulse';
import ReadingSignal from './ReadingSignal';
import MarkerOffer from './MarkerOffer';
import CarryOffer from './CarryOffer';
import StageUpOffer from './StageUpOffer';
import MappingOfferControls from './MappingOfferControls';
import { readMappingOffer, readMappingHeld, divineFigureFields, type MappingOffer, type OfferResult } from '../../lib/figureClient';
import SaveMythPrompt from './SaveMythPrompt';
import ShareableCard from './ShareableCard';
import LetterEmailChoice from './LetterEmailChoice';
import GuidedJournalPrompt from './GuidedJournalPrompt';
import { lineageToVoiceKey } from '../../lib/lineageToVoiceKey';
import { mythStartersFor } from '../../lib/mythStarters';
import { suggestMarker, pullQuote, type MarkerType, type CardQuote } from '../../lib/mythopoetics/cardConfig';
import { useElderPhase } from './ElderPresence';

// ─── PALETTE ─────────────────────────────────────────────────────────────────
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

const LOADING_LINES: MessageKey[] = [
  'council.loading_1',
  'council.loading_2',
  'council.loading_3',
  'council.loading_4',
  'council.loading_5',
  'council.loading_6',
];

type TabId = 'mythology' | 'archetypes' | 'council';
type Message = { role: 'user' | 'assistant'; content: string };
type ThreadEntry = { seeker: string; elder: string; mappingOffer?: MappingOffer; mappingHeld?: boolean };

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

function OracleText({ text, onSettled }: { text: string; onSettled?: () => void }) {
  const [revealedThrough, setRevealedThrough] = useState(0);

  useEffect(() => {
    setRevealedThrough(0);
  }, [text]);

  // Figure Continuity: tell the parent once every line has been revealed, so the
  // pairing controls (if any) appear only after the telling has landed.
  const totalLines = text ? text.split(/\n\n+/).filter(Boolean).reduce((n, para) => n + para.split('\n').length, 0) : 0;
  const onSettledRef = useRef(onSettled);
  onSettledRef.current = onSettled;
  useEffect(() => {
    if (totalLines > 0 && revealedThrough >= totalLines) onSettledRef.current?.();
  }, [revealedThrough, totalLines]);

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
  const { t } = useLanguage();
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
            [t('cards.existential_field'), card.existentialField],
            [t('cards.gift'), card.gift],
            [t('cards.shadow'), card.shadow],
            [t('cards.canonical_anchor'), card.canonicalAnchor],
          ].map(([label, val]) => (
            <div key={label} style={{ marginBottom: 12 }}>
              <div style={{ fontSize: '0.54rem', letterSpacing: '0.28em', color: accent, textTransform: 'uppercase', marginBottom: 4, opacity: 0.8 }}>{label}</div>
              <div style={{ color: C.ash, fontSize: '0.92rem', fontStyle: 'italic', lineHeight: 1.75 }}>{val}</div>
            </div>
          ))}
          <div style={{ marginTop: 16, borderTop: `1px solid rgba(212,168,67,0.12)`, paddingTop: 14 }}>
            <div style={{ fontSize: '0.54rem', letterSpacing: '0.28em', color: C.ember, textTransform: 'uppercase', marginBottom: 6 }}>{t('cards.elder_asks')}</div>
            <div style={{ color: C.paleGold, fontSize: '0.98rem', fontStyle: 'italic', lineHeight: 1.8 }}>{card.elderQuestion}</div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── TAB: MYTHOLOGY ───────────────────────────────────────────────────────────

function MythologyTab({ lineage, onAsk }: { lineage: LineageKey; onAsk?: () => void }) {
  const { t, tp, languageName, locale } = useLanguage();
  const lin = useLocalizedLineages()[lineage];
  const accent = lin.palette.primary;
  const [topic, setTopic] = useState('');
  const [response, setResponse] = useState('');
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<Message[]>([]);
  const [thread, setThread] = useState<ThreadEntry[]>([]);
  const [error, setError] = useState('');
  const [loadingIdx, setLoadingIdx] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const threadEndRef = useRef<HTMLDivElement>(null);

  const stopCycle = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
  }, []);

  const startCycle = useCallback(() => {
    setLoadingIdx(0);
    let idx = 0;
    intervalRef.current = setInterval(() => {
      idx = (idx + 1) % LOADING_LINES.length;
      setLoadingIdx(idx);
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
    startHapticBreathPulse();
    try {
      const res = await fetch('/api/divine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: next, lineageKey: lineage, mode: 'mythology', languageName }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(apiErrorMessage(data, t, tp, `HTTP ${res.status}`));
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
      setError(err?.message || t('council.error_default'));
    } finally {
      stopCycle();
      stopHapticBreathPulse();
      setLoading(false);
    }
  }, [topic, loading, history, lineage, response, startCycle, stopCycle, t, tp, languageName]);

  const MYTH_TOPICS = [
    // Questions about the seeker's own life, in the voice's vocabulary (English
    // only, see lib/mythStarters.ts), then the generic questions about the tradition.
    ...mythStartersFor(lineage, locale),
    t('myth_tab.topic_1', { tradition: lin.tradition }),
    t('myth_tab.topic_2', { tradition: lin.tradition }),
    t('myth_tab.topic_3', { tradition: lin.tradition }),
    t('myth_tab.topic_4', { tradition: lin.tradition }),
    t('myth_tab.topic_5', { tradition: lin.tradition }),
  ];

  return (
    <div>
      <div style={{ marginBottom: 22, textAlign: 'center' }}>
        <div style={{ fontSize: '0.62rem', letterSpacing: '0.38em', color: accent, textTransform: 'uppercase', marginBottom: 6 }}>
          {lin.teacherTitle}
        </div>
        <div style={{ fontStyle: 'italic', color: C.ash, fontSize: '1.0rem', lineHeight: 1.8 }}>
          {t('myth_tab.speaks_within', { teacher: lin.teacherTitle, tradition: lin.tradition })}
          <br />
          {t('myth_tab.choose_threshold')}
        </div>
        {!response && !loading && (
          <div style={{ marginTop: 10, color: C.smoke, fontSize: '0.84rem', lineHeight: 1.7 }}>
            {t('myth_tab.how_to_ask')}
          </div>
        )}
      </div>

      {!response && !loading && (
        <div style={{ display: 'grid', gap: 8, marginBottom: 14 }}>
          {MYTH_TOPICS.map((topicText, i) => (
            <button
              key={i}
              onClick={() => setTopic(topicText)}
              style={{
                background: topic === topicText ? 'rgba(212,168,67,0.05)' : 'transparent',
                border: `1px solid ${topic === topicText ? accent : 'rgba(212,168,67,0.17)'}`,
                color: topic === topicText ? C.paleGold : C.ash,
                fontFamily: "'Gentium Plus',Georgia,serif", fontSize: '0.9rem',
                padding: '10px 14px', cursor: 'pointer', textAlign: 'left',
                lineHeight: 1.5, fontStyle: 'italic',
                transition: 'border-color 0.25s, color 0.25s',
              }}
            >
              {topicText}
            </button>
          ))}
        </div>
      )}

      {loading && <EmberDots text={t(LOADING_LINES[loadingIdx])} />}

      {error && (
        <div role="alert" style={{ color: C.blood, fontStyle: 'italic', fontSize: '0.88rem', textAlign: 'center', marginBottom: 14 }}>
          {t('myth_tab.fire_dims', { error })}
        </div>
      )}

      {response && !loading && (
        <div style={{
          background: 'rgba(8,6,4,0.93)', border: `1px solid rgba(212,168,67,0.28)`,
          padding: '28px 36px', marginBottom: 18, position: 'relative', animation: 'elderReveal 1.1s ease forwards',
        }}>
          <OracleCorners />
          <div style={{ fontSize: '0.54rem', letterSpacing: '0.3em', color: accent, textTransform: 'uppercase', marginBottom: 14, opacity: 0.8 }}>
            {t('myth_tab.teacher_speaks', { teacher: lin.teacherTitle })}
          </div>
          <OracleText text={response} />
        </div>
      )}

      {thread.map((entry, i) => (
        // Same framed treatment as the first response above -- the mirror
        // keeps its border for every turn of the reading, not just the
        // opening one. Was a bare left-border strip before; that broke the
        // sacred/ceremonial consistency the moment a seeker asked a
        // follow-up question.
        <div key={i} style={{
          background: 'rgba(8,6,4,0.93)', border: '1px solid rgba(212,168,67,0.28)',
          padding: '24px 32px', marginBottom: 18, position: 'relative', animation: 'elderReveal 0.8s ease forwards',
        }}>
          <OracleCorners />
          <div style={{ fontSize: '0.52rem', letterSpacing: '0.26em', color: C.smoke, textTransform: 'uppercase', marginBottom: 5 }}>{t('myth_tab.seeker_asks')}</div>
          <div style={{ color: C.ash, fontSize: '0.88rem', fontStyle: 'italic', marginBottom: 12, lineHeight: 1.72 }}>{entry.seeker}</div>
          <div style={{ fontSize: '0.52rem', letterSpacing: '0.26em', color: accent, textTransform: 'uppercase', marginBottom: 7 }}>{t('myth_tab.teacher_answers', { teacher: lin.teacherTitle })}</div>
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
          placeholder={response ? t('myth_tab.ask_more') : t('myth_tab.ask_own', { teacher: lin.teacherTitle })}
          style={{
            flex: 1, minWidth: 0, background: 'rgba(255,255,255,0.022)', border: '1px solid rgba(212,168,67,0.18)',
            color: C.bone, fontFamily: "'Gentium Plus',Georgia,serif", fontStyle: 'italic', fontSize: '1.02rem',
            padding: '11px 16px', opacity: loading ? 0.5 : 1,
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
  const { t, tp, languageName } = useLanguage();
  const lin = useLocalizedLineages()[lineage];
  const accent = lin.palette.primary;
  const data = LINEAGE_ARCHETYPES[lineage];
  const [phase, setPhase] = useState<ArchPhase>('questions');
  const [answers, setAnswers] = useState<string[]>(['', '', '']);
  const [revealed, setRevealed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingIdx, setLoadingIdx] = useState(0);
  const [surfaceText, setSurfaceText] = useState('');
  const [error, setError] = useState('');
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopCycle = useCallback(() => { if (intervalRef.current) clearInterval(intervalRef.current); }, []);
  const startCycle = useCallback(() => {
    let idx = 0;
    intervalRef.current = setInterval(() => { idx = (idx + 1) % LOADING_LINES.length; setLoadingIdx(idx); }, 2200);
  }, []);
  useEffect(() => () => stopCycle(), [stopCycle]);

  const surface = useCallback(async () => {
    const filled = answers.filter(a => a.trim().length > 0);
    if (filled.length < 2 || loading) return;
    setLoading(true);
    setError('');
    onAsk?.();
    startCycle();
    startHapticBreathPulse();
    const payload = data.diagnosticQuestions.map((q, i) => `Q: ${q}\nA: ${answers[i] || '(no answer)'}`).join('\n\n');
    const messages: Message[] = [{
      role: 'user',
      content: `The seeker has answered the diagnostic questions. Based on these answers, name the archetypes from the ${LINEAGES[lineage].tradition} field that are most active for this seeker. Introduce them briefly before the card display.\n\n${payload}`,
    }];
    try {
      const res = await fetch('/api/divine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages, lineageKey: lineage, mode: 'archetypes', languageName }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(apiErrorMessage(d, t, tp, `HTTP ${res.status}`));
      setSurfaceText(d.text);
      setPhase('revealed');
    } catch (err: any) {
      setError(err?.message || t('council.error_default'));
    } finally {
      stopCycle();
      stopHapticBreathPulse();
      setLoading(false);
    }
  }, [answers, loading, data, lin, lineage, startCycle, stopCycle, t, tp, languageName]);

  return (
    <div>
      <div style={{ marginBottom: 22, textAlign: 'center' }}>
        <div style={{ fontSize: '0.62rem', letterSpacing: '0.38em', color: accent, textTransform: 'uppercase', marginBottom: 6 }}>
          {t('arch_tab.title', { tradition: lin.tradition })}
        </div>
        <div style={{ fontStyle: 'italic', color: C.ash, fontSize: '1.0rem', lineHeight: 1.8 }}>
          {phase === 'questions'
            ? <WordReveal text={t('arch_tab.intro')} />
            : t('arch_tab.present', { tradition: lin.tradition })}
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
                  padding: '10px 14px', resize: 'vertical', boxSizing: 'border-box',
                }}
              />
            </div>
          ))}
          {error && <div style={{ color: C.blood, fontStyle: 'italic', fontSize: '0.88rem', marginBottom: 10 }}>{error}</div>}
          {loading ? <EmberDots text={t(LOADING_LINES[loadingIdx])} /> : (
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
              {t('arch_tab.surface')}
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
                {t('arch_tab.names_stir')}
              </div>
              <OracleText text={surfaceText} />
            </div>
          )}
          <Divider symbol="◆" />
          <div style={{ fontSize: '0.56rem', letterSpacing: '0.3em', color: C.smoke, textTransform: 'uppercase', marginBottom: 18, opacity: 0.55, textAlign: 'center' }}>
            {t('arch_tab.cards_title', { tradition: lin.tradition })}
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
            ◇ &nbsp; {t('arch_tab.return')} &nbsp; ◇
          </button>
        </div>
      )}
    </div>
  );
}

// ─── TAB: COUNCIL (existing oracle flow) ──────────────────────────────────────

type CouncilQuestion = { label: string; text: string };
const COUNCIL_QUESTION_KEYS: Array<[MessageKey, MessageKey]> = [
  ['council.q1_label', 'council.q1_text'],
  ['council.q2_label', 'council.q2_text'],
  ['council.q3_label', 'council.q3_text'],
  ['council.q4_label', 'council.q4_text'],
  ['council.q5_label', 'council.q5_text'],
];
type AskMode = 'own' | 'choose';

function CouncilTab({ lineage, priorMythContext, signedIn, soundEnabled = false, onAsk, birthDate, hasMythStatement, figureContinue = false, isNewSeeker }: { lineage: LineageKey; priorMythContext?: string; signedIn?: boolean; soundEnabled?: boolean; onAsk?: () => void; birthDate?: string; hasMythStatement?: boolean; figureContinue?: boolean; isNewSeeker?: boolean }) {
  const { t, tp, languageName } = useLanguage();
  const lin = useLocalizedLineages()[lineage];
  const COUNCIL_QUESTIONS: CouncilQuestion[] = COUNCIL_QUESTION_KEYS.map(([label, text]) => ({ label: t(label), text: t(text) }));
  const accent = lin.palette.primary;
  // Opens straight into the free-text ask -- the old two-card "Ask Your Own
  // Question / Choose a Question" chooser screen was removed. The curated
  // questions are still reachable via the quiet toggle under the input.
  const [askMode, setAskMode] = useState<AskMode>('own');
  // After the first Reading has landed, the seeker picks how to continue:
  // 'deepen' sends the next turn as a Reading with chainAction: 'deepen' (the
  // server grafts the prior chain); 'question' is the original free-text
  // council follow-up. null = neither chosen yet (the two-button fork shows).
  const [followMode, setFollowMode] = useState<null | 'deepen' | 'question'>(null);
  const [input, setInput] = useState('');
  const [selectedQ, setSelectedQ] = useState<CouncilQuestion | null>(null);
  const [history, setHistory] = useState<Message[]>([]);
  const [firstReading, setFirstReading] = useState<string | null>(null);
  // The machine-readable provenance stamp for firstReading specifically --
  // threaded to ShareableCard so it can be embedded in the exported PNG
  // and, for a signed-in seeker, the persisted share_card row. Only ever
  // set alongside firstReading itself (see runConsult below), never for a
  // thread follow-up -- the card feature only ever cards the first reading.
  const [firstReadingProvenance, setFirstReadingProvenance] = useState<Record<string, unknown> | null>(null);
  const [firstReadingArchetype, setFirstReadingArchetype] = useState<string | null>(null);
  // Depth-stage proposals (migrations 020/021) awaiting the seeker's own
  // affirmation -- see StageUpOffer.tsx. Set alongside firstReading, same
  // lifecycle as firstReadingArchetype above.
  const [pendingStageUps, setPendingStageUps] = useState<Array<{ trajectoryId: number; markerType: string; markerValue: string; pendingStage: 'surface' | 'confronted' | 'integrated' }>>([]);
  // A welfare-crisis hard-block (ceilingCategory: 'welfare_crisis' from
  // app/api/divine/route.ts's §5.4 hard block) never becomes firstReading
  // or a thread entry -- see the interception in runConsult below. Kept as
  // its own chronological list, separate from the ceremonial reveal
  // pipeline, so it renders plainly and immediately regardless of whether
  // it happens to be the seeker's first exchange or a council follow-up.
  const [crisisNotices, setCrisisNotices] = useState<string[]>([]);
  // Session-scoped id for the persisted visit_record row this first reading
  // wrote (signed-in seekers only, DB-backed -- null otherwise). Feeds
  // MarkerOffer, mirroring firstReadingProvenance's set-alongside-firstReading
  // lifecycle below.
  const [visitId, setVisitId] = useState<string | null>(null);
  const [thread, setThread] = useState<ThreadEntry[]>([]);
  // Segmented delivery (lib/segmentedDelivery.ts): the Elder gives the first
  // Reading in short portions, each closed by a follow-up question. These
  // are the portions delivered so far; the final one still becomes
  // firstReading (so the closing ritual, card, journal and letter all fire
  // once, at the end). segmentsRef is the count sent back to the server.
  const [readingSegments, setReadingSegments] = useState<ThreadEntry[]>([]);
  // Figure Continuity (docs/figure-continuity-spec.md v0.2): a pairing the Elder
  // offered, awaiting the seeker's own "That fits" / "Not quite". Each response
  // may carry one offer; only the NEWEST is live (the server keeps one per
  // chain), and its controls appear only once that telling has finished
  // revealing ('settled'). Nothing here is set unless the server sent an offer,
  // which it does only while the feature is lit.
  const [firstReadingOffer, setFirstReadingOffer] = useState<MappingOffer | null>(null);
  const [firstReadingHeld, setFirstReadingHeld] = useState(false);
  const [activeOfferId, setActiveOfferId] = useState<number | null>(null);
  const [settled, setSettled] = useState<Record<string, boolean>>({});
  const markSettled = useCallback((key: string) => setSettled(prev => (prev[key] ? prev : { ...prev, [key]: true })), []);
  // The seeker's answers, kept here (not in the controls) because a follow-up turn unmounts and
  // remounts the reading; an answered pairing must not be offered again.
  const [offerResults, setOfferResults] = useState<Record<number, OfferResult>>({});
  const segmentsRef = useRef(0);
  // Myth-first (docs/myth-first-spec.md, MF-5): the figure the server chose on
  // segment 0, sent back on segments 1 and 2 so the telling stays on one
  // figure. Advisory: the server validates it against the lineage's catalog.
  const figureRef = useRef<string | null>(null);
  // The seeker's reply that led into the final portion (shown between the
  // earlier portions and the Reading itself).
  const [finalSeekerReply, setFinalSeekerReply] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingIdx, setLoadingIdx] = useState(0);
  const [error, setError] = useState('');
  const [lastAttempt, setLastAttempt] = useState('');
  const [readyToRead, setReadyToRead] = useState(false);
  const [shakeKey, setShakeKey] = useState(0);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [cardOpen,   setCardOpen]   = useState(false);
  // Placeholder cast: never rendered as-is -- cardOpen only flips true
  // right after setCardLine receives a real pullQuote() result below.
  const [cardLine,   setCardLine]   = useState<CardQuote>('' as CardQuote);
  // The letter just kept (signed-in, saved). Lets the seeker choose, right
  // away, whether THIS letter is emailed back to them and after how long.
  const [keptLetterId, setKeptLetterId] = useState<number | null>(null);
  const [cardMarker, setCardMarker] = useState<MarkerType>('pattern');
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const threadEndRef = useRef<HTMLDivElement>(null);

  const stopCycle = useCallback(() => { if (intervalRef.current) clearInterval(intervalRef.current); }, []);
  const startCycle = useCallback(() => {
    setLoadingIdx(0);
    let idx = 0;
    intervalRef.current = setInterval(() => { idx = (idx + 1) % LOADING_LINES.length; setLoadingIdx(idx); }, 2200);
  }, []);
  useEffect(() => () => stopCycle(), [stopCycle]);

  const runConsult = useCallback(async (userText: string, currentHistory: Message[], isReadingMode: boolean, chainAction?: 'deepen') => {
    const saved = currentHistory;
    const next: Message[] = [...currentHistory, { role: 'user', content: userText }];
    setLoading(true);
    setError('');
    onAsk?.();
    startCycle();
    startHapticBreathPulse();
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
        // chainAction: 'deepen' asks the server to continue this seeker's most
        // recent chain at the next depth (app/api/divine/route.ts derives the
        // chainId server-side from the session — never trusted from here — and
        // silently falls back to a fresh chain unless all four of its gates
        // hold: signed in, reading mode, sub-crisis welfare, same lineage).
        body: JSON.stringify({ messages: next, lineageKey: lineage, mode: isReadingMode ? 'reading' : 'council', priorMythContext, birthDate, languageName, ...divineFigureFields({ figureContinue, isReadingMode, chainAction }), ...(!firstReading ? { segmented: true, segment: segmentsRef.current } : {}), ...(!firstReading && isNewSeeker ? { readingForm: 'myth_first', ...(figureRef.current ? { figure: figureRef.current } : {}) } : {}) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(apiErrorMessage(data, t, tp, `HTTP ${res.status}`));
      const elderText: string = data.text;
      const full: Message[] = [...next, { role: 'assistant', content: elderText }];
      setHistory(full);
      if (typeof data.remaining === 'number') setRemaining(data.remaining);
      if (data.readyToRead) setReadyToRead(true);
      const mappingOffer = readMappingOffer(data);
      const mappingHeld = readMappingHeld(data);
      if (mappingOffer) setActiveOfferId(mappingOffer.id);
      // Only a non-final portion of a myth-first Reading keeps the figure.
      figureRef.current =
        data.form === 'myth_first' && data.moreToCome === true && typeof data.figure === 'string' ? data.figure : null;

      // A response that still carries the READY signal is the model asking
      // its one allowed clarifying question, not delivering the Reading —
      // per the clarify-before-decline instruction in system-prompt-builder.ts.
      // Keep firstReading unset so the seeker's reply is still treated as the
      // opening exchange and gets resent with mode: 'reading' (forcing a real
      // answer, not a second question). Mirrors Threshold.tsx's runConsult.
      const isClarifyingQuestion = !isReadingMode && data.readyToRead;

      // A welfare-crisis hard-block (app/api/divine/route.ts §5.4) must never
      // become firstReading or a thread entry -- both feed OracleResponse's
      // ceremonial reveal and, for firstReading specifically, the "Keep as
      // Card" / guided-journal-prompt flow that follows it. None of that
      // belongs on a crisis redirect. history above already carries the
      // exchange, so the model still has context if the seeker keeps
      // talking -- only the display path is intercepted here.
      if (data.ceilingCategory === 'welfare_crisis') {
        // A crisis notice ends the segmented Reading: the server rebuilds
        // the Reading from the last N assistant turns, so a notice left in
        // that window would be stitched into it. Any later message starts a
        // fresh Reading rather than continuing this one.
        segmentsRef.current = 0;
        figureRef.current = null;
        setCrisisNotices(n => [...n, elderText]);
        if (soundEnabled) {
          stopHeartbeatDrum();
        }
      } else if (!firstReading && data.moreToCome === true && !isClarifyingQuestion) {
        // A non-final portion of a segmented Reading: show it with its
        // follow-up question and wait for the seeker. Not the Reading yet,
        // so firstReading, the card, journal and letter stay untouched.
        segmentsRef.current += 1;
        setReadingSegments(s => [...s, { seeker: userText, elder: elderText, ...(mappingOffer ? { mappingOffer } : {}), ...(mappingHeld ? { mappingHeld } : {}) }]);
        setAskMode('own');
        setTimeout(() => threadEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 120);
        if (soundEnabled) {
          stopHeartbeatDrum();
        }
      } else if (!firstReading && !isClarifyingQuestion) {
        if (segmentsRef.current > 0) setFinalSeekerReply(userText);
        setFirstReading(elderText);
        setFirstReadingProvenance(data._provenance ?? null);
        setFirstReadingArchetype(typeof data.archetypeName === 'string' ? data.archetypeName : null);
        setPendingStageUps(Array.isArray(data.pendingStageUps) ? data.pendingStageUps : []);
        setVisitId(typeof data.visitId === 'string' ? data.visitId : null);
        setFirstReadingOffer(mappingOffer);
        setFirstReadingHeld(mappingHeld);
        // OracleResponse is about to mount on this new text and will claim
        // the still-running (quickened) drum ref itself — leave it running.
      } else {
        setThread(t => [...t, { seeker: userText, elder: elderText, ...(mappingOffer ? { mappingOffer } : {}), ...(mappingHeld ? { mappingHeld } : {}) }]);
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
      setError(err?.message || t('council.error_default'));
      // No reading follows an error, so OracleResponse never mounts to take
      // over this ref — release it here or the quickened drum plays forever.
      if (soundEnabled) {
        stopHeartbeatDrum();
      }
    } finally {
      stopCycle();
      // Unlike the heartbeat drum above, the haptic pulse has no "continue
      // into the reveal" concept -- it marks the wait itself, so it always
      // stops here regardless of which branch above ran.
      stopHapticBreathPulse();
      setLoading(false);
      // On success, ownership of the still-running (quickened) drum passes
      // to OracleResponse, which will claim the existing ref instead of
      // adding its own, ease it to resting tempo, and stop it once the
      // reveal completes.
    }
  }, [lineage, firstReading, startCycle, stopCycle, priorMythContext, birthDate, soundEnabled, figureContinue, t, tp, languageName, isNewSeeker]);

  const consult = useCallback(() => {
    if (loading) return;
    const text = input.trim() || selectedQ?.text || '';
    if (!text) { setShakeKey(k => k + 1); inputRef.current?.focus(); return; }
    setLastAttempt(text);
    if (firstReading) {
      const deepen = followMode === 'deepen';
      runConsult(text, history, deepen, deepen ? 'deepen' : undefined);
    } else {
      runConsult(text, history, (readyToRead || segmentsRef.current > 0) && !firstReading);
    }
  }, [input, selectedQ, history, runConsult, loading, readyToRead, firstReading, followMode]);

  const reset = useCallback(() => {
    stopCycle();
    setHistory([]);
    setFirstReading(null);
    setFirstReadingProvenance(null);
    setFirstReadingArchetype(null);
    setPendingStageUps([]);
    setVisitId(null);
    setThread([]);
    setReadingSegments([]);
    setFirstReadingOffer(null);
    setFirstReadingHeld(false);
    setActiveOfferId(null);
    setSettled({});
    setFinalSeekerReply('');
    segmentsRef.current = 0;
    figureRef.current = null;
    setInput('');
    setSelectedQ(null);
    setError('');
    setLastAttempt('');
    setAskMode('own');
    setFollowMode(null);
    setReadyToRead(false);
  }, [stopCycle]);

  // While a turn is loading the Reading (and its segments) unmount and will reveal again, so forget
  // that they had settled: their controls reappear only after the telling has revealed again. Thread
  // entries never unmount, so their flags are kept: an unanswered pairing there stays answerable until
  // a newer one replaces it.
  useEffect(() => {
    if (loading) setSettled(prev => Object.fromEntries(Object.entries(prev).filter(([key]) => key.startsWith('thread-'))));
  }, [loading]);

  // Figure Continuity: what sits beneath a telling that carried an offer. Nothing
  // until that telling has settled; then, for the newest offer only, the two
  // controls; or, if the ledger could not hold the pairing, a plain named line
  // (never a silent success). Renders null for every ordinary reading.
  const offerBlock = (key: string, offer: MappingOffer | null | undefined, held: boolean | undefined) => {
    if (!settled[key]) return null;
    if (offer && offer.id === activeOfferId) {
      return (
        <MappingOfferControls
          key={offer.id}
          offer={offer}
          accent={accent}
          result={offerResults[offer.id]}
          onResult={(r) => setOfferResults(prev => ({ ...prev, [offer.id]: r }))}
        />
      );
    }
    if (held) {
      return (
        <div role="status" style={{ textAlign: 'center', margin: '18px auto 0', fontStyle: 'italic', color: C.smoke, fontSize: '0.8rem', lineHeight: 1.7 }}>
          {t('council.pairing_held')}
        </div>
      );
    }
    return null;
  };

  return (
    <div>
      <div style={{ marginBottom: 22, textAlign: 'center' }}>
        <div style={{ fontSize: '0.62rem', letterSpacing: '0.38em', color: accent, textTransform: 'uppercase', marginBottom: 6 }}>
          {t('council.title')}
        </div>
        <div style={{ fontStyle: 'italic', color: C.ash, fontSize: '1.0rem', lineHeight: 1.8 }}>
          {t('council.subtitle')}
        </div>
      </div>

      {/* Welfare-crisis notices -- rendering extracted to CrisisNotice.tsx
          (PR4, decision D5) so it can be protected in CODEOWNERS at file
          granularity. See that component for why this stays outside the
          ceremonial reveal system. */}
      {crisisNotices.map((text, i) => (
        <CrisisNotice key={i} text={text} />
      ))}

      <div style={{
        background: 'rgba(8,6,4,0.93)',
        border: `1px solid ${firstReading ? 'rgba(212,168,67,0.42)' : error ? 'rgba(122,26,26,0.4)' : 'rgba(212,168,67,0.16)'}`,
        position: 'relative', marginBottom: 16, minHeight: 120,
        transition: 'border-color 0.6s ease',
      }}>
        <OracleCorners />
        <div style={{ padding: '28px 38px', minHeight: 120, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          {!firstReading && !loading && !error && readingSegments.length === 0 && (
            <div style={{ textAlign: 'center', color: C.ash, fontStyle: 'italic', fontSize: '1.0rem', lineHeight: 1.9, opacity: 0.82 }}>
              {lin.lineageGreeting}
            </div>
          )}
          {/* Portions of a segmented Reading delivered so far. While the
              Reading is in progress the latest portion is revealed in full
              ceremony; once the final portion becomes firstReading, the
              earlier portions stay above it as static text. */}
          {readingSegments.length > 0 && !loading && (
            <div style={{ marginBottom: firstReading ? 22 : 0 }}>
              {readingSegments.map((seg, i) => {
                const isLatestInProgress = !firstReading && i === readingSegments.length - 1;
                return (
                  <Fragment key={i}>
                    <ReadingSegment
                      index={i}
                      text={seg.elder}
                      seekerReply={seg.seeker}
                      isLatest={isLatestInProgress}
                      accent={accent}
                      disabled={loading}
                      onReply={isLatestInProgress ? (reply) => { setLastAttempt(reply); runConsult(reply, history, true); } : undefined}
                      onSettled={() => markSettled('seg-' + i)}
                    />
                    {offerBlock('seg-' + i, seg.mappingOffer, seg.mappingHeld)}
                  </Fragment>
                );
              })}
              {firstReading && finalSeekerReply && (
                <div style={{ color: C.smoke, fontSize: '0.82rem', fontStyle: 'italic', textAlign: 'right', opacity: 0.8, marginTop: 4, lineHeight: 1.7 }}>
                  {finalSeekerReply}
                </div>
              )}
            </div>
          )}
          {loading && <EmberDots text={t(LOADING_LINES[loadingIdx])} />}
          {error && (
            <div role="alert" style={{ textAlign: 'center' }}>
              <div style={{ color: C.blood, fontStyle: 'italic', fontSize: '0.9rem', marginBottom: 10 }}>
                {t('council.unreachable')}
              </div>
              <div style={{ color: 'rgba(122,26,26,0.75)', fontSize: '0.71rem', wordBreak: 'break-word', maxWidth: 420, margin: '0 auto 14px', lineHeight: 1.65 }}>{error}</div>
              {lastAttempt && (
                <button onClick={() => runConsult(lastAttempt, history, (readyToRead || segmentsRef.current > 0) && !firstReading)} style={{
                  background: 'transparent', border: `1px solid ${C.blood}`, color: C.blood,
                  fontFamily: "'Gentium Plus',Georgia,serif", fontSize: '0.61rem', letterSpacing: '0.2em',
                  padding: '8px 18px', cursor: 'pointer', textTransform: 'uppercase',
                }}>{t('council.rekindle')}</button>
              )}
            </div>
          )}
          {firstReading && !loading && (
            <div style={{ animation: 'elderReveal 1.1s ease forwards' }}>
              <OracleResponse
                text={firstReading}
                lineageKey={lineage}
                archetypeName={firstReadingArchetype}
                signedIn={!!signedIn}
                onAskAgain={() => { setFirstReading(null); setFirstReadingProvenance(null); setFirstReadingArchetype(null); setPendingStageUps([]); setHistory([]); setFollowMode(null); setReadingSegments([]); setFirstReadingOffer(null); setFirstReadingHeld(false); setActiveOfferId(null); setSettled({}); setFinalSeekerReply(''); setKeptLetterId(null); segmentsRef.current = 0; figureRef.current = null; setTimeout(() => inputRef.current?.focus(), 100); }}
                soundEnabled={soundEnabled}
                hasMythStatement={hasMythStatement}
                onSettled={() => markSettled('first')}
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
                    })
                      .then(r => r.json())
                      .then(d => {
                        // Only a letter that was really saved (a Seeker-tier
                        // account keeps none) gets the choice.
                        const id = Number(d?.letterId);
                        if (d?.saved === true && Number.isInteger(id) && id > 0) setKeptLetterId(id);
                      })
                      .catch(() => {});
                  }
                }}
              />
              {offerBlock('first', firstReadingOffer, firstReadingHeld)}
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
              {cardOpen && signedIn && (
                <GuidedJournalPrompt
                  lineageKey={lineage}
                  marker={cardMarker}
                  accent={accent}
                />
              )}
              {signedIn && keptLetterId !== null && (
                <div style={{ maxWidth: 560, margin: '14px auto 0', padding: '0 20px' }}>
                  <LetterEmailChoice accent={accent} letterId={keptLetterId} />
                </div>
              )}
              <ReadingSignal
                sessionId={typeof crypto !== 'undefined' ? crypto.randomUUID() : String(Date.now())}
                lineage={lineage}
              />
              {signedIn && visitId && <MarkerOffer visitId={visitId} />}
              {signedIn && visitId && <CarryOffer visitId={visitId} />}
              {signedIn && pendingStageUps.length > 0 && (
                <StageUpOffer pendingStageUps={pendingStageUps} visitId={visitId} />
              )}
              {!signedIn && !priorMythContext && <SaveMythPrompt accent={accent} />}
            </div>
          )}
        </div>
      </div>

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
          <button onClick={() => { setAskMode('own'); setSelectedQ(null); setTimeout(() => inputRef.current?.focus(), 50); }} style={{
            background: 'transparent', border: 'none', color: C.smoke,
            fontFamily: "'Gentium Plus',Georgia,serif", fontSize: '0.56rem', letterSpacing: '0.2em',
            cursor: 'pointer', textTransform: 'uppercase', padding: '4px 0', opacity: 0.6,
          }}>
            {String.fromCharCode(8592)} {t('council.speak_own_instead')}
          </button>
        </div>
      )}

      {/* After the Reading lands: the seeker chooses how to continue.
          'Deepen this myth' takes the next turn back through the Reading
          path with chainAction: 'deepen' so the server continues this
          seeker's own chain at the next depth; 'Ask a question' is the
          original free-text council follow-up. Deepen is signed-in only \u2014
          an anonymous seeker has no chain to continue by construction. */}
      {firstReading && !followMode && !loading && (
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
          {signedIn && (
            <button onClick={() => { setFollowMode('deepen'); setInput(''); setTimeout(() => inputRef.current?.focus(), 50); }} style={{
              background: 'transparent', border: `1px solid ${C.gold}`, color: C.gold,
              fontFamily: "'Gentium Plus',Georgia,serif", fontSize: '0.63rem', letterSpacing: '0.22em',
              padding: '11px 20px', cursor: 'pointer', textTransform: 'uppercase', whiteSpace: 'nowrap',
            }}>
              {t('council.deepen')}
            </button>
          )}
          <button onClick={() => { setFollowMode('question'); setInput(''); setTimeout(() => inputRef.current?.focus(), 50); }} style={{
            background: 'transparent', border: `1px solid ${C.gold}`, color: C.gold,
            fontFamily: "'Gentium Plus',Georgia,serif", fontSize: '0.63rem', letterSpacing: '0.22em',
            padding: '11px 20px', cursor: 'pointer', textTransform: 'uppercase', whiteSpace: 'nowrap',
          }}>
            {t('council.ask_question')}
          </button>
        </div>
      )}

      {(askMode === 'own' || (firstReading && followMode)) && (
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
            placeholder={
              loading ? t('council.ph_reading')
              : followMode === 'deepen' ? t('council.ph_deepen')
              : firstReading ? t('council.ph_ask')
              : readingSegments.length > 0 ? t('council.ph_answer')
              : t('council.ph_free')
            }
            style={{
              flex: 1, minWidth: 0, background: 'rgba(255,255,255,0.022)', border: '1px solid rgba(212,168,67,0.18)',
              color: C.bone, fontFamily: "'Gentium Plus',Georgia,serif", fontStyle: 'italic', fontSize: '1.02rem',
              padding: '11px 16px', opacity: loading ? 0.5 : 1,
            }}
          />
          <button onClick={consult} disabled={loading} style={{
            background: 'transparent', border: `1px solid ${C.gold}`, color: C.gold,
            fontFamily: "'Gentium Plus',Georgia,serif", fontSize: '0.63rem', letterSpacing: '0.22em',
            padding: '11px 20px', cursor: loading ? 'not-allowed' : 'pointer',
            textTransform: 'uppercase', whiteSpace: 'nowrap', opacity: loading ? 0.32 : 1,
          }}>
            {loading ? '\u2026' : followMode === 'deepen' ? 'Deepen' : 'Consult'}
          </button>
        </div>
      )}

      {firstReading && followMode && !loading && (
        <button onClick={() => { setFollowMode(null); setInput(''); }} style={{
          background: 'transparent', border: 'none', color: C.smoke,
          fontFamily: "'Gentium Plus',Georgia,serif", fontSize: '0.56rem', letterSpacing: '0.2em',
          cursor: 'pointer', textTransform: 'uppercase', padding: '4px 0', opacity: 0.6,
        }}>
          {String.fromCharCode(8592)} {t('council.back')}
        </button>
      )}

      {askMode === 'own' && !firstReading && !loading && readingSegments.length === 0 && (
        <button onClick={() => { setAskMode('choose'); setInput(''); }} style={{
          background: 'transparent', border: 'none', color: 'var(--ink-readable)',
          fontFamily: "'Gentium Plus',Georgia,serif", fontSize: 'var(--control-type-min)', letterSpacing: '0.2em',
          cursor: 'pointer', textTransform: 'uppercase', padding: '4px 0',
        }}>
          {t('council.or_choose')}
        </button>
      )}

      {askMode === 'choose' && selectedQ && !firstReading && !loading && (
        <button onClick={consult} disabled={loading} style={{
          background: 'transparent', border: `1px solid ${C.gold}`, color: C.gold,
          fontFamily: "'Gentium Plus',Georgia,serif", fontSize: '0.63rem', letterSpacing: '0.22em',
          padding: '11px 20px', cursor: loading ? 'not-allowed' : 'pointer',
          textTransform: 'uppercase', whiteSpace: 'nowrap', display: 'block', margin: '4px auto 0',
        }}>
          {t('council.consult')}
        </button>
      )}

      {remaining !== null && remaining <= 3 && remaining > 0 && (
        <div style={{ fontSize: '0.55rem', color: C.ember, fontStyle: 'italic', marginTop: 9, opacity: 0.65 }}>
          {tp('council.remaining', remaining)}
        </div>
      )}

      {thread.length > 0 && (
        <div style={{ marginTop: 28 }}>
          <Divider symbol="◆" />
          {thread.map((entry, i) => (
            // Same framed treatment as the reading's own opening box above
            // (the "scrying mirror" itself) -- every turn of the reading
            // keeps its frame, not just the first exchange. Was a bare
            // left-border strip before; that broke the sacred/ceremonial
            // consistency the moment a seeker asked a follow-up question.
            <div key={i} style={{
              background: 'rgba(8,6,4,0.93)', border: '1px solid rgba(212,168,67,0.28)',
              padding: '24px 32px', marginBottom: 18, position: 'relative', animation: 'elderReveal 0.8s ease forwards',
            }}>
              <OracleCorners />
              <div style={{ fontSize: '0.52rem', letterSpacing: '0.26em', color: C.smoke, textTransform: 'uppercase', marginBottom: 5 }}>{t('council.seeker_speaks')}</div>
              <div style={{ color: C.ash, fontSize: '0.88rem', fontStyle: 'italic', marginBottom: 12, lineHeight: 1.72 }}>{entry.seeker}</div>
              <div style={{ fontSize: '0.52rem', letterSpacing: '0.26em', color: C.ember, textTransform: 'uppercase', marginBottom: 7 }}>{t('council.elder_answers')}</div>
              <OracleText text={entry.elder} onSettled={() => markSettled('thread-' + i)} />
              {offerBlock('thread-' + i, entry.mappingOffer, entry.mappingHeld)}
            </div>
          ))}
          <div ref={threadEndRef} />
          <button onClick={reset} style={{
            background: 'transparent', border: 'none', color: C.smoke,
            fontFamily: "'Gentium Plus',Georgia,serif", fontSize: '0.54rem', letterSpacing: '0.22em',
            cursor: 'pointer', textTransform: 'uppercase', padding: '10px 0',
            marginTop: 16, display: 'block', width: '100%', textAlign: 'center', opacity: 0.55,
          }}>
            ◇ &nbsp; {t('council.new_divination')} &nbsp; ◇
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
  pulse?: number;
  onReturn: () => void;
  priorMythContext?: string;
  signedIn?: boolean;
  birthDate?: string;
  /** Myth-as-home Part A §4: does this seeker have a current Core Myth
   *  Statement? Threaded down to ThresholdLetter for its one optional
   *  vessel-voice acknowledgment line -- never the statement's content,
   *  never a claim of connection to this reading. */
  hasMythStatement?: boolean;
  /** Figure Continuity: the seeker chose "Continue as {figure}" at arrival, for THIS sitting only.
   *  Only ever a request: the server derives the chain and evaluates every gate. */
  figureContinue?: boolean;
  /** Myth-first (MF-5): true when this seeker has no saved myth in this
   *  lineage and no core myth statement. Advisory only; the server decides
   *  (returning is per lineage, flag, welfare, delivery). */
  isNewSeeker?: boolean;
  /** Progressive-immersion, council-boundary unification: CouncilTabs no
   *  longer owns its own FireAtmosphere instance (removed below) --
   *  Threshold's single hoisted fire persists through this phase too now.
   *  This reports this tab's own pulse contribution (base `pulse` prop
   *  plus this component's local per-tab `tabPulse` bumps) up to that
   *  single instance instead. See Threshold.tsx's council branch. */
  onPulseChange?: (pulse: number) => void;
}

export default function CouncilTabs({ lineage, soundEnabled = false, pulse = 0, onReturn, priorMythContext, signedIn, birthDate, hasMythStatement, figureContinue, isNewSeeker, onPulseChange }: CouncilTabsProps) {
  useElderPhase('council'); // a steady, low attention while seeker and Elder speak
  const [activeTab, setActiveTab] = useState<TabId>('council');
  const { t } = useLanguage();
  const [showAdvanced, setShowAdvanced] = useState(false);
  const lin = useLocalizedLineages()[lineage];
  const accent = lin.palette.primary;

  // Each tab (council / mythology / archetypes) runs its own independent
  // fetch to /api/divine — none of them share Threshold's firePulse, so the
  // prop above never moves while any of them is actually being used. This
  // local pulse is what actually flares the fire when a question is asked
  // in any tab; combined with the inherited prop rather than replacing it.
  const [tabPulse, setTabPulse] = useState(0);
  const bumpFire = useCallback(() => setTabPulse(p => p + 1), []);

  // No longer renders its own FireAtmosphere (progressive-immersion,
  // council-boundary unification) -- Threshold's single hoisted fire
  // persists through this phase now. This reports the same combined
  // value (base pulse prop + this component's own per-tab bumps) up
  // to that instance instead of driving a separate one.
  useEffect(() => {
    onPulseChange?.(pulse + tabPulse);
  }, [pulse, tabPulse, onPulseChange]);

  const advancedTabs: { id: TabId; label: string }[] = [
    { id: 'mythology',  label: t('council.tab_mythology')  },
    { id: 'archetypes', label: t('council.tab_archetypes') },
  ];

  return (
    <div style={{
      minHeight: 'var(--vh-full)', background: '#0a0806', color: '#ede0c4',
      fontFamily: "'Gentium Plus',Georgia,'Times New Roman',serif", position: 'relative', overflowX: 'hidden',
    }}>

      <div style={{ maxWidth: 700, margin: '0 auto', padding: '0 20px 90px', position: 'relative', zIndex: 1 }}>
        {/* Header */}
        <div style={{ textAlign: 'center', padding: '38px 0 24px' }}>
          <div style={{ fontSize: '0.62rem', letterSpacing: '0.4em', color: accent, textTransform: 'uppercase', marginBottom: 6 }}>
            {lin.tradition} &nbsp;·&nbsp; {lin.teacherTitle}
          </div>
          <div className="fire-shadow" style={{ fontFamily: "'Cormorant Garamond',Georgia,serif", fontSize: 'clamp(1.5rem,4vw,2.2rem)', color: C.gold, letterSpacing: '0.22em', }}>
            THE ELDER
          </div>
          <div style={{ fontStyle: 'italic', color: '#a8916f', fontSize: '0.78rem', marginTop: 6 }}>
            {lin.invocation}
          </div>
        </div>

        {/* Advanced tab strip — only shown once expanded */}
        {showAdvanced && (
          <div style={{ display: 'flex', borderBottom: '1px solid rgba(212,168,67,0.16)', marginBottom: 28 }}>
            {[{ id: 'council' as TabId, label: t('council.title') }, ...advancedTabs].map(tab => (
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
        {/* Was a hard instant swap between three unrelated tab trees --
            no shared fade at all. PhaseFade keyed per tab so each
            switch gets a fresh entrance. */}
        {activeTab === 'mythology'  && <PhaseFade key="mythology"><MythologyTab  lineage={lineage} onAsk={bumpFire} /></PhaseFade>}
        {activeTab === 'archetypes' && <PhaseFade key="archetypes"><ArchetypesTab lineage={lineage} onAsk={bumpFire} /></PhaseFade>}
        {activeTab === 'council'    && <PhaseFade key="council"><CouncilTab    lineage={lineage} priorMythContext={priorMythContext} signedIn={signedIn} soundEnabled={soundEnabled} onAsk={bumpFire} birthDate={birthDate} hasMythStatement={hasMythStatement} figureContinue={figureContinue} isNewSeeker={isNewSeeker} /></PhaseFade>}

        {/* Advanced toggle */}
        <div style={{ textAlign: 'center', marginTop: 26 }}>
          <button
            onClick={() => { setShowAdvanced(a => !a); if (showAdvanced) setActiveTab('council'); }}
            style={{
              background: 'transparent', border: 'none', color: 'var(--ink-readable)',
              fontFamily: "'Gentium Plus',Georgia,serif", fontSize: 'var(--control-type-min)', letterSpacing: '0.24em',
              cursor: 'pointer', textTransform: 'uppercase',
            }}
          >
            {showAdvanced ? `◇ ${t('council.hide_deeper')} ◇` : `◇ ${t('council.show_deeper')} ◇`}
          </button>
        </div>

        {/* Return */}
        <div style={{ textAlign: 'center', marginTop: 48 }}>
          <button onClick={onReturn} style={{
            background: 'transparent', border: 'none', color: 'var(--ink-readable)',
            fontFamily: "'Gentium Plus',Georgia,serif", fontSize: 'var(--control-type-min)', letterSpacing: '0.26em',
            cursor: 'pointer', textTransform: 'uppercase',
          }}>
            ◇ &nbsp; {t('council.return')} &nbsp; ◇
          </button>
        </div>

        {/* Footer */}
        <div style={{ textAlign: 'center', marginTop: 40, paddingTop: 22, borderTop: '1px solid rgba(212,168,67,0.07)' }}>
          <div style={{ fontSize: '0.56rem', letterSpacing: '0.26em', color: '#a8916f', textTransform: 'uppercase', opacity: 0.46, lineHeight: 2.2 }}>
            ✦ &nbsp; Temporal Bridges Institute &nbsp;·&nbsp; AHAU AI &nbsp; ✦
          </div>
        </div>
      </div>
    </div>
  );
}
