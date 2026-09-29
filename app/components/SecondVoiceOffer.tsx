'use client'

// SecondVoiceOffer.tsx
//
// Brainstorm item #4, full pass: "a genuine council moment — 2-3 voices
// asked simultaneously and rendered as a real disagreement/consensus
// map." The first pass here asked ONE other voice; this lets a seeker
// pick up to MAX_VOICES at once and see them resolve independently,
// side by side, as each one finishes.
//
// Deliberately NOT a cross-voice synthesis, still. Each fetch is its own
// single-turn /api/divine call with no history, no priorMythContext, and
// -- this is the part that matters even more with several voices on
// screen at once -- no awareness that any OTHER voice was asked the same
// question. "Full pass" for this feature means more independent voices
// rendered together, never voices that reference or respond to each
// other; blending them would risk exactly the melting-pot harm Lineage
// Integrity of Voice exists to prevent (see
// docs/fire-container-decision.md, lib/lineages.ts's C7 comment). The
// seeker is the only one doing any comparing here — the app never does
// it for them.
import { useState } from 'react'
import { LINEAGES, type LineageKey } from '../../lib/lineages'
import type { NarrativeRegister } from './RegisterSwitch'

const C = {
  gold: '#d4a843',
  bone: '#ede0c4',
  ash: '#c4b89a',
  smoke: '#a8916f',
  blood: '#7a1a1a',
}

const MAX_VOICES = 3

type Phase = 'idle' | 'picking' | 'asking'
type VoiceResult =
  | { status: 'loading' }
  | { status: 'done'; text: string }
  | { status: 'error' }

export default function SecondVoiceOffer({
  originalQuestion,
  currentLineage,
  narrativeRegister,
  birthDate,
  accent = C.gold,
}: {
  originalQuestion: string
  currentLineage: LineageKey
  narrativeRegister?: NarrativeRegister
  birthDate?: string | null
  accent?: string
}) {
  const [phase, setPhase] = useState<Phase>('idle')
  const [selected, setSelected] = useState<LineageKey[]>([])
  const [results, setResults] = useState<Partial<Record<LineageKey, VoiceResult>>>({})

  const options = (Object.keys(LINEAGES) as LineageKey[]).filter(
    (k) => k !== currentLineage && k !== 'default'
  )

  function toggle(key: LineageKey) {
    setSelected((prev) => {
      if (prev.includes(key)) return prev.filter((k) => k !== key)
      if (prev.length >= MAX_VOICES) return prev
      return [...prev, key]
    })
  }

  async function askSelected() {
    if (selected.length === 0) return
    setPhase('asking')
    setResults(Object.fromEntries(selected.map((k) => [k, { status: 'loading' as const }])))

    // Independent, parallel, un-awaited-of-each-other -- each voice
    // resolves and paints as soon as its own fetch returns, not gated on
    // the slowest one, and none of them ever sees another's result.
    selected.forEach((key) => {
      fetch('/api/divine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: originalQuestion }],
          lineageKey: key,
          mode: 'reading',
          narrativeRegister,
          birthDate,
        }),
      })
        .then((res) => res.json().then((data) => ({ ok: res.ok, data })))
        .then(({ ok, data }) => {
          if (!ok || typeof data?.text !== 'string') throw new Error('bad response')
          setResults((prev) => ({ ...prev, [key]: { status: 'done', text: data.text } }))
        })
        .catch(() => {
          setResults((prev) => ({ ...prev, [key]: { status: 'error' } }))
        })
    })
  }

  if (!originalQuestion.trim() || options.length === 0) return null

  return (
    <div style={{ marginTop: 24, paddingTop: 20, borderTop: '1px solid rgba(212,168,67,0.1)' }}>
      {phase === 'idle' && (
        <div style={{ textAlign: 'center' }}>
          <button
            onClick={() => setPhase('picking')}
            style={{
              background: 'transparent', border: `1px solid ${accent}55`, color: accent,
              fontFamily: "'Gentium Plus', Georgia, serif", fontSize: '0.62rem', letterSpacing: '0.2em',
              padding: '10px 22px', cursor: 'pointer', textTransform: 'uppercase',
            }}
          >
            Ask Other Voices
          </button>
        </div>
      )}

      {phase === 'picking' && (
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontStyle: 'italic', color: C.smoke, fontSize: '0.78rem', marginBottom: 12 }}>
            Which voices should sit with the same question? (up to {MAX_VOICES})
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center', marginBottom: 16 }}>
            {options.map((key) => {
              const l = LINEAGES[key]
              const isOn = selected.includes(key)
              const disabled = !isOn && selected.length >= MAX_VOICES
              return (
                <button
                  key={key}
                  onClick={() => toggle(key)}
                  disabled={disabled}
                  style={{
                    background: isOn ? `${l.palette.primary}18` : 'transparent',
                    border: `1px solid ${l.palette.primary}${isOn ? 'aa' : '55'}`, color: l.palette.primary,
                    fontFamily: "'Gentium Plus', Georgia, serif", fontSize: '0.68rem', letterSpacing: '0.06em',
                    padding: '8px 14px', cursor: disabled ? 'default' : 'pointer',
                    opacity: disabled ? 0.4 : 1,
                  }}
                >
                  {l.label}
                </button>
              )
            })}
          </div>
          <button
            onClick={askSelected}
            disabled={selected.length === 0}
            style={{
              background: 'transparent', border: `1px solid ${accent}`, color: accent,
              fontFamily: "'Gentium Plus', Georgia, serif", fontSize: '0.6rem', letterSpacing: '0.2em',
              padding: '9px 20px', cursor: selected.length === 0 ? 'default' : 'pointer',
              textTransform: 'uppercase', opacity: selected.length === 0 ? 0.4 : 1,
            }}
          >
            {selected.length === 0 ? 'Choose at Least One' : `Ask ${selected.length} ${selected.length === 1 ? 'Voice' : 'Voices'}`}
          </button>
        </div>
      )}

      {phase === 'asking' && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: `repeat(auto-fit, minmax(240px, 1fr))`,
          gap: 16,
        }}>
          {selected.map((key) => {
            const l = LINEAGES[key]
            const a = l.palette.primary
            const result = results[key]
            return (
              <div key={key} style={{
                padding: '18px 20px',
                border: `1px solid ${a}33`,
                background: 'rgba(255,255,255,0.015)',
              }}>
                <div style={{
                  fontSize: '0.56rem', letterSpacing: '0.22em', textTransform: 'uppercase',
                  color: a, opacity: 0.85, marginBottom: 10, textAlign: 'center',
                }}>
                  {l.label}
                </div>
                {(!result || result.status === 'loading') && (
                  <div style={{ textAlign: 'center', fontStyle: 'italic', color: C.smoke, fontSize: '0.8rem' }}>
                    considering…
                  </div>
                )}
                {result?.status === 'error' && (
                  <div style={{ textAlign: 'center', color: C.blood, fontStyle: 'italic', fontSize: '0.76rem' }}>
                    This voice could not be reached.
                  </div>
                )}
                {result?.status === 'done' && (
                  <div style={{ fontStyle: 'italic', color: C.bone, fontSize: '0.88rem', lineHeight: 1.75, textAlign: 'center' }}>
                    {result.text}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
