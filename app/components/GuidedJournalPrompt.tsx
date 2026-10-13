'use client'
import { useEffect, useRef, useState } from 'react'
import type { LineageKey } from '../../lib/lineages'
import { useLanguage } from '../../lib/i18n/LanguageContext'
import type { MessageKey } from '../../lib/i18n/translate'
import { WordReveal } from './WordReveal'
import { startAmbientLoop, type AmbientLoop } from '../../lib/mythopoetics/cardAudio'
import { BREATH_CYCLE_MS } from '../../lib/breathTiming'

const C = {
  gold:  '#d4a843',
  ash:   '#c4b89a',
  smoke: '#a8916f',
  bone:  '#fdf6e8',
  glyph: '#c8933a',
}

// Mirrors the CANONICAL_MARKERS in app/api/threshold-letters/route.ts and
// app/api/guided-journal/route.ts — one reflective prompt per marker, plus
// a fallback for readings that never surfaced one.
const MARKER_PROMPTS: Record<string, MessageKey> = {
  wound: 'journal.prompt_wound',
  threshold: 'journal.prompt_threshold',
  pattern: 'journal.prompt_pattern',
  exile: 'journal.prompt_exile',
  figure: 'journal.prompt_figure',
}
const FALLBACK_PROMPT: MessageKey = 'journal.prompt_fallback'

// A second, deeper question offered only after the first is kept — written
// in the same voice as MARKER_PROMPTS, never model-generated. Optional:
// the seeker can stop after one reflection with no loss of ceremony.
const DEEPEN_PROMPTS: Record<string, MessageKey> = {
  wound: 'journal.deepen_wound',
  threshold: 'journal.deepen_threshold',
  pattern: 'journal.deepen_pattern',
  exile: 'journal.deepen_exile',
  figure: 'journal.deepen_figure',
}
const DEEPEN_FALLBACK: MessageKey = 'journal.deepen_fallback'

type Phase =
  | 'settling'
  | 'writing1' | 'sending1'
  | 'offer-deepen'
  | 'writing2' | 'sending2'
  | 'complete'
  | 'dismissed' | 'error'

async function saveReflection(lineageKey: string, prompt: string, response: string, marker: string | null): Promise<boolean> {
  try {
    const res = await fetch('/api/guided-journal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lineageKey, prompt, response: response.trim(), marker }),
    })
    const data = await res.json().catch(() => null)
    return !!res.ok && !!data?.saved
  } catch {
    return false
  }
}

export default function GuidedJournalPrompt({
  lineageKey,
  marker,
  accent = C.gold,
}: {
  lineageKey: LineageKey | string
  marker?: string | null
  accent?: string
}) {
  const { t } = useLanguage()
  const [phase, setPhase] = useState<Phase>('settling')
  const [promptRevealed, setPromptRevealed] = useState(false)
  const [prompt2Revealed, setPrompt2Revealed] = useState(false)
  const [response1, setResponse1] = useState('')
  const [response2, setResponse2] = useState('')
  // Mirrors ShareableCard.tsx's own audioOn convention exactly (default
  // off, explicit per-gesture toggle) rather than auto-playing off the
  // global soundEnabled flag. ShareableCard and this component render as
  // simultaneous siblings sharing one AudioContext (cardAudio.ts) — if
  // this auto-started on the same flag ShareableCard's manual toggle
  // already ignores, a seeker with both enabled would get two overlapping
  // marker-ambience loops for the same mood. Requiring the same explicit
  // gesture here removes that possibility entirely.
  const [audioOn, setAudioOn] = useState(false)
  const loopRef = useRef<AmbientLoop | null>(null)

  const prompt1 = t((marker && MARKER_PROMPTS[marker]) || FALLBACK_PROMPT)
  const prompt2 = t((marker && DEEPEN_PROMPTS[marker]) || DEEPEN_FALLBACK)

  // Settling beat — the space opens before the question does, same
  // instinct as BreathingWait.tsx's use of the sigilBreathe keyframe.
  useEffect(() => {
    const t = setTimeout(() => setPhase('writing1'), 2200)
    return () => clearTimeout(t)
  }, [])

  // Ambient bed for the marker (lib/mythopoetics/cardAudio.ts, built for
  // ShareableCard.tsx and equally at home here) — gated on the local
  // audioOn toggle only, never on soundEnabled directly (see the state
  // declaration above for why). Ramps out cleanly on toggle-off,
  // completion, or unmount rather than cutting off.
  useEffect(() => {
    if (!audioOn || phase === 'dismissed') return
    if (!loopRef.current) {
      loopRef.current = startAmbientLoop((marker as any) || 'threshold')
    }
    return () => {
      loopRef.current?.stop()
      loopRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audioOn])

  useEffect(() => {
    if (phase === 'complete' || phase === 'dismissed') {
      loopRef.current?.stop()
      loopRef.current = null
    }
  }, [phase])

  if (phase === 'dismissed') return null

  const submitFirst = async () => {
    const trimmed = response1.trim()
    if (!trimmed || phase === 'sending1') return
    setPhase('sending1')
    const ok = await saveReflection(lineageKey, prompt1, trimmed, marker ?? null)
    setPhase(ok ? 'offer-deepen' : 'error')
  }

  const submitSecond = async () => {
    const trimmed = response2.trim()
    if (!trimmed || phase === 'sending2') return
    setPhase('sending2')
    const ok = await saveReflection(lineageKey, prompt2, trimmed, marker ?? null)
    setPhase(ok ? 'complete' : 'error')
  }

  return (
    <div style={{ position: 'relative', textAlign: 'center', marginTop: 24, paddingTop: 20, borderTop: '1px solid rgba(212,168,67,0.1)' }}>
      <style>{`
        @keyframes journalSigilBreathe {
          0%, 100% { opacity: 0.55; transform: scale(1); box-shadow: 0 0 14px rgba(212,168,67,0.18); }
          50%      { opacity: 1;    transform: scale(1.08); box-shadow: 0 0 22px rgba(212,168,67,0.3); }
        }
        @keyframes journalGlyphBurst {
          0%   { opacity: 0;   transform: translate(-50%,-50%) scale(0.3); }
          35%  { opacity: 0.9; }
          100% { opacity: 0;   transform: translate(-50%,-50%) scale(2.4); }
        }
        @keyframes journalFadeUp {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @media (prefers-reduced-motion: reduce) {
          .elder-journal-motion { animation: none !important; }
        }
      `}</style>

      {phase !== 'complete' && phase !== 'error' && (
        <button
          onClick={() => setAudioOn(on => !on)}
          title={audioOn ? t('journal.mute') : t('journal.unmute')}
          style={{
            position: 'absolute', top: 0, right: 0,
            background: 'transparent', border: 'none', cursor: 'pointer',
            color: audioOn ? accent : C.smoke, fontSize: '0.9rem', opacity: audioOn ? 0.85 : 0.4,
            padding: 4,
          }}
        >
          {audioOn ? '⦜' : '∅'}
        </button>
      )}

      {phase === 'settling' && (
        <div style={{ padding: '18px 0' }}>
          <div
            className="elder-journal-motion"
            style={{
              width: 40, height: 40, margin: '0 auto 14px', borderRadius: '50%',
              border: `1px solid ${accent}`,
              background: `radial-gradient(circle, ${accent}22, transparent 70%)`,
              animationName: 'journalSigilBreathe',
              animationDuration: `${Math.min(BREATH_CYCLE_MS, 2600)}ms`,
              animationTimingFunction: 'ease-in-out',
              animationIterationCount: 'infinite',
            }}
          />
          <div style={{ fontStyle: 'italic', color: C.smoke, fontSize: '0.8rem', letterSpacing: '0.04em' }}>
            {t('journal.room')}
          </div>
        </div>
      )}

      {(phase === 'writing1' || phase === 'sending1') && (
        <div className="elder-journal-motion" style={{ animation: 'journalFadeUp 0.7s ease both' }}>
          <div style={{ fontStyle: 'italic', color: C.bone, fontSize: '0.92rem', lineHeight: 1.85, marginBottom: 14, maxWidth: 460, margin: '0 auto 14px' }}>
            <WordReveal text={prompt1} breathSynced carved onComplete={() => setPromptRevealed(true)} />
          </div>

          {promptRevealed && (
            <div className="elder-journal-motion" style={{ animation: 'journalFadeUp 0.6s ease both' }}>
              <textarea
                value={response1}
                onChange={e => setResponse1(e.target.value)}
                placeholder={t('journal.placeholder')}
                disabled={phase === 'sending1'}
                rows={4}
                style={{
                  background: 'rgba(255,255,255,0.022)', border: '1px solid rgba(212,168,67,0.18)',
                  color: C.ash, fontFamily: "'Gentium Plus',Georgia,serif", fontStyle: 'italic', fontSize: '0.92rem',
                  padding: '12px 14px', outline: 'none', width: '100%', maxWidth: 420, resize: 'vertical',
                  lineHeight: 1.7,
                }}
              />
              <div style={{ marginTop: 10 }}>
                <button
                  onClick={submitFirst}
                  disabled={phase === 'sending1' || !response1.trim()}
                  style={{
                    background: 'transparent', border: `1px solid ${accent}`, color: accent,
                    fontFamily: "'Gentium Plus',Georgia,serif", fontSize: '0.6rem', letterSpacing: '0.2em',
                    padding: '9px 20px', cursor: phase === 'sending1' ? 'not-allowed' : 'pointer',
                    textTransform: 'uppercase', opacity: phase === 'sending1' || !response1.trim() ? 0.5 : 1,
                  }}
                >
                  {phase === 'sending1' ? '…' : t('journal.keep_reflection')}
                </button>
              </div>
              <button
                onClick={() => setPhase('dismissed')}
                style={{
                  background: 'transparent', border: 'none', color: C.smoke,
                  fontFamily: "'Gentium Plus',Georgia,serif", fontSize: '0.56rem', letterSpacing: '0.18em',
                  cursor: 'pointer', textTransform: 'uppercase', padding: '10px 0 0', opacity: 0.5,
                }}
              >
                {t('journal.not_now')}
              </button>
            </div>
          )}
        </div>
      )}

      {phase === 'offer-deepen' && (
        <div className="elder-journal-motion" style={{ animation: 'journalFadeUp 0.7s ease both' }}>
          <div style={{ fontStyle: 'italic', color: C.ash, fontSize: '0.85rem', lineHeight: 1.7, marginBottom: 14 }}>
            {t('journal.written')}
          </div>
          <div style={{ fontStyle: 'italic', color: C.smoke, fontSize: '0.8rem', marginBottom: 14, opacity: 0.85 }}>
            {t('journal.more_here')}
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button
              onClick={() => setPhase('writing2')}
              style={{
                background: 'transparent', border: `1px solid ${accent}`, color: accent,
                fontFamily: "'Gentium Plus',Georgia,serif", fontSize: '0.6rem', letterSpacing: '0.2em',
                padding: '9px 20px', cursor: 'pointer', textTransform: 'uppercase',
              }}
            >
              {t('journal.go_deeper')}
            </button>
            <button
              onClick={() => setPhase('complete')}
              style={{
                background: 'transparent', border: `1px solid ${C.smoke}55`, color: C.smoke,
                fontFamily: "'Gentium Plus',Georgia,serif", fontSize: '0.6rem', letterSpacing: '0.2em',
                padding: '9px 20px', cursor: 'pointer', textTransform: 'uppercase',
              }}
            >
              {t('journal.enough')}
            </button>
          </div>
        </div>
      )}

      {(phase === 'writing2' || phase === 'sending2') && (
        <div className="elder-journal-motion" style={{ animation: 'journalFadeUp 0.7s ease both' }}>
          <div style={{ fontStyle: 'italic', color: C.bone, fontSize: '0.92rem', lineHeight: 1.85, marginBottom: 14, maxWidth: 460, margin: '0 auto 14px' }}>
            <WordReveal text={prompt2} breathSynced carved onComplete={() => setPrompt2Revealed(true)} />
          </div>

          {prompt2Revealed && (
            <div className="elder-journal-motion" style={{ animation: 'journalFadeUp 0.6s ease both' }}>
              <textarea
                value={response2}
                onChange={e => setResponse2(e.target.value)}
                placeholder={t('journal.placeholder')}
                disabled={phase === 'sending2'}
                rows={4}
                style={{
                  background: 'rgba(255,255,255,0.022)', border: '1px solid rgba(212,168,67,0.18)',
                  color: C.ash, fontFamily: "'Gentium Plus',Georgia,serif", fontStyle: 'italic', fontSize: '0.92rem',
                  padding: '12px 14px', outline: 'none', width: '100%', maxWidth: 420, resize: 'vertical',
                  lineHeight: 1.7,
                }}
              />
              <div style={{ marginTop: 10 }}>
                <button
                  onClick={submitSecond}
                  disabled={phase === 'sending2' || !response2.trim()}
                  style={{
                    background: 'transparent', border: `1px solid ${accent}`, color: accent,
                    fontFamily: "'Gentium Plus',Georgia,serif", fontSize: '0.6rem', letterSpacing: '0.2em',
                    padding: '9px 20px', cursor: phase === 'sending2' ? 'not-allowed' : 'pointer',
                    textTransform: 'uppercase', opacity: phase === 'sending2' || !response2.trim() ? 0.5 : 1,
                  }}
                >
                  {phase === 'sending2' ? '…' : t('journal.keep_too')}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {phase === 'complete' && (
        <div style={{ position: 'relative', minHeight: 60 }}>
          <span
            className="elder-journal-motion"
            style={{
              position: 'absolute', top: 0, left: '50%',
              animation: 'journalGlyphBurst 1.8s cubic-bezier(0.16,1,0.3,1) both',
              color: C.glyph, fontSize: '1.4rem',
            }}
          >
            ⟡
          </span>
          <div className="elder-journal-motion" style={{ animation: 'journalFadeUp 1s ease 0.4s both', paddingTop: 30 }}>
            <div style={{ fontStyle: 'italic', color: C.ash, fontSize: '0.85rem', lineHeight: 1.7 }}>
              {t('journal.sealed')}
            </div>
          </div>
        </div>
      )}

      {phase === 'error' && (
        <div style={{ color: '#7a1a1a', fontSize: '0.7rem', fontStyle: 'italic', marginTop: 8 }}>
          {t('journal.error')}
        </div>
      )}
    </div>
  )
}
