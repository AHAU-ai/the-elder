'use client'

// LetterReportForm.tsx
//
// Brainstorm item #5's UI, factored out of RecallLetter.tsx so item #3's
// full pass (the threshold-letter email becomes a real two-way loop, not
// just a read-only resurfacing) can reuse the exact same report-back
// control on the /letters page instead of re-implementing it. Persists
// through the same guided-journal ledger a post-reading reflection
// already uses (app/api/guided-journal) — structurally the same thing,
// the seeker's own unedited words about a specific reading.

import { useState } from 'react'

const C = {
  ash: '#c4b89a',
}

export default function LetterReportForm({
  lineageKey,
  returnGift,
  accent,
  autoOpen = false,
  letterId,
}: {
  lineageKey: string
  returnGift: string
  accent: string
  autoOpen?: boolean
  /** Migration 034: links this report back to the letter it's about, so
   *  lib/returning/letterOutcomeContext.ts can find it later. Optional --
   *  omitting it still saves a perfectly valid (if unlinked) reflection. */
  letterId?: number
}) {
  const [phase, setPhase] = useState<'closed' | 'open' | 'sending' | 'sent'>(autoOpen ? 'open' : 'closed')
  const [text, setText] = useState('')

  async function send() {
    const trimmed = text.trim()
    if (!trimmed || phase === 'sending') return
    setPhase('sending')
    try {
      const res = await fetch('/api/guided-journal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lineageKey,
          prompt: `What came of this, since it was given to you: "${returnGift}"`,
          response: trimmed,
          marker: null,
          ...(letterId ? { letterId } : {}),
        }),
      })
      const data = await res.json().catch(() => null)
      setPhase(res.ok && data?.saved ? 'sent' : 'open')
    } catch {
      setPhase('open')
    }
  }

  if (phase === 'sent') {
    return (
      <div style={{ marginTop: 16, fontStyle: 'italic', color: accent, fontSize: '0.8rem', opacity: 0.9 }}>
        Kept alongside it. The fire remembers what you did with it, too.
      </div>
    )
  }

  if (phase === 'open' || phase === 'sending') {
    return (
      <div style={{ marginTop: 16 }}>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="What came of it..."
          disabled={phase === 'sending'}
          rows={3}
          autoFocus={autoOpen}
          style={{
            width: '100%', background: 'rgba(255,255,255,0.022)', border: '1px solid rgba(212,168,67,0.18)',
            color: C.ash, fontFamily: "'Gentium Plus',Georgia,serif", fontStyle: 'italic', fontSize: '0.88rem',
            padding: '10px 12px', outline: 'none', resize: 'vertical', lineHeight: 1.7,
          }}
        />
        <button
          onClick={send}
          disabled={phase === 'sending' || !text.trim()}
          style={{
            marginTop: 8, background: 'transparent', border: `1px solid ${accent}`, color: accent,
            fontFamily: "'Gentium Plus',Georgia,serif", fontSize: '0.58rem', letterSpacing: '0.18em',
            padding: '8px 18px', cursor: phase === 'sending' ? 'not-allowed' : 'pointer',
            textTransform: 'uppercase', opacity: phase === 'sending' || !text.trim() ? 0.5 : 1,
          }}
        >
          {phase === 'sending' ? '…' : 'Tell the Fire'}
        </button>
      </div>
    )
  }

  return (
    <button
      onClick={() => setPhase('open')}
      style={{
        marginTop: 14, background: 'none', border: 'none', color: '#a8916f', fontStyle: 'italic',
        fontSize: '0.76rem', cursor: 'pointer', textDecoration: 'underline', padding: 0, opacity: 0.75,
      }}
    >
      tell the fire what came of it
    </button>
  )
}
