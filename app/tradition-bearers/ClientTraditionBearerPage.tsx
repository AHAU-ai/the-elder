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
  status: 'authorized' | 'unauthorized' | 'scaffolding'
  note: string
}

const STATUS_LABEL: Record<Lineage['status'], string> = {
  authorized: 'authorized',
  unauthorized: 'not yet authorized',
  scaffolding: 'scaffolding only — not live',
}

const STATUS_COLOR: Record<Lineage['status'], string> = {
  authorized: C.gold,
  unauthorized: C.ash,
  scaffolding: C.dim,
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

        <div style={{ fontStyle: 'italic', lineHeight: 1.9, color: C.ash, marginBottom: 20 }}>
          Every voice The Elder speaks in is drawn from written sources, not from a
          living relationship with that tradition by default. Where a real
          tradition-bearer has reviewed a voice — what it says, how it says it,
          where its boundaries are — that review is recorded and the voice is
          marked authorized below. Where one hasn&rsquo;t, the voice may still be
          live, but only ever on that plain footing: unreviewed, not claiming a
          blessing it doesn&rsquo;t have.
        </div>

        <div style={{ fontStyle: 'italic', lineHeight: 1.9, color: C.ash, marginBottom: 40 }}>
          This page exists so that gap has a door in it. If you hold real standing
          to speak for one of these traditions — as a practitioner, an elder, a
          teacher, a cultural authority — this is how you reach the project. An
          inquiry here doesn&rsquo;t authorize anything by itself; it starts a real
          conversation, the same way every authorization already on record here
          started with one.
        </div>

        <div style={{ marginBottom: 44 }}>
          <div style={{ fontSize: '0.6rem', letterSpacing: '0.22em', color: C.smoke, textTransform: 'uppercase', marginBottom: 14 }}>
            Current status, by voice
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {lineages.map((l) => (
              <div key={l.key} style={{ borderLeft: `2px solid ${STATUS_COLOR[l.status]}55`, paddingLeft: 14 }}>
                <div style={{ display: 'flex', gap: 10, alignItems: 'baseline', flexWrap: 'wrap' }}>
                  <span style={{ color: C.bone }}>{l.label}</span>
                  <span style={{ fontSize: '0.62rem', letterSpacing: '0.14em', textTransform: 'uppercase', color: STATUS_COLOR[l.status] }}>
                    {STATUS_LABEL[l.status]}
                  </span>
                </div>
                <div style={{ fontSize: '0.82rem', color: C.smoke, marginTop: 3, lineHeight: 1.6 }}>{l.note}</div>
              </div>
            ))}
          </div>
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
