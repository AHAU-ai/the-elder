'use client'

// app/components/ShareableCard.tsx
//
// Renders the seeker's chosen line as a downloadable/shareable PNG,
// entirely client-side. The image itself is always composed and
// rasterized locally — never uploaded. For a SIGNED-IN seeker only, the
// one quoted line + marker + voice + optional dedication (never the full
// reading) is persisted behind a share id, so a viewer who opens the
// shared link can leave a wordless glyph back (see /share/[id] and
// lib/shareLedger.ts) — closing the loop the sharer started. Anonymous
// seekers keep the original fully-local behavior: nothing sent or stored.
//
// Includes an optional "name someone this threshold is for" step —
// deliberately framed as a ritual act (a dedication woven into the
// card and the share text) rather than a referral mechanic.
//
// Requires: npm install html-to-image

import { useRef, useState } from 'react'
import { C, GlyphDivider } from './LintelShared'
import {
  MARKER_GLYPHS,
  MARKER_LABELS,
  accentForVoice,
  type MarkerType,
} from '@/lib/mythopoetics/cardConfig'
import type { VoiceKey } from '@/src/resilience/flags'

interface Props {
  line: string
  marker: MarkerType
  voiceKey: VoiceKey
  signedIn?: boolean
  onMarkerChange: (m: MarkerType) => void
  onClose: () => void
}

export default function ShareableCard({ line, marker, voiceKey, signedIn = false, onMarkerChange, onClose }: Props) {
  const cardRef = useRef<HTMLDivElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dedicatedTo, setDedicatedTo] = useState('')

  // Only created for signed-in seekers — an anonymous share has no owner to
  // report a response back to. Deliberately narrow: just the one quoted
  // line + marker + voice + dedication, never the full reading.
  async function createShareLink(): Promise<string | null> {
    if (!signedIn) return null
    try {
      const res = await fetch('/api/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ line, marker, voiceKey, dedicatedTo: dedicatedTo.trim() }),
      })
      if (!res.ok) return null
      const data = await res.json()
      return data?.id ? `${window.location.origin}/share/${data.id}` : null
    } catch {
      return null
    }
  }

  const accent = accentForVoice(voiceKey)

  async function renderPng(): Promise<Blob | null> {
    if (!cardRef.current) return null
    // Dynamic import keeps this out of the main bundle until someone
    // actually opens the card view.
    const { toBlob } = await import('html-to-image')
    return toBlob(cardRef.current, { pixelRatio: 2 })
  }

  async function handleDownload() {
    setBusy(true)
    setError(null)
    try {
      const blob = await renderPng()
      if (!blob) throw new Error('no card element')
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'the-elder-reading.png'
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      setError('The card would not take shape. Try again in a moment.')
    } finally {
      setBusy(false)
    }
  }

  async function handleShare() {
    setBusy(true)
    setError(null)
    try {
      const [blob, shareUrl] = await Promise.all([renderPng(), createShareLink()])
      if (!blob) throw new Error('no card element')
      const file = new File([blob], 'the-elder-reading.png', { type: 'image/png' })
      const baseText = dedicatedTo.trim()
        ? `This threshold is named for ${dedicatedTo.trim()}.`
        : 'A myth diviner named something in me.'
      const text = shareUrl ? `${baseText}\n${shareUrl}` : baseText
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: 'The Elder', text })
      } else {
        await handleDownload()
      }
    } catch {
      // user cancelling the native share sheet also lands here; treat as silent
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(10,8,6,0.92)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        zIndex: 1000,
      }}
    >
      {/* on-screen-only motion -- html-to-image captures a single frame, so
          this never shows up in the exported PNG; it just gives the live
          card a quiet pulse instead of being a dead screenshot preview */}
      <style>{`
        @keyframes elderCardIn {
          from { opacity: 0; transform: scale(0.96) translateY(10px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes elderRingSpin {
          from { transform: translate(-50%,-50%) rotate(0deg); }
          to   { transform: translate(-50%,-50%) rotate(360deg); }
        }
        @keyframes elderRingSpinReverse {
          from { transform: translate(-50%,-50%) rotate(360deg); }
          to   { transform: translate(-50%,-50%) rotate(0deg); }
        }
        @keyframes elderGlyphPulse {
          0%, 100% { opacity: 1; filter: brightness(1); }
          50%      { opacity: 0.86; filter: brightness(1.18); }
        }
        @keyframes elderMotePulse {
          0%, 100% { opacity: var(--mote-o, 0.5); transform: scale(1); }
          50%      { opacity: calc(var(--mote-o, 0.5) * 0.25); transform: scale(0.6); }
        }
      `}</style>
      {/* ── THE CARD ─────────────────────────────────────────────── */}
      <div
        ref={cardRef}
        style={{
          width: 480,
          maxWidth: '100%',
          minHeight: 520,
          background: `radial-gradient(ellipse at 50% 38%, ${accent}18 0%, transparent 62%), linear-gradient(160deg, #100c08 0%, ${C.obsidian} 55%, #06050400 100%)`,
          border: `1px solid ${accent}55`,
          borderRadius: 6,
          boxShadow: `0 0 0 1px rgba(0,0,0,0.4), 0 24px 60px -12px rgba(0,0,0,0.75), 0 0 80px -20px ${accent}40, inset 0 0 60px rgba(0,0,0,0.5)`,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '48px 40px',
          textAlign: 'center',
          fontFamily: "'Gentium Plus', Georgia, serif",
          position: 'relative',
          overflow: 'hidden',
          animation: 'elderCardIn 0.9s cubic-bezier(0.16,1,0.3,1) both',
        }}
      >
        {/* inner hairline frame, set slightly inside the outer border for a
            engraved-plate feel */}
        <div style={{
          position: 'absolute',
          inset: 10,
          border: `1px solid ${accent}2a`,
          borderRadius: 3,
          pointerEvents: 'none',
        }} />

        {/* vignette -- darkens the edges so the glyph and text read as the
            clear focal point regardless of what's behind them */}
        <div style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(ellipse at 50% 45%, transparent 45%, rgba(0,0,0,0.55) 100%)',
          pointerEvents: 'none',
        }} />

        {/* faint diagonal sheen -- a whisper of foil-catch across the plate,
            not a moving highlight (the card is a still image once exported) */}
        <div style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(115deg, transparent 30%, rgba(255,255,255,0.035) 48%, transparent 62%)',
          pointerEvents: 'none',
        }} />
        {/* grain texture -- adds tooth to the flat obsidian field. `screen`
            blend (not `overlay`) because overlay collapses to a no-op
            against a near-black base -- screen adds visible speckle
            regardless of how dark the field underneath is. */}
        <div style={{
          position: 'absolute',
          inset: 0,
          opacity: 0.06,
          mixBlendMode: 'screen',
          pointerEvents: 'none',
          backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
        }} />

        {/* concentric dashed rings, echoing the ElderEye motif, centered behind
            the glyph. Each ring drifts at a different, glacial speed in
            opposite directions -- like an orrery, not a spinner. Slow enough
            that a single-frame PNG capture never looks mid-motion. */}
        <svg
          viewBox="0 0 300 300"
          style={{ position: 'absolute', top: '38%', left: '50%', width: 300, height: 300, transform: 'translate(-50%,-50%)', pointerEvents: 'none', animation: 'elderRingSpin 140s linear infinite' }}
        >
          <circle cx="150" cy="150" r="128" stroke={accent} strokeWidth="0.5" strokeDasharray="3 9" opacity="0.22" fill="none" />
        </svg>
        <svg
          viewBox="0 0 300 300"
          style={{ position: 'absolute', top: '38%', left: '50%', width: 300, height: 300, transform: 'translate(-50%,-50%)', pointerEvents: 'none', animation: 'elderRingSpinReverse 95s linear infinite' }}
        >
          <circle cx="150" cy="150" r="96" stroke={accent} strokeWidth="0.4" strokeDasharray="1.5 7" opacity="0.16" fill="none" />
        </svg>

        {/* quantum motes -- a sparse scatter of points of light, each on its
            own breathing cycle. Meant to read as suspended dust in the glow,
            not decoration; kept faint and few so it stays a whisper. */}
        {[
          { top: '14%', left: '22%', size: 2, o: 0.7, dur: 4.2, delay: 0 },
          { top: '24%', left: '78%', size: 1.4, o: 0.5, dur: 5.6, delay: 0.8 },
          { top: '58%', left: '12%', size: 1.6, o: 0.55, dur: 6.4, delay: 1.6 },
          { top: '68%', left: '86%', size: 2, o: 0.65, dur: 5.0, delay: 2.2 },
          { top: '82%', left: '32%', size: 1.3, o: 0.45, dur: 7.0, delay: 0.4 },
          { top: '10%', left: '55%', size: 1.5, o: 0.5, dur: 6.0, delay: 3.1 },
        ].map((m, i) => (
          <div
            key={i}
            style={{
              position: 'absolute',
              top: m.top,
              left: m.left,
              width: m.size,
              height: m.size,
              borderRadius: '50%',
              background: accent,
              boxShadow: `0 0 6px 1px ${accent}`,
              opacity: m.o,
              pointerEvents: 'none',
              '--mote-o': m.o,
              animation: `elderMotePulse ${m.dur}s ease-in-out ${m.delay}s infinite`,
            } as React.CSSProperties}
          />
        ))}

        {/* corner ornaments -- dashed arc nested inside an L-bracket */}
        {[
          { top: 18, left: 18, rot: 0 },
          { top: 18, right: 18, rot: 90 },
          { bottom: 18, right: 18, rot: 180 },
          { bottom: 18, left: 18, rot: 270 },
        ].map((pos, i) => (
          <svg key={i} viewBox="0 0 32 32" width="26" height="26" style={{ position: 'absolute', ...pos, transform: `rotate(${pos.rot}deg)`, opacity: 0.65 }}>
            <path d="M2 14 L2 2 L14 2" stroke={accent} strokeWidth="1" fill="none" />
            <path d="M2 22 A18 18 0 0 1 22 2" stroke={accent} strokeWidth="0.5" strokeDasharray="2 4" fill="none" opacity="0.7" />
            <circle cx="2" cy="2" r="1.1" fill={accent} opacity="0.8" />
          </svg>
        ))}

        {/* soft radial glow seated behind the glyph */}
        <div style={{
          position: 'absolute',
          top: '20%',
          left: '50%',
          width: 180,
          height: 180,
          transform: 'translate(-50%,-50%)',
          background: `radial-gradient(circle, ${accent}59 0%, ${accent}00 70%)`,
          pointerEvents: 'none',
        }} />

        {/* foreground content -- lifted into its own stacking context so it
            paints above the positioned decorative layers above (positioned
            elements always paint after static ones, regardless of DOM order) */}
        <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{
            fontSize: 44,
            color: accent,
            marginBottom: 10,
            textShadow: `0 0 18px ${accent}99, 0 0 40px ${accent}44`,
            letterSpacing: '0.02em',
            animation: 'elderGlyphPulse 5.5s ease-in-out infinite',
          }}>
            {MARKER_GLYPHS[marker]}
          </div>
          <div style={{
            fontFamily: "'Inter', Arial, sans-serif",
            fontSize: '0.62rem',
            letterSpacing: '0.32em',
            color: C.ash,
            textTransform: 'uppercase',
            marginBottom: 28,
            opacity: 0.9,
          }}>
            {MARKER_LABELS[marker]}
          </div>

          <div style={{ position: 'relative', maxWidth: 360, marginBottom: 32 }}>
            <span style={{
              position: 'absolute',
              top: -22,
              left: -6,
              fontSize: '2.6rem',
              color: accent,
              opacity: 0.35,
              fontFamily: "Georgia, serif",
              lineHeight: 1,
              userSelect: 'none',
            }}>
              &ldquo;
            </span>
            <div style={{
              fontStyle: 'italic',
              color: C.bone,
              fontSize: 'clamp(1.1rem, 3vw, 1.4rem)',
              lineHeight: 1.8,
              letterSpacing: '0.01em',
              textWrap: 'balance',
              textShadow: '0 1px 12px rgba(0,0,0,0.5)',
            }}>
              {line}
            </div>
            <span style={{
              position: 'absolute',
              bottom: -38,
              right: -6,
              fontSize: '2.6rem',
              color: accent,
              opacity: 0.35,
              fontFamily: "Georgia, serif",
              lineHeight: 1,
              userSelect: 'none',
            }}>
              &rdquo;
            </span>
          </div>

          {dedicatedTo.trim() && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              marginBottom: 24,
              opacity: 0.85,
            }}>
              <span style={{ width: 14, height: 1, background: `${accent}80` }} />
              <span style={{
                fontFamily: "'Inter', Arial, sans-serif",
                fontSize: '0.6rem',
                letterSpacing: '0.18em',
                color: accent,
                textTransform: 'uppercase',
              }}>
                Named for {dedicatedTo.trim()}
              </span>
              <span style={{ width: 14, height: 1, background: `${accent}80` }} />
            </div>
          )}

          <GlyphDivider symbol="⟡" opacity={0.45} color={accent} />

          <div style={{
            fontFamily: "'Inter', Arial, sans-serif",
            fontSize: '0.5rem',
            letterSpacing: '0.32em',
            textTransform: 'uppercase',
            marginTop: 20,
          }}>
            <span style={{
              background: `linear-gradient(115deg, ${C.smoke} 0%, ${accent} 45%, ${C.paleGold} 55%, ${C.smoke} 100%)`,
              WebkitBackgroundClip: 'text',
              backgroundClip: 'text',
              color: 'transparent',
              opacity: 0.9,
            }}>
              THE ELDER
            </span>
            <span style={{ color: accent, opacity: 0.6 }}> · </span>
            <span style={{ color: C.smoke, opacity: 0.7 }}>Myth Diviner</span>
          </div>
        </div>
      </div>

      {/* ── MARKER PICKER (not part of the rasterized card) ─────────── */}
      <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
        {(Object.keys(MARKER_GLYPHS) as MarkerType[]).map(m => (
          <button
            key={m}
            onClick={() => onMarkerChange(m)}
            title={MARKER_LABELS[m]}
            style={{
              background: m === marker ? `${accent}1a` : 'transparent',
              border: `1px solid ${m === marker ? accent : 'rgba(212,168,67,0.2)'}`,
              color: m === marker ? accent : C.smoke,
              fontSize: '1.1rem',
              width: 36,
              height: 36,
              borderRadius: '50%',
              cursor: 'pointer',
              boxShadow: m === marker ? `0 0 14px ${accent}55` : 'none',
              transition: 'background 0.2s ease, box-shadow 0.2s ease, color 0.2s ease, border-color 0.2s ease',
            }}
          >
            {MARKER_GLYPHS[m]}
          </button>
        ))}
      </div>

      {/* ── NAME SOMEONE THIS IS FOR (not part of the rasterized card) ── */}
      <div style={{ marginTop: 24, width: 280, maxWidth: '100%', textAlign: 'center' }}>
        <div style={{
          fontFamily: "'Inter', Arial, sans-serif",
          fontSize: '0.58rem',
          letterSpacing: '0.24em',
          color: C.smoke,
          textTransform: 'uppercase',
          marginBottom: 10,
          opacity: 0.75,
        }}>
          Name someone this threshold is for
        </div>
        <input
          type="text"
          value={dedicatedTo}
          onChange={e => setDedicatedTo(e.target.value.slice(0, 40))}
          placeholder="optional"
          style={{
            width: '100%',
            background: 'transparent',
            border: `1px solid rgba(212,168,67,0.25)`,
            color: C.bone,
            fontFamily: "'Gentium Plus', Georgia, serif",
            fontStyle: 'italic',
            fontSize: '0.9rem',
            padding: '9px 14px',
            textAlign: 'center',
            borderRadius: 2,
          }}
        />
      </div>

      {/* ── ACTIONS ──────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 16, marginTop: 28 }}>
        <button
          onClick={handleShare}
          disabled={busy}
          style={{
            background: `${accent}12`,
            border: `1px solid ${accent}`,
            color: accent,
            fontFamily: "'Gentium Plus', Georgia, serif",
            fontSize: '0.7rem',
            letterSpacing: '0.24em',
            padding: '13px 30px',
            borderRadius: 3,
            cursor: busy ? 'default' : 'pointer',
            textTransform: 'uppercase',
            opacity: busy ? 0.5 : 1,
            boxShadow: busy ? 'none' : `0 0 20px ${accent}30`,
            transition: 'box-shadow 0.2s ease, background 0.2s ease',
          }}
        >
          {busy ? 'Preparing…' : dedicatedTo.trim() ? `Send to ${dedicatedTo.trim()}` : 'Share'}
        </button>
        <button
          onClick={handleDownload}
          disabled={busy}
          style={{
            background: 'transparent',
            border: '1px solid rgba(212,168,67,0.3)',
            color: C.ash,
            fontFamily: "'Gentium Plus', Georgia, serif",
            fontSize: '0.7rem',
            letterSpacing: '0.24em',
            padding: '13px 30px',
            borderRadius: 3,
            cursor: busy ? 'default' : 'pointer',
            textTransform: 'uppercase',
            opacity: busy ? 0.5 : 1,
            transition: 'border-color 0.2s ease, color 0.2s ease',
          }}
        >
          Keep the Card
        </button>
        <button
          onClick={onClose}
          style={{
            background: 'transparent',
            border: 'none',
            color: C.smoke,
            fontFamily: "'Inter', Arial, sans-serif",
            fontSize: '0.65rem',
            letterSpacing: '0.2em',
            cursor: 'pointer',
            textTransform: 'uppercase',
          }}
        >
          Return to the Fire
        </button>
      </div>

      {error && (
        <div style={{ color: C.ember, fontSize: '0.75rem', marginTop: 14, fontStyle: 'italic' }}>
          {error}
        </div>
      )}
    </div>
  )
}
