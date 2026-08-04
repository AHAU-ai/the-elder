'use client'

// app/components/ShareableCard.tsx
//
// Renders the seeker's chosen line as a downloadable/shareable PNG,
// entirely client-side. No reading text is ever sent to a server for
// this feature — consistent with altar_record's "no seeker text"
// design. The image is composed in the browser from the line the
// seeker already has in front of them and rasterized locally.
//
// Includes an optional "name someone this threshold is for" step —
// deliberately framed as a ritual act (a dedication woven into the
// card and the share text) rather than a referral mechanic. Nothing
// entered here is sent anywhere or stored; it only ever exists in
// this component's local state and the rasterized image itself.
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
  onMarkerChange: (m: MarkerType) => void
  onClose: () => void
}

export default function ShareableCard({ line, marker, voiceKey, onMarkerChange, onClose }: Props) {
  const cardRef = useRef<HTMLDivElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dedicatedTo, setDedicatedTo] = useState('')

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
      const blob = await renderPng()
      if (!blob) throw new Error('no card element')
      const file = new File([blob], 'the-elder-reading.png', { type: 'image/png' })
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: 'The Elder',
          text: dedicatedTo.trim()
            ? `This threshold is named for ${dedicatedTo.trim()}.`
            : 'A myth diviner named something in me.',
        })
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
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        zIndex: 1000,
      }}
    >
      {/* ── THE CARD ─────────────────────────────────────────────── */}
      <div
        ref={cardRef}
        style={{
          width: 480,
          maxWidth: '100%',
          aspectRatio: '4 / 5',
          background: `radial-gradient(ellipse at 50% 38%, ${accent}14 0%, transparent 60%), ${C.obsidian}`,
          border: `1px solid ${accent}55`,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '48px 40px',
          textAlign: 'center',
          fontFamily: "'Gentium Plus', Georgia, serif",
          position: 'relative',
          overflow: 'hidden',
        }}
      >
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

        {/* concentric dashed rings, echoing the ElderEye motif, centered behind the glyph */}
        <svg
          viewBox="0 0 300 300"
          style={{ position: 'absolute', top: '38%', left: '50%', width: 300, height: 300, transform: 'translate(-50%,-50%)', pointerEvents: 'none' }}
        >
          <circle cx="150" cy="150" r="128" stroke={accent} strokeWidth="0.5" strokeDasharray="3 9" opacity="0.22" fill="none" />
          <circle cx="150" cy="150" r="96" stroke={accent} strokeWidth="0.4" strokeDasharray="1.5 7" opacity="0.16" fill="none" />
        </svg>

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
          <div style={{ fontSize: 44, color: accent, marginBottom: 8, textShadow: `0 0 18px ${accent}99, 0 0 40px ${accent}44` }}>
            {MARKER_GLYPHS[marker]}
          </div>
          <div style={{
            fontFamily: "'Inter', Arial, sans-serif",
            fontSize: '0.62rem',
            letterSpacing: '0.32em',
            color: C.smoke,
            textTransform: 'uppercase',
            marginBottom: 28,
          }}>
            {MARKER_LABELS[marker]}
          </div>

          <div style={{
            fontStyle: 'italic',
            color: C.bone,
            fontSize: 'clamp(1.1rem, 3vw, 1.4rem)',
            lineHeight: 1.8,
            marginBottom: 32,
          }}>
            "{line}"
          </div>

          {dedicatedTo.trim() && (
            <div style={{
              fontFamily: "'Inter', Arial, sans-serif",
              fontSize: '0.62rem',
              letterSpacing: '0.2em',
              color: accent,
              textTransform: 'uppercase',
              marginBottom: 24,
              opacity: 0.85,
            }}>
              Named for {dedicatedTo.trim()}
            </div>
          )}

          <GlyphDivider symbol="⟡" opacity={0.4} />

          <div style={{
            fontFamily: "'Inter', Arial, sans-serif",
            fontSize: '0.5rem',
            letterSpacing: '0.28em',
            color: C.smoke,
            textTransform: 'uppercase',
            marginTop: 20,
            opacity: 0.7,
          }}>
            THE ELDER · Myth Diviner
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
              background: 'transparent',
              border: `1px solid ${m === marker ? accent : 'rgba(212,168,67,0.2)'}`,
              color: m === marker ? accent : C.smoke,
              fontSize: '1.1rem',
              width: 36,
              height: 36,
              borderRadius: '50%',
              cursor: 'pointer',
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
            background: 'transparent',
            border: `1px solid ${accent}`,
            color: accent,
            fontFamily: "'Gentium Plus', Georgia, serif",
            fontSize: '0.7rem',
            letterSpacing: '0.24em',
            padding: '13px 30px',
            cursor: busy ? 'default' : 'pointer',
            textTransform: 'uppercase',
            opacity: busy ? 0.5 : 1,
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
            cursor: busy ? 'default' : 'pointer',
            textTransform: 'uppercase',
            opacity: busy ? 0.5 : 1,
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
