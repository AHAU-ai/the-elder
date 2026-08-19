'use client'

// SharedCardView.tsx
//
// Public, read-only view of a shared threshold line — the receiving end
// of ShareableCard.tsx's share link. A viewer can leave one wordless
// glyph back for the sharer; no account needed, no numbers shown here
// (the aggregate is for the sharer's Journal, not a public scoreboard).
//
// The glyph response used to be a silent database write with a text swap
// as its only feedback — the loop closed structurally (a row landed in
// share_response) but never visibly, for the one person actually present
// to see it land: the recipient, at the moment they leave it. This page
// now carries the same marker landscape + audio/haptic language as
// ShareableCard.tsx (public/card-landscapes/, lib/mythopoetics/cardAudio.ts)
// so that moment has an actual shape: a flare at the glyph, a ripple
// crossing the landscape toward the card, a chime. The sharer's own
// half of the loop (seeing a response arrive) is a separate, lighter
// treatment in MythicJournal.tsx — this file only owns the recipient's
// side, which is the side that was silent.

import { useEffect, useRef, useState } from 'react'
import { C, GlyphDivider } from './LintelShared'
import { MARKER_GLYPHS, MARKER_LABELS, accentForVoice, landscapeFor, type MarkerType } from '@/lib/mythopoetics/cardConfig'
import { playArrival } from '@/lib/mythopoetics/cardAudio'
import type { VoiceKey } from '@/src/resilience/flags'

interface CardData {
  line: string
  marker: MarkerType
  voiceKey: VoiceKey
  dedicatedTo: string
  // provenanceMetadata()'s shape (src/resilience/provenance.ts) or null --
  // cards kept before migrations/017_share_card_provenance.sql, or without
  // a stamp available, genuinely have none. Not rendered here yet --
  // whether/how to surface it visibly is a separate UI decision from
  // making it actually traceable (see app/api/share/[id]/route.ts).
  provenance: Record<string, unknown> | null
}

const RESPONDED_KEY_PREFIX = 'elder_share_responded_'

export default function SharedCardView({ id }: { id: string }) {
  const [checked, setChecked] = useState(false)
  const [card, setCard] = useState<CardData | null>(null)
  const [responded, setResponded] = useState(false)
  const [rippleOriginX, setRippleOriginX] = useState(50)
  const [rippleKey, setRippleKey] = useState(0)
  const glyphRowRef = useRef<HTMLDivElement>(null)

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

  async function respond(m: MarkerType, e: React.MouseEvent<HTMLButtonElement>) {
    if (responded || !card) return

    // Ripple origin: the clicked glyph's horizontal position within the
    // row, as a percentage — so the reaction visibly comes FROM the
    // seeker's own gesture rather than always erupting from center.
    const row = glyphRowRef.current
    if (row) {
      const rowBox = row.getBoundingClientRect()
      const btnBox = e.currentTarget.getBoundingClientRect()
      const originX = ((btnBox.left + btnBox.width / 2 - rowBox.left) / rowBox.width) * 100
      setRippleOriginX(Math.max(0, Math.min(100, originX)))
    }

    setResponded(true)
    setRippleKey(k => k + 1)
    try { sessionStorage.setItem(RESPONDED_KEY_PREFIX + id, '1') } catch { /* ignore */ }
    // Chime + haptic together, same as the card's own arrival moment
    // (ShareableCard.tsx). Sound is not muted-by-default here the way it
    // is on the sender's card: this is a single, deliberate, one-time
    // gesture the recipient just chose to make, not ambient audio playing
    // unasked on page load — the autoplay-policy/consent reasoning that
    // justifies muting-by-default there doesn't apply to a direct click.
    playArrival(m, true)
    try {
      await fetch(`/api/share/${id}/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ marker: m }),
      })
    } catch { /* silent — the glyph is a gesture, not a transaction */ }
  }

  const accent = card ? accentForVoice(card.voiceKey) : C.gold
  const landscapeSrc = card ? landscapeFor(card.marker, card.line) : null

  return (
    <div style={{
      position: 'relative',
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
      overflow: 'hidden',
    }}>
      <style>{`
        @keyframes elderShareFlare {
          0%   { opacity: 0;   transform: translate(-50%,-50%) scale(0.3); }
          35%  { opacity: 0.95; }
          100% { opacity: 0;   transform: translate(-50%,-50%) scale(3); }
        }
        @keyframes elderShareRipple {
          0%   { opacity: 0;    transform: translateX(-50%) scale(0.05); }
          12%  { opacity: 0.8; }
          55%  { opacity: 0.5;  transform: translateX(-50%) scale(0.55); }
          100% { opacity: 0;    transform: translateX(-50%) scale(1); }
        }
        @keyframes elderShareGlow {
          0%, 100% { opacity: 0.55; }
          50%      { opacity: 0.9; }
        }
      `}</style>

      {landscapeSrc && (
        <>
          <img
            src={landscapeSrc}
            alt=""
            style={{
              position: 'fixed',
              inset: 0,
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              opacity: 0.4,
              filter: 'saturate(1.1) contrast(1.05)',
              pointerEvents: 'none',
            }}
          />
          <div style={{
            position: 'fixed',
            inset: 0,
            background: `radial-gradient(ellipse 70% 60% at 50% 40%, ${accent}14 0%, transparent 55%), linear-gradient(180deg, rgba(6,5,4,0.55) 0%, rgba(6,5,4,0.75) 55%, ${C.obsidian} 100%)`,
            pointerEvents: 'none',
          }} />
          {/* the ripple: a ring expanding from the glyph the recipient just
              chose, traveling up across the landscape toward the card's own
              glyph -- the visible half of "what you left has been received."
              Re-keyed on every click so a second response (blocked by
              `responded` in practice, but defensive) always gets a fresh
              animation rather than reusing a finished one. */}
          {responded && (
            <div
              key={rippleKey}
              style={{
                position: 'fixed',
                bottom: '18%',
                left: `${rippleOriginX}%`,
                width: 900,
                height: 900,
                marginLeft: -450,
                borderRadius: '50%',
                border: `1.5px solid ${accent}`,
                boxShadow: `0 0 60px 10px ${accent}55`,
                pointerEvents: 'none',
                animation: 'elderShareRipple 2.4s cubic-bezier(0.16,1,0.3,1) both',
              }}
            />
          )}
        </>
      )}

      {!checked && (
        <div style={{ position: 'relative', color: C.smoke, fontStyle: 'italic' }}>&hellip;</div>
      )}

      {checked && !card && (
        <div style={{ position: 'relative', color: C.ash, fontStyle: 'italic', lineHeight: 1.8, maxWidth: 420 }}>
          This threshold could not be found — it may have been withdrawn, or the link mistyped.
        </div>
      )}

      {checked && card && (
        <div style={{ position: 'relative', maxWidth: 480, width: '100%' }}>
          <div style={{ position: 'relative', display: 'inline-block' }}>
            {/* the flare: blooms once, directly behind the card's own glyph,
                the instant a response lands -- the recipient's action
                visibly reaching the thing they responded to. */}
            {responded && (
              <div
                key={`flare-${rippleKey}`}
                style={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  width: 90,
                  height: 90,
                  borderRadius: '50%',
                  background: `radial-gradient(circle, #fff6df 0%, ${accent}cc 30%, ${accent}00 72%)`,
                  pointerEvents: 'none',
                  opacity: 0,
                  animation: 'elderShareFlare 1.8s cubic-bezier(0.16,1,0.3,1) both',
                }}
              />
            )}
            <div style={{
              position: 'relative',
              fontSize: 40,
              color: accent,
              marginBottom: 8,
              textShadow: `0 0 18px ${accent}99`,
              animation: responded ? 'elderShareGlow 3.5s ease-in-out infinite' : undefined,
            }}>
              {MARKER_GLYPHS[card.marker]}
            </div>
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
                <div ref={glyphRowRef} style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
                  {(Object.keys(MARKER_GLYPHS) as MarkerType[]).map(m => (
                    <button
                      key={m}
                      onClick={(e) => respond(m, e)}
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
