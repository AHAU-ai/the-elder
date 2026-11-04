'use client'

import { useState } from 'react'

const C = {
  obsidian: '#0a0806',
  gold: '#d4a843',
  paleGold: '#e8c97a',
  bone: '#ede0c4',
  ash: '#c4b89a',
  smoke: '#a8916f',
  dim: '#5c5140',
}

type Lineage = {
  key: string
  label: string
}

type FormPhase = 'idle' | 'sending' | 'sent' | 'error'

export default function ClientTraditionBearerPage({ lineages }: { lineages: Lineage[] }) {
  const [lineageKey, setLineageKey] = useState(lineages[0]?.key ?? '')
  const [name, setName] = useState('')
  const [relationship, setRelationship] = useState('')
  const [contact, setContact] = useState('')
  const [message, setMessage] = useState('')
  const [phase, setPhase] = useState<FormPhase>('idle')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (phase === 'sending') return
    setPhase('sending')
    try {
      const res = await fetch('/api/tradition-bearer-inquiry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lineageKey, name, relationship, contact, message }),
      })
      const data = await res.json().catch(() => null)
      setPhase(res.ok && data?.saved ? 'sent' : 'error')
    } catch {
      setPhase('error')
    }
  }

  return (
    <main
      style={{
        minHeight: '100vh',
        background: C.obsidian,
        color: C.bone,
        display: 'flex',
        justifyContent: 'center',
        padding: '64px 20px 80px',
        fontFamily: "'Gentium Plus', Georgia, 'Times New Roman', serif",
      }}
    >
      <div style={{ maxWidth: 640, width: '100%' }}>
        <a
          href="/about"
          style={{
            color: C.smoke, fontSize: '0.6rem', letterSpacing: '0.2em',
            textTransform: 'uppercase', textDecoration: 'none',
          }}
        >
          &larr; about the elder
        </a>

        <h1 style={{ fontSize: '1.6rem', fontWeight: 400, marginTop: 24, marginBottom: 18, color: C.paleGold }}>
          If you speak for a tradition
        </h1>

        <div style={{ fontStyle: 'italic', lineHeight: 1.9, color: C.ash, marginBottom: 40 }}>
          Every voice The Elder speaks in is drawn from written sources. If you
          hold real standing to speak for one of these traditions &mdash; as a
          practitioner, an elder, a teacher, a cultural authority &mdash; this is
          how you reach the project. An inquiry here doesn&rsquo;t change anything
          by itself; it starts a real conversation, and whatever comes of that
          conversation is recorded.
        </div>

        {phase === 'sent' ? (
          <div style={{
            border: `1px solid ${C.gold}55`, padding: '24px 22px', fontStyle: 'italic',
            color: C.paleGold, lineHeight: 1.8,
          }}>
            Received. This won&rsquo;t change anything about the site on its own —
            someone from the project will follow up at the contact you gave, and
            whatever comes of that conversation will be recorded the same way every
            other review here is.
          </div>
        ) : (
          <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <label style={fieldLabelStyle}>
              Which tradition
              <select
                value={lineageKey}
                onChange={(e) => setLineageKey(e.target.value)}
                style={inputStyle}
              >
                {lineages.map((l) => (
                  <option key={l.key} value={l.key}>{l.label}</option>
                ))}
              </select>
            </label>

            <label style={fieldLabelStyle}>
              Your name
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                style={inputStyle}
              />
            </label>

            <label style={fieldLabelStyle}>
              Your standing to speak for this tradition
              <textarea
                value={relationship}
                onChange={(e) => setRelationship(e.target.value)}
                required
                rows={3}
                placeholder="e.g. practicing elder, ordained teacher, cultural authority, academic specialist with community ties — in your own words"
                style={{ ...inputStyle, resize: 'vertical' as const }}
              />
            </label>

            <label style={fieldLabelStyle}>
              How to reach you
              <input
                type="text"
                value={contact}
                onChange={(e) => setContact(e.target.value)}
                required
                placeholder="email or another way to follow up"
                style={inputStyle}
              />
            </label>

            <label style={fieldLabelStyle}>
              What you&rsquo;d like us to know
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                required
                rows={5}
                style={{ ...inputStyle, resize: 'vertical' as const }}
              />
            </label>

            <button
              type="submit"
              disabled={phase === 'sending'}
              style={{
                alignSelf: 'flex-start', background: 'transparent', border: `1px solid ${C.gold}`,
                color: C.gold, fontFamily: "'Gentium Plus', Georgia, serif", fontSize: '0.68rem',
                letterSpacing: '0.2em', textTransform: 'uppercase', padding: '12px 26px',
                cursor: phase === 'sending' ? 'default' : 'pointer', opacity: phase === 'sending' ? 0.6 : 1,
              }}
            >
              {phase === 'sending' ? 'Sending…' : 'Send this'}
            </button>

            {phase === 'error' && (
              <div style={{ color: '#c86a3a', fontStyle: 'italic', fontSize: '0.85rem' }}>
                That didn&rsquo;t go through. Try again in a moment.
              </div>
            )}
          </form>
        )}
      </div>
    </main>
  )
}

const fieldLabelStyle: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', gap: 8,
  fontSize: '0.62rem', letterSpacing: '0.16em', textTransform: 'uppercase', color: C.smoke,
}

const inputStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.022)', border: '1px solid rgba(212,168,67,0.22)',
  color: C.bone, fontFamily: "'Gentium Plus', Georgia, serif", fontStyle: 'italic', fontSize: '0.92rem',
  padding: '11px 13px', outline: 'none', lineHeight: 1.6, textTransform: 'none', letterSpacing: 'normal',
}
