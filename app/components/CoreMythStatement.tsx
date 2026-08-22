'use client'

import { useEffect, useState } from 'react'
import { WordReveal } from './WordReveal'
import { BREATH_CYCLE_MS } from '../../lib/breathTiming'

const C = {
  gold:  '#d4a843',
  ash:   '#c4b89a',
  smoke: '#a8916f',
  bone:  '#fdf6e8',
}

type Eligibility =
  | { status: 'not_eligible'; integratedCount: number }
  | { status: 'invited'; integratedCount: number }
  | { status: 'dismissed'; integratedCount: number }

interface Material {
  trajectoryId: number
  markerType: string
  markerValue: string
}

interface StatementRecord {
  id: number
  version: number
  bodyText: string
  sourceMarkerIds: number[]
  createdAt: string
  supersededAt: string | null
}

type Phase =
  | 'loading' | 'hidden'
  | 'quiet-entry'       // dismissed, or already has a statement: low-key open-to-revise
  | 'settling'          // ceremonial invitation, before material reveals
  | 'revealing'         // material items appearing one at a time
  | 'writing'
  | 'sending'
  | 'saved'
  | 'error'

const OFFER_LINE =
  "Three things you have named and returned to, until they became yours. What they add up to is yours alone to say."
const WRITE_PROMPT =
  'What is the story you now recognize? Write it as you would tell it to yourself.'
const SAVED_LINE =
  "Something you wrote has changed what you carry — not the myth, but your own naming of it."

/**
 * The Core Myth Statement (migration 022) -- self-contained, fetches its
 * own eligibility/material/current statement. The Elder never drafts
 * this: material below is rendered as a raw, unconnected list (no join,
 * no wrapping sentence -- see assembleIntegratedMaterial's own header for
 * the structural, not just promptly, non-connection guarantee this
 * mirrors client-side). body_text is entirely the seeker's own words --
 * no AI-assist, no autocomplete, no suggested phrasing anywhere in this
 * component.
 */
export default function CoreMythStatement() {
  const [phase, setPhase] = useState<Phase>('loading')
  const [eligibility, setEligibility] = useState<Eligibility | null>(null)
  const [material, setMaterial] = useState<Material[]>([])
  const [current, setCurrent] = useState<StatementRecord | null>(null)
  const [materialRevealed, setMaterialRevealed] = useState(false)
  const [bodyText, setBodyText] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/elder/core-myth-statement')
      .then(r => r.json())
      .then(data => {
        if (!data?.eligibility) { setPhase('hidden'); return }
        setEligibility(data.eligibility)
        setMaterial(data.material ?? [])
        setCurrent(data.current ?? null)
        if (data.eligibility.status === 'not_eligible') {
          setPhase('hidden')
        } else if (data.current) {
          // Already has a statement -- always the quiet entry point,
          // regardless of invited/dismissed (revising is never gated
          // behind the same ceremonial re-invitation a first writing is).
          setPhase('quiet-entry')
        } else if (data.eligibility.status === 'invited') {
          setPhase('settling')
        } else {
          setPhase('quiet-entry')
        }
      })
      .catch(() => setPhase('hidden'))
  }, [])

  useEffect(() => {
    if (phase !== 'settling') return
    const t = setTimeout(() => setPhase('revealing'), 2400)
    return () => clearTimeout(t)
  }, [phase])

  useEffect(() => {
    if (phase !== 'revealing') return
    setMaterialRevealed(false)
    // Mount with opacity 0 first, then flip -- lets the per-item
    // transitionDelay below actually stagger the fade-in instead of every
    // item appearing at once.
    const t = setTimeout(() => setMaterialRevealed(true), 50)
    return () => clearTimeout(t)
  }, [phase])

  async function dismiss() {
    setPhase('quiet-entry')
    fetch('/api/elder/core-myth-statement/dismiss', { method: 'POST' }).catch(() => {})
  }

  async function save() {
    const trimmed = bodyText.trim()
    if (trimmed.length < 50 || phase === 'sending') return
    setPhase('sending')
    try {
      const res = await fetch('/api/elder/core-myth-statement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bodyText: trimmed, sourceMarkerIds: material.map(m => m.trajectoryId) }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.saved) {
        setError(data?.error === 'version_conflict' ? 'Something changed while you were writing — try again.' : 'Could not save that. Try again shortly.')
        setPhase('error')
        return
      }
      setCurrent(data.statement)
      setPhase('saved')
    } catch {
      setError('Could not save that. Try again shortly.')
      setPhase('error')
    }
  }

  if (phase === 'loading' || phase === 'hidden') return null

  return (
    <div style={{ marginTop: 48, paddingTop: 30, borderTop: '1px solid rgba(212,168,67,0.14)', textAlign: 'center' }}>
      {phase === 'quiet-entry' && (
        <div>
          {current && (
            <div style={{ maxWidth: 520, margin: '0 auto 20px', textAlign: 'left', background: 'rgba(8,6,4,0.6)', border: '1px solid rgba(212,168,67,0.18)', padding: '22px 26px' }}>
              <div style={{ fontSize: '0.56rem', letterSpacing: '0.28em', color: C.gold, textTransform: 'uppercase', opacity: 0.8, marginBottom: 12 }}>
                Your Core Myth Statement
              </div>
              <div style={{ fontStyle: 'italic', color: C.bone, fontSize: '0.98rem', lineHeight: 1.9, whiteSpace: 'pre-wrap' }}>
                {current.bodyText}
              </div>
            </div>
          )}
          <button
            onClick={() => { setBodyText(current?.bodyText ?? ''); setPhase('writing') }}
            style={{
              background: 'transparent', border: 'none', color: C.smoke,
              fontFamily: "'Gentium Plus',Georgia,serif", fontSize: '0.72rem', letterSpacing: '0.12em',
              cursor: 'pointer', opacity: 0.7, fontStyle: 'italic',
            }}
          >
            {current ? 'revise your Core Myth Statement' : 'write your Core Myth Statement, whenever you’re ready'}
          </button>
        </div>
      )}

      {phase === 'settling' && (
        <div style={{ padding: '10px 0' }}>
          <div style={{
            width: 44, height: 44, margin: '0 auto 16px', borderRadius: '50%',
            border: `1px solid ${C.gold}`,
            background: `radial-gradient(circle, ${C.gold}22, transparent 70%)`,
            animationName: 'sigilBreathe',
            animationDuration: `${Math.min(BREATH_CYCLE_MS, 2600)}ms`,
            animationTimingFunction: 'ease-in-out', animationIterationCount: 'infinite',
          }} />
          <div style={{ fontStyle: 'italic', color: C.smoke, fontSize: '0.82rem' }}>
            Three things have become yours.
          </div>
        </div>
      )}

      {phase === 'revealing' && (
        <div style={{ maxWidth: 480, margin: '0 auto' }}>
          <div style={{ fontStyle: 'italic', color: C.bone, fontSize: '0.94rem', lineHeight: 1.9, marginBottom: 20 }}>
            <WordReveal text={OFFER_LINE} breathSynced carved />
          </div>
          <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 24px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {material.map((m, i) => (
              <li key={m.trajectoryId} style={{
                fontStyle: 'italic', color: C.ash, fontSize: '0.88rem', lineHeight: 1.7,
                opacity: materialRevealed ? 1 : 0,
                transition: 'opacity 0.8s ease',
                transitionDelay: `${i * 0.5}s`,
              }}>
                "{m.markerValue}"
              </li>
            ))}
          </ul>
          <div style={{ display: 'flex', gap: 14, justifyContent: 'center' }}>
            <button
              onClick={() => { setBodyText(''); setPhase('writing') }}
              style={{ background: 'transparent', border: `1px solid ${C.gold}`, color: C.gold, fontFamily: "'Gentium Plus',Georgia,serif", fontSize: '0.6rem', letterSpacing: '0.2em', padding: '9px 20px', cursor: 'pointer', textTransform: 'uppercase' }}
            >
              Write It
            </button>
            <button
              onClick={dismiss}
              style={{ background: 'transparent', border: 'none', color: C.smoke, fontFamily: "'Gentium Plus',Georgia,serif", fontSize: '0.56rem', letterSpacing: '0.18em', cursor: 'pointer', textTransform: 'uppercase', opacity: 0.5 }}
            >
              not now
            </button>
          </div>
        </div>
      )}

      {(phase === 'writing' || phase === 'sending' || phase === 'error') && (
        <div style={{ maxWidth: 480, margin: '0 auto' }}>
          <div style={{ fontStyle: 'italic', color: C.bone, fontSize: '0.9rem', lineHeight: 1.8, marginBottom: 16 }}>
            {WRITE_PROMPT}
          </div>
          {material.length > 0 && (
            <div style={{ textAlign: 'left', marginBottom: 14, opacity: 0.6 }}>
              {material.map(m => (
                <div key={m.trajectoryId} style={{ fontStyle: 'italic', color: C.smoke, fontSize: '0.76rem', marginBottom: 4 }}>
                  "{m.markerValue}"
                </div>
              ))}
            </div>
          )}
          <textarea
            value={bodyText}
            onChange={e => setBodyText(e.target.value.slice(0, 1500))}
            placeholder="This is yours to write..."
            disabled={phase === 'sending'}
            rows={8}
            style={{
              background: 'rgba(255,255,255,0.022)', border: '1px solid rgba(212,168,67,0.18)',
              color: C.ash, fontFamily: "'Gentium Plus',Georgia,serif", fontStyle: 'italic', fontSize: '0.95rem',
              padding: '14px 16px', outline: 'none', width: '100%', resize: 'vertical', lineHeight: 1.8,
            }}
          />
          <div style={{ fontSize: '0.65rem', color: C.smoke, marginTop: 6, opacity: 0.5 }}>
            {bodyText.trim().length}/1500 — at least 50 to save
          </div>
          <div style={{ marginTop: 12 }}>
            <button
              onClick={save}
              disabled={phase === 'sending' || bodyText.trim().length < 50}
              style={{
                background: 'transparent', border: `1px solid ${C.gold}`, color: C.gold,
                fontFamily: "'Gentium Plus',Georgia,serif", fontSize: '0.6rem', letterSpacing: '0.2em',
                padding: '9px 22px', cursor: phase === 'sending' ? 'not-allowed' : 'pointer',
                textTransform: 'uppercase', opacity: phase === 'sending' || bodyText.trim().length < 50 ? 0.5 : 1,
              }}
            >
              {phase === 'sending' ? '…' : 'Keep This'}
            </button>
          </div>
          {phase === 'error' && (
            <div style={{ color: '#7a1a1a', fontSize: '0.7rem', fontStyle: 'italic', marginTop: 10 }}>{error}</div>
          )}
        </div>
      )}

      {phase === 'saved' && (
        <div style={{ fontStyle: 'italic', color: C.ash, fontSize: '0.88rem', lineHeight: 1.8, maxWidth: 440, margin: '0 auto' }}>
          {SAVED_LINE}
        </div>
      )}
    </div>
  )
}
