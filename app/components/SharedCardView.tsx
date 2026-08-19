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
  // a stamp available, genuinely have none. Rendered below as a collapsed,
  // opt-in disclosure, not a public scoreboard number -- this page's own
  // header comment already draws that line for response counts, and raw
  // version hashes/passage ids read as exactly the "contemporary tech"
  // puncture docs/ELDER-CEREMONY-SIGNAL-SURFACE.md §1.1 warns against if
  // shown reflexively. Available for a viewer who actually wants to verify
  // traceability (provenance.ts's own stated purpose), invisible otherwise.
  provenance: Record<string, unknown> | null
}

const RESPONDED_KEY_PREFIX = 'elder_share_responded_'

export default function SharedCardView({ id }: { id: string }) {
  const [checked, setChecked] = useState(false)
  const [card, setCard] = useState<CardData | null>(null)
  const [responded, setResponded] = useState(false)
  const [traceOpen, setTraceOpen] = useState(false)
  const [rippleOriginX, setRippleOriginX] = useState(50)
  const [rippleKey, setRippleKey] = useState(0)
  const glyphRowRef = useRef<HTMLDivElement>(null)

  // The same window-looked-through depth as ShareableCard.tsx (the
  // sender's own card), brought here so the recipient's half of the loop
  // reads with the same immersion instead of trailing it as a flatter,
  // lesser experience. Window-level rather than a bounded plateRef: this
  // page's landscape is a full-bleed background, not a framed plate, so
  // "mouse position relative to the card" becomes "mouse position
  // relative to the viewport" instead. Kept subtle (this page loads cold,
  // often on a stranger's phone, often on mobile data) -- depth as a
  // quiet ambient quality, not something that has to be noticed to work.
  const [tilt, setTilt] = useState({ x: 0, y: 0 })
  const reducedMotionRef = useRef(false)

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

  useEffect(() => {
    reducedMotionRef.current = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
    if (reducedMotionRef.current) return // parallax is motion; honor the preference by never starting it

    function onPointerMove(e: PointerEvent) {
      const x = (e.clientX / window.innerWidth) * 2 - 1
      const y = (e.clientY / window.innerHeight) * 2 - 1
      setTilt({ x: Math.max(-1, Math.min(1, x)), y: Math.max(-1, Math.min(1, y)) })
    }
    function onOrientation(e: DeviceOrientationEvent) {
      if (e.beta == null || e.gamma == null) return
      const x = Math.max(-1, Math.min(1, e.gamma / 24))
      const y = Math.max(-1, Math.min(1, (e.beta - 45) / 24))
      setTilt({ x, y })
    }

    window.addEventListener('pointermove', onPointerMove)

    let orientationAttached = false
    const DOE = window.DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<string> }
    if (typeof DOE?.requestPermission === 'function') {
      // Best-effort only, no gesture-gated retry: unlike ShareableCard.tsx
      // (opened via a deliberate "keep this card" click), a shared link
      // can land a stranger here with no prior interaction at all, so
      // there is no guaranteed gesture to hang the iOS permission request
      // on. If it's denied or the browser defers it, parallax simply
      // stays pointer-only -- never a blocking prompt on a page a
      // recipient may abandon in seconds.
      DOE.requestPermission().then(state => {
        if (state === 'granted') {
          window.addEventListener('deviceorientation', onOrientation)
          orientationAttached = true
        }
      }).catch(() => {})
    } else if (typeof window.DeviceOrientationEvent !== 'undefined') {
      window.addEventListener('deviceorientation', onOrientation)
      orientationAttached = true
    }

    return () => {
      window.removeEventListener('pointermove', onPointerMove)
      if (orientationAttached) window.removeEventListener('deviceorientation', onOrientation)
    }
  }, [])

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
        @keyframes elderShareLandscapeDrift {
          from { transform: scale(1); }
          to   { transform: scale(1.06); }
        }
        @media (prefers-reduced-motion: reduce) {
          [data-elder-motion="true"] { animation: none !important; }
        }
      `}</style>

      {landscapeSrc && (
        <>
          {/* Two nested layers, same reasoning as ShareableCard.tsx's
              landscape plate: the parallax transform (plain inline style,
              driven by `tilt`) and the Ken Burns drift (a CSS keyframe)
              each need to own their own element's `transform`, or the
              keyframe's fill-mode:both hold silently overrides whatever
              the inline style tries to set on the same node. inset:-20
              gives the drift/parallax room to move without ever exposing
              an edge, same margin trick as the sender's card. */}
          <div style={{
            position: 'fixed',
            inset: -20,
            transform: `translate3d(${tilt.x * 7}px, ${tilt.y * 5}px, 0)`,
            transition: 'transform 0.6s cubic-bezier(0.16,1,0.3,1)',
            pointerEvents: 'none',
          }}>
            <img
              src={landscapeSrc}
              alt=""
              data-elder-motion="true"
              style={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                opacity: 0.4,
                filter: 'saturate(1.1) contrast(1.05)',
                animation: 'elderShareLandscapeDrift 34s ease-in-out infinite alternate',
              }}
            />
          </div>
          <div style={{
            position: 'fixed',
            inset: 0,
            background: `radial-gradient(ellipse 70% 60% at 50% 40%, ${accent}14 0%, transparent 55%), linear-gradient(180deg, rgba(6,5,4,0.55) 0%, rgba(6,5,4,0.75) 55%, ${C.obsidian} 100%)`,
            pointerEvents: 'none',
          }} />
          {/* the same tilt-reactive glass sheen as ShareableCard.tsx's plate
              -- a light streak that genuinely shifts with the parallax
              instead of sitting fixed while everything around it implies
              depth. Fainter here than the sender's card (0.02 vs 0.035 base)
              since this is a full-viewport wash, not a bounded plate --
              the same intensity would read as a screen glare, not glass. */}
          <div style={{
            position: 'fixed',
            inset: 0,
            background: `linear-gradient(${115 + tilt.x * 30}deg, transparent ${28 + tilt.y * 6}%, rgba(255,255,255,${0.02 + Math.abs(tilt.x) * 0.012}) 48%, transparent ${62 - tilt.y * 6}%)`,
            transition: 'background 0.6s cubic-bezier(0.16,1,0.3,1)',
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
              data-elder-motion="true"
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

          {/* Collapsed by default, deliberately -- this is a trace for
              whoever wants to verify what generated this reading
              (provenance.ts's own stated purpose), not a public credential
              to display. Opening it costs a click; leaving it closed costs
              nothing, so the ceremonial page beneath stays exactly as
              uncluttered as it already was for the 99% of viewers who never
              touch it. No raw JSON, no field names like "contract_version"
              -- short human labels, same register as the rest of this page. */}
          {card.provenance && (
            <div style={{ marginTop: 18 }}>
              <button
                onClick={() => setTraceOpen(o => !o)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: C.smoke,
                  fontFamily: "'Inter', Arial, sans-serif",
                  fontSize: '0.56rem',
                  letterSpacing: '0.2em',
                  textTransform: 'uppercase',
                  cursor: 'pointer',
                  opacity: 0.55,
                  padding: 0,
                }}
              >
                {traceOpen ? '— Hide trace' : 'Trace this reading'}
              </button>
              {traceOpen && (
                <div style={{
                  marginTop: 12,
                  fontFamily: "'Inter', Arial, sans-serif",
                  fontSize: '0.58rem',
                  letterSpacing: '0.04em',
                  color: C.smoke,
                  opacity: 0.65,
                  lineHeight: 2,
                  textTransform: 'none',
                }}>
                  {[
                    ['Corpus', card.provenance.corpus_version],
                    ['Model', card.provenance.model_version],
                    ['Contract', card.provenance.contract_version],
                    ['Voice', card.provenance.voice],
                    Array.isArray(card.provenance.passage_ids)
                      ? ['Retrieved', card.provenance.passage_ids.length > 0 ? `${card.provenance.passage_ids.length} passage${card.provenance.passage_ids.length === 1 ? '' : 's'}` : 'none']
                      : null,
                    ['Generated', typeof card.provenance.generated_at === 'string' ? new Date(card.provenance.generated_at).toISOString().slice(0, 10) : null],
                  ]
                    .filter((row): row is [string, unknown] => !!row && row[1] != null && row[1] !== '')
                    .map(([label, value]) => (
                      <div key={label}>{label}: {String(value)}</div>
                    ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
