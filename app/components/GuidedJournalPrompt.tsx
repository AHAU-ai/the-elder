'use client'
import { useState } from 'react'
import type { LineageKey } from '../../lib/lineages'

const C = {
  gold:  '#d4a843',
  ash:   '#c4b89a',
  smoke: '#a8916f',
  bone:  '#fdf6e8',
}

// Mirrors the CANONICAL_MARKERS in app/api/threshold-letters/route.ts and
// app/api/guided-journal/route.ts — one reflective prompt per marker, plus
// a fallback for readings that never surfaced one.
const MARKER_PROMPTS: Record<string, string> = {
  wound: 'Where in your life does this wound still speak — and what would it take to let it rest?',
  threshold: 'What are you standing at the edge of, and what is asking you to cross?',
  pattern: 'Where else has this same pattern found you before? What does it keep trying to teach you?',
  exile: 'What part of yourself did you leave behind to survive — and is it time to call it home?',
  figure: 'If this figure could speak to you directly, what would it say that you have not yet let yourself hear?',
}
const FALLBACK_PROMPT = 'Sitting with what the fire showed you — what is true that you have not yet said aloud?'

type Status = 'idle' | 'sending' | 'sent' | 'error' | 'dismissed'

export default function GuidedJournalPrompt({
  lineageKey,
  marker,
  accent = C.gold,
}: {
  lineageKey: LineageKey | string
  marker?: string | null
  accent?: string
}) {
  const [response, setResponse] = useState('')
  const [status, setStatus] = useState<Status>('idle')

  if (status === 'dismissed') return null

  const prompt = (marker && MARKER_PROMPTS[marker]) || FALLBACK_PROMPT

  const submit = async () => {
    const trimmed = response.trim()
    if (!trimmed || status === 'sending') return
    setStatus('sending')
    try {
      const res = await fetch('/api/guided-journal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lineageKey, prompt, response: trimmed, marker: marker ?? null }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.saved) throw new Error('save failed')
      setStatus('sent')
    } catch {
      setStatus('error')
    }
  }

  if (status === 'sent') {
    return (
      <div style={{ textAlign: 'center', marginTop: 24, fontStyle: 'italic', color: C.ash, fontSize: '0.85rem', lineHeight: 1.7 }}>
        Written into the record. It will keep, until you return to it.
      </div>
    )
  }

  return (
    <div style={{ textAlign: 'center', marginTop: 24, paddingTop: 20, borderTop: '1px solid rgba(212,168,67,0.1)' }}>
      <div style={{ fontStyle: 'italic', color: C.bone, fontSize: '0.92rem', lineHeight: 1.85, marginBottom: 14, maxWidth: 460, margin: '0 auto 14px' }}>
        {prompt}
      </div>
      <textarea
        value={response}
        onChange={e => setResponse(e.target.value)}
        placeholder="Write what rises..."
        disabled={status === 'sending'}
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
          onClick={submit}
          disabled={status === 'sending' || !response.trim()}
          style={{
            background: 'transparent', border: `1px solid ${accent}`, color: accent,
            fontFamily: "'Gentium Plus',Georgia,serif", fontSize: '0.6rem', letterSpacing: '0.2em',
            padding: '9px 20px', cursor: status === 'sending' ? 'not-allowed' : 'pointer',
            textTransform: 'uppercase', opacity: status === 'sending' || !response.trim() ? 0.5 : 1,
          }}
        >
          {status === 'sending' ? '…' : 'Keep This Reflection'}
        </button>
      </div>
      {status === 'error' && (
        <div style={{ color: '#7a1a1a', fontSize: '0.7rem', fontStyle: 'italic', marginTop: 8 }}>
          Could not write that down. Try again shortly.
        </div>
      )}
      <button
        onClick={() => setStatus('dismissed')}
        style={{
          background: 'transparent', border: 'none', color: C.smoke,
          fontFamily: "'Gentium Plus',Georgia,serif", fontSize: '0.56rem', letterSpacing: '0.18em',
          cursor: 'pointer', textTransform: 'uppercase', padding: '10px 0 0', opacity: 0.5,
        }}
      >
        not now
      </button>
    </div>
  )
}
