'use client'

// SharedCardView.tsx
//
// Public, read-only view of a shared threshold line — the receiving end
// of ShareableCard.tsx's share link. A viewer can leave one wordless
// glyph back for the sharer; no account needed, no numbers shown here
// (the aggregate is for the sharer's Journal, not a public scoreboard).

import { useEffect, useState } from 'react'
import { C, GlyphDivider } from './LintelShared'
import { MARKER_GLYPHS, MARKER_LABELS, accentForVoice, type MarkerType } from '@/lib/mythopoetics/cardConfig'
import type { VoiceKey } from '@/src/resilience/flags'

interface CardData {
  line: string
  marker: MarkerType
  voiceKey: VoiceKey
  dedicatedTo: string
}

const RESPONDED_KEY_PREFIX = 'elder_share_responded_'

export default function SharedCardView({ id }: { id: string }) {
  const [checked, setChecked] = useState(false)
  const [card, setCard] = useState<CardData | null>(null)
  const [responded, setResponded] = useState(false)

  useEffect(() => {
    fetch(`/api/share/${id}`)
      .then(r => r.json())
      .then(d => setCard(d?.card ?? null))
      .catch(() => setCard(null))
      .finally(() => setChecked(true))

    try {
      if (sessionStorage.getItem(RESPONDED_KEY_PREFIX + id) === '1') setResponded(true)
    } catch { /* private mode — allow one response per load */ }
  }, [id])

  async function respond(m: MarkerType) {
    if (responded) return
    setResponded(true)
    try { sessionStorage.setItem(RESPONDED_KEY_PREFIX + id, '1') } catch { /* ignore */ }
    try {
      await fetch(`/api/share/${id}/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ marker: m }),
      })
    } catch { /* silent — the glyph is a gesture, not a transaction */ }
  }

  const accent = card ? accentForVoice(card.voiceKey) : C.gold

  return (
    <div style={{
      minHeight: '100vh',
      background: C.obsidian,
      color: C.bone,
      fontFamily: "'Gentium Plus', Georgia, 'Times New Roman', serif",
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '40px 20px',
      textAlign: 'center',
    }}>
      {!checked && (
        <div style={{ color: C.smoke, fontStyle: 'italic' }}>&hellip;</div>
      )}

      {checked && !card && (
        <div style={{ color: C.ash, fontStyle: 'italic', lineHeight: 1.8, maxWidth: 420 }}>
          This threshold could not be found — it may have been withdrawn, or the link mistyped.
        </div>
      )}

      {checked && card && (
        <div style={{ maxWidth: 480, width: '100%' }}>
          <div style={{ fontSize: 40, color: accent, marginBottom: 8, textShadow: `0 0 18px ${accent}99` }}>
            {MARKER_GLYPHS[card.marker]}
          </div>
          <div style={{
            fontFamily: "'Inter', Arial, sans-serif",
            fontSize: '0.6rem',
            letterSpacing: '0.3em',
            color: C.smoke,
            textTransform: 'uppercase',
            marginBottom: 26,
          }}>
            {MARKER_LABELS[card.marker]}
          </div>

          <div style={{ fontStyle: 'italic', color: C.bone, fontSize: 'clamp(1.1rem, 3vw, 1.4rem)', lineHeight: 1.85, marginBottom: 20 }}>
            "{card.line}"
          </div>

          {card.dedicatedTo && (
            <div style={{ fontSize: '0.62rem', letterSpacing: '0.18em', color: accent, textTransform: 'uppercase', marginBottom: 22, opacity: 0.85 }}>
              Named for {card.dedicatedTo}
            </div>
          )}

          <GlyphDivider symbol="⟡" opacity={0.4} color={accent} />

          <div style={{ fontSize: '0.6rem', letterSpacing: '0.28em', color: C.smoke, textTransform: 'uppercase', marginTop: 20, opacity: 0.7 }}>
            THE ELDER · Myth Diviner
          </div>

          <div style={{ marginTop: 44 }}>
            {responded ? (
              <div style={{ fontSize: '0.8rem', color: C.ash, fontStyle: 'italic' }}>
                What you left has been received.
              </div>
            ) : (
              <>
                <div style={{ fontSize: '0.6rem', letterSpacing: '0.2em', color: C.smoke, textTransform: 'uppercase', marginBottom: 16 }}>
                  Leave something back — no words needed
                </div>
                <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
                  {(Object.keys(MARKER_GLYPHS) as MarkerType[]).map(m => (
                    <button
                      key={m}
                      onClick={() => respond(m)}
                      title={MARKER_LABELS[m]}
                      style={{
                        background: 'transparent',
                        border: '1px solid rgba(212,168,67,0.25)',
                        color: C.ash,
                        fontSize: '1.1rem',
                        width: 40,
                        height: 40,
                        borderRadius: '50%',
                        cursor: 'pointer',
                      }}
                    >
                      {MARKER_GLYPHS[m]}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          <div style={{ marginTop: 40 }}>
            <a href="/" style={{ color: C.smoke, fontSize: '0.62rem', letterSpacing: '0.2em', textTransform: 'uppercase', textDecoration: 'none', borderBottom: `1px solid ${C.smoke}` }}>
              Meet The Elder
            </a>
          </div>
        </div>
      )}
    </div>
  )
}
