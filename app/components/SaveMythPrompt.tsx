'use client'
import { useState } from 'react'

const C = {
  gold:  '#d4a843',
  ash:   '#c4b89a',
  smoke: '#8a7a6a',
}

type Status = 'idle' | 'sending' | 'sent' | 'error' | 'dismissed'

export default function SaveMythPrompt({ accent = C.gold }: { accent?: string }) {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<Status>('idle')

  if (status === 'dismissed') return null

  const submit = async () => {
    const trimmed = email.trim()
    if (!trimmed || status === 'sending') return
    setStatus('sending')
    try {
      const res = await fetch('/api/auth/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: trimmed }),
      })
      if (!res.ok) throw new Error('request failed')
      setStatus('sent')
    } catch {
      setStatus('error')
    }
  }

  if (status === 'sent') {
    return (
      <div style={{ textAlign: 'center', marginTop: 24, fontStyle: 'italic', color: C.ash, fontSize: '0.85rem', lineHeight: 1.7 }}>
        A thread back to the fire is on its way to your inbox.
      </div>
    )
  }

  return (
    <div style={{ textAlign: 'center', marginTop: 24, paddingTop: 20, borderTop: '1px solid rgba(212,168,67,0.1)' }}>
      <div style={{ fontStyle: 'italic', color: C.ash, fontSize: '0.85rem', lineHeight: 1.7, marginBottom: 10, opacity: 0.85 }}>
        Save this myth — enter your email to return and deepen it later.
      </div>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
        <input
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') submit() }}
          placeholder="your@email.com"
          disabled={status === 'sending'}
          style={{
            background: 'rgba(255,255,255,0.022)', border: '1px solid rgba(212,168,67,0.18)',
            color: C.ash, fontFamily: "'Gentium Plus',Georgia,serif", fontStyle: 'italic', fontSize: '0.9rem',
            padding: '9px 14px', outline: 'none', width: 220,
          }}
        />
        <button
          onClick={submit}
          disabled={status === 'sending'}
          style={{
            background: 'transparent', border: `1px solid ${accent}`, color: accent,
            fontFamily: "'Gentium Plus',Georgia,serif", fontSize: '0.6rem', letterSpacing: '0.2em',
            padding: '9px 16px', cursor: status === 'sending' ? 'not-allowed' : 'pointer',
            textTransform: 'uppercase', opacity: status === 'sending' ? 0.5 : 1,
          }}
        >
          {status === 'sending' ? '…' : 'Save'}
        </button>
      </div>
      {status === 'error' && (
        <div style={{ color: '#7a1a1a', fontSize: '0.7rem', fontStyle: 'italic', marginTop: 8 }}>
          Could not send that. Try again shortly.
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
