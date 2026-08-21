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
// `line` must already be a CardQuote (lib/mythopoetics/cardConfig.ts) --
// callers derive it with pullQuote() before passing it in, not this
// component. That's deliberate: this is the one value that gets
// rasterized into the PNG *and* sent to /api/share, so there is no second
// "raw line" left anywhere in this file that a future edit could send to
// one destination and not the other.
//
// Includes an optional "name someone this threshold is for" step —
// deliberately framed as a ritual act (a dedication woven into the
// card and the share text) rather than a referral mechanic.
//
// Requires: npm install html-to-image

import { useEffect, useRef, useState } from 'react'
import { C, GlyphDivider } from './LintelShared'
import {
  MARKER_GLYPHS,
  MARKER_LABELS,
  accentForVoice,
  attributionForVoice,
  landscapeFor,
  flowerFrameFor,
  type MarkerType,
  type CardQuote,
} from '@/lib/mythopoetics/cardConfig'
import { startAmbientLoop, playArrival, type AmbientLoop } from '@/lib/mythopoetics/cardAudio'
import { embedProvenanceInPng } from '@/lib/pngProvenance'
import SeekerSeal from './SeekerSeal'
import type { VoiceKey } from '@/src/resilience/flags'

interface Props {
  line: CardQuote
  marker: MarkerType
  voiceKey: VoiceKey
  signedIn?: boolean
  // provenance.ts's machine-readable stamp for the reading this card was
  // pulled from (provenanceMetadata()'s shape, threaded from CouncilTabs.tsx's
  // firstReadingProvenance). Optional/nullable: a thread-resumed or otherwise
  // provenance-less card still exports fine, just without the stamp.
  provenance?: Record<string, unknown> | null
  onMarkerChange: (m: MarkerType) => void
  onClose: () => void
}

// A ritual instrument, not a flat icon button: a dashed circle (echoing the
// card's own orrery rings) with four cardinal ticks like a compass rose,
// and a soft bloom of glow around an active/selected state instead of a
// filled background swap. Used for both the marker picker and the audio
// toggle so every control the seeker touches around the card speaks the
// same visual language the card face already does, not generic app chrome.
function SigilButton({
  active,
  accent,
  onClick,
  title,
  size = 40,
  children,
}: {
  active: boolean
  accent: string
  onClick: () => void
  title: string
  size?: number
  children: React.ReactNode
}) {
  const ringColor = active ? accent : 'rgba(212,168,67,0.3)'
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        position: 'relative',
        width: size,
        height: size,
        background: 'transparent',
        border: 'none',
        borderRadius: '50%',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: active ? accent : C.smoke,
        transition: 'color 0.25s ease',
      }}
    >
      {active && (
        <div style={{
          position: 'absolute',
          inset: -5,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${accent}33 0%, transparent 72%)`,
          pointerEvents: 'none',
        }} />
      )}
      <svg viewBox="0 0 40 40" width={size} height={size} style={{ position: 'absolute', inset: 0 }}>
        <circle
          cx="20" cy="20" r="18"
          stroke={ringColor}
          strokeWidth="0.75"
          strokeDasharray="2 4"
          fill="none"
          opacity={active ? 0.9 : 0.55}
          style={active ? { animation: 'elderRingSpin 40s linear infinite', transformOrigin: '20px 20px' } : undefined}
        />
        {[0, 90, 180, 270].map(rot => (
          <line
            key={rot}
            x1="20" y1="1.5" x2="20" y2="5"
            stroke={ringColor}
            strokeWidth="1"
            opacity={active ? 0.85 : 0.45}
            transform={`rotate(${rot} 20 20)`}
          />
        ))}
      </svg>
      <span style={{ position: 'relative', fontSize: '1.05rem', lineHeight: 1, display: 'flex' }}>
        {children}
      </span>
    </button>
  )
}

// A single hand-authored bloom: layered SVG petals arranged radially inside
// a `perspective` wrapper, each petal pushed to its own translateZ so the
// whole thing reads as a dimensional flower rather than a flat rosette.
// Stays inside the templated-visual-system rule in
// docs/shareable-card-visual-system.md (no AI-generated imagery, ever) --
// this is authored geometry + gradients, same family as the existing
// rings/corner-brackets, just given real depth.
function Flower({
  size = 120,
  accent,
  rotate = 0,
  tiltX = 20,
  tiltY = -12,
  petals = 6,
  uid,
  style,
}: {
  size?: number
  accent: string
  rotate?: number
  tiltX?: number
  tiltY?: number
  petals?: number
  uid: string
  style?: React.CSSProperties
}) {
  return (
    <div
      style={{
        position: 'absolute',
        width: size,
        height: size,
        perspective: 640,
        pointerEvents: 'none',
        ...style,
      }}
    >
      <div
        style={{
          position: 'relative',
          width: '100%',
          height: '100%',
          transformStyle: 'preserve-3d',
          transform: `rotate(${rotate}deg) rotateX(${tiltX}deg) rotateY(${tiltY}deg)`,
          animation: `elderFlowerSway 9s ease-in-out ${(rotate % 5)}s infinite`,
        }}
      >
        {/* stem + leaf, seated slightly behind the bloom */}
        <svg
          viewBox="0 0 100 100"
          width={size * 0.62}
          height={size * 0.62}
          style={{
            position: 'absolute',
            top: '54%',
            left: '48%',
            transform: 'translateZ(-16px) rotate(16deg)',
            opacity: 0.85,
          }}
        >
          <path d="M50 92 C 18 74, 12 40, 46 12" stroke="#3d5636" strokeWidth="3" fill="none" opacity="0.65" />
          <path d="M34 56 C 18 50, 8 58, 6 73 C 21 76, 32 67, 34 56 Z" fill="#48633f" opacity="0.7" />
        </svg>

        {/* radial petals -- alternating depth + brightness fakes a bloom
            opening toward the viewer instead of lying flat */}
        {Array.from({ length: petals }).map((_, i) => {
          const angle = (360 / petals) * i
          const z = 6 + (i % 2) * 12
          const bright = i % 2 === 0 ? 1.05 : 0.8
          const gradId = `${uid}-petal-${i}`
          return (
            <svg
              key={i}
              viewBox="0 0 60 100"
              width={size * 0.42}
              height={size * 0.66}
              style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transformOrigin: '50% 100%',
                transform: `translate(-50%,-100%) rotate(${angle}deg) translateZ(${z}px)`,
                filter: `brightness(${bright}) drop-shadow(0 5px 7px rgba(0,0,0,0.4))`,
              }}
            >
              <defs>
                <linearGradient id={gradId} x1="0" y1="1" x2="0" y2="0">
                  <stop offset="0%" stopColor={accent} stopOpacity="0.5" />
                  <stop offset="55%" stopColor={accent} stopOpacity="0.95" />
                  <stop offset="100%" stopColor="#fff6e6" stopOpacity="0.92" />
                </linearGradient>
              </defs>
              <path
                d="M30 100 C 4 70, 4 24, 30 0 C 56 24, 56 70, 30 100 Z"
                fill={`url(#${gradId})`}
                stroke="rgba(0,0,0,0.28)"
                strokeWidth="0.5"
              />
            </svg>
          )
        })}

        {/* raised center, given the most translateZ so it reads as the
            closest point of the bloom */}
        <svg
          viewBox="0 0 40 40"
          width={size * 0.22}
          height={size * 0.22}
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%,-50%) translateZ(20px)',
          }}
        >
          <defs>
            <radialGradient id={`${uid}-center`} cx="35%" cy="30%" r="70%">
              <stop offset="0%" stopColor="#fff2c8" />
              <stop offset="60%" stopColor="#caa23a" />
              <stop offset="100%" stopColor="#7a5c1e" />
            </radialGradient>
          </defs>
          <circle cx="20" cy="20" r="17" fill={`url(#${uid}-center)`} />
        </svg>
      </div>
    </div>
  )
}

export default function ShareableCard({ line, marker, voiceKey, signedIn = false, provenance = null, onMarkerChange, onClose }: Props) {
  const cardRef = useRef<HTMLDivElement>(null)
  const plateRef = useRef<HTMLDivElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dedicatedTo, setDedicatedTo] = useState('')

  // Depth: the card reads as a window looked THROUGH, not a picture pasted
  // behind text -- the same threshold-crossing metaphor already built into
  // every other layer of this card (the archway/doorway landscapes, the
  // "crossing" language throughout the app) made literal via parallax.
  // tilt.x/y range roughly -1..1. Desktop: mouse position relative to the
  // card's own center. Mobile: device tilt (gamma/beta), where available --
  // requested without a permission prompt on Android (none needed) and
  // best-effort on iOS 13+ (DeviceOrientationEvent.requestPermission is
  // gated on a user gesture; opening this card IS that gesture, so the
  // request happens on mount rather than waiting for a second tap the
  // seeker was never asked to make. Silently no-ops if declined -- the
  // card is already fully legible motionless, parallax is an addition,
  // never a requirement).
  const [tilt, setTilt] = useState({ x: 0, y: 0 })

  useEffect(() => {
    const el = plateRef.current
    if (!el) return
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return

    function onPointerMove(e: PointerEvent) {
      const rect = el!.getBoundingClientRect()
      const x = ((e.clientX - rect.left) / rect.width) * 2 - 1
      const y = ((e.clientY - rect.top) / rect.height) * 2 - 1
      setTilt({ x: Math.max(-1, Math.min(1, x)), y: Math.max(-1, Math.min(1, y)) })
    }
    function onPointerLeave() {
      setTilt({ x: 0, y: 0 })
    }
    function onOrientation(e: DeviceOrientationEvent) {
      if (e.beta == null || e.gamma == null) return
      // Neutral "holding the phone upright, facing you" is roughly
      // beta=45,gamma=0 -- centered on that rather than beta=0 (flat on a
      // table), which would put the resting tilt off in a corner.
      const x = Math.max(-1, Math.min(1, e.gamma / 24))
      const y = Math.max(-1, Math.min(1, (e.beta - 45) / 24))
      setTilt({ x, y })
    }

    el.addEventListener('pointermove', onPointerMove)
    el.addEventListener('pointerleave', onPointerLeave)

    let orientationAttached = false
    const DOE = window.DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<string> }
    if (typeof DOE?.requestPermission === 'function') {
      DOE.requestPermission().then(state => {
        if (state === 'granted') {
          window.addEventListener('deviceorientation', onOrientation)
          orientationAttached = true
        }
      }).catch(() => { /* declined or unsupported -- card stays motionless-but-legible */ })
    } else if (typeof window.DeviceOrientationEvent !== 'undefined') {
      window.addEventListener('deviceorientation', onOrientation)
      orientationAttached = true
    }

    return () => {
      el.removeEventListener('pointermove', onPointerMove)
      el.removeEventListener('pointerleave', onPointerLeave)
      if (orientationAttached) window.removeEventListener('deviceorientation', onOrientation)
    }
  }, [])

  // Ambient bed + arrival chime/haptic (lib/mythopoetics/cardAudio.ts).
  // Muted by default: browsers block unmuted autoplay anyway, and a
  // ritual card announcing itself with sound the seeker didn't ask for
  // is the wrong first impression regardless. audioOnRef mirrors
  // audioOn for the arrival effect below so it doesn't need audioOn in
  // its dependency array (that would replay the chime on every toggle).
  const [audioOn, setAudioOn] = useState(false)
  const audioOnRef = useRef(audioOn)
  audioOnRef.current = audioOn
  const loopRef = useRef<AmbientLoop | null>(null)

  function toggleAudio() {
    setAudioOn(on => {
      const next = !on
      if (next) {
        loopRef.current = startAmbientLoop(marker)
      } else {
        loopRef.current?.stop()
        loopRef.current = null
      }
      return next
    })
  }

  // Swap the ambient loop when the marker changes (picker click), and
  // tear it down on unmount -- never leave a synthesized drone running
  // behind a closed card.
  useEffect(() => {
    if (audioOn) {
      loopRef.current?.stop()
      loopRef.current = startAmbientLoop(marker)
    }
    return () => {
      loopRef.current?.stop()
      loopRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [marker])

  // The multisensory arrival beat: fires once per marker (mount or
  // picker change), timed to the same 0.6s mark as the visual
  // elderGlyphBurst flare so light/sound/touch land together. Haptics
  // fire even when audio is muted (playArrival checks audioOnRef
  // internally) -- vibration isn't "sound" and carries no autoplay
  // restriction, so muting audio shouldn't silence it too.
  useEffect(() => {
    const t = setTimeout(() => playArrival(marker, audioOnRef.current), 600)
    return () => clearTimeout(t)
  }, [marker])

  // Only created for signed-in seekers — an anonymous share has no owner to
  // report a response back to. Deliberately narrow: just the one quoted
  // line + marker + voice + dedication, never the full reading.
  async function createShareLink(): Promise<string | null> {
    if (!signedIn) return null
    try {
      const res = await fetch('/api/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ line, marker, voiceKey, dedicatedTo: dedicatedTo.trim(), provenance }),
      })
      if (!res.ok) return null
      const data = await res.json()
      return data?.id ? `${window.location.origin}/share/${data.id}` : null
    } catch {
      return null
    }
  }

  const accent = accentForVoice(voiceKey)
  const landscapeSrc = landscapeFor(marker, line)
  const flowerFrameSrc = flowerFrameFor(marker)
  // Incense-smoke drift behavior, keyed to marker archetype -- the same
  // "mood only" constraint as the landscapes and audio. No browser can
  // emit scent, so this is the honest synesthetic stand-in: the thing
  // smoke's *behavior* would tell you (rising straight and steady,
  // spiraling, thinning and scattering) rather than a claim of smell.
  const smokeAnim =
    marker === 'pattern' ? 'elderSmokeSpiral'
    : marker === 'wound' || marker === 'exile' ? 'elderSmokeDisperse'
    : 'elderSmokeRise' // threshold, figure

  async function renderPng(): Promise<Blob | null> {
    if (!cardRef.current) return null
    // Dynamic import keeps this out of the main bundle until someone
    // actually opens the card view.
    const { toBlob } = await import('html-to-image')
    const blob = await toBlob(cardRef.current, { pixelRatio: 2 })
    if (!blob) return null
    // Stamps the PNG itself with provenance.ts's machine-readable
    // traceability data (see lib/pngProvenance.ts) -- resolves that
    // function's own doc comment ("embedded in every exported/shared
    // artifact"), previously true of nothing. Both handleDownload and
    // handleShare call renderPng(), so this single call site covers both
    // export paths. Fails soft to the un-stamped blob if provenance wasn't
    // available for this reading (embedProvenanceInPng also fails soft on
    // its own if the blob somehow isn't PNG-shaped).
    return provenance ? embedProvenanceInPng(blob, provenance) : blob
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
      data-elder-motion-root
      style={{
        position: 'fixed',
        inset: 0,
        background: `radial-gradient(ellipse 70% 60% at 50% 42%, ${accent}10 0%, transparent 60%), rgba(10,8,6,0.92)`,
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        zIndex: 1000,
        overflow: 'hidden',
      }}
    >
      {/* the room the card is held in, not just the card itself -- a sparse
          field of drifting embers behind everything, so opening the card
          feels like stepping into a space already lit rather than a modal
          popping over the page. Each ember rises and fades on its own
          loop; kept faint and few so it stays a periphery detail. */}
      {[
        { left: '8%', size: 2.2, dur: 13, delay: 0 },
        { left: '18%', size: 1.4, dur: 17, delay: 3 },
        { left: '30%', size: 1.8, dur: 15, delay: 6.5 },
        { left: '62%', size: 1.5, dur: 16, delay: 1.5 },
        { left: '74%', size: 2, dur: 12, delay: 5 },
        { left: '86%', size: 1.6, dur: 18, delay: 8 },
        { left: '46%', size: 1.3, dur: 14, delay: 4.5 },
        { left: '93%', size: 1.9, dur: 15.5, delay: 2 },
      ].map((e, i) => (
        <div key={i} style={{
          position: 'absolute',
          bottom: '-4%',
          left: e.left,
          width: e.size,
          height: e.size,
          borderRadius: '50%',
          background: accent,
          boxShadow: `0 0 8px 2px ${accent}`,
          opacity: 0,
          pointerEvents: 'none',
          animation: `elderEmberRise ${e.dur}s ease-in ${e.delay}s infinite`,
        }} />
      ))}
      {/* on-screen-only motion -- html-to-image captures a single frame, so
          this never shows up in the exported PNG; it just gives the live
          card a quiet pulse instead of being a dead screenshot preview */}
      <style>{`
        @keyframes elderEmberRise {
          0%   { opacity: 0;    transform: translateY(0) translateX(0); }
          10%  { opacity: 0.55; }
          85%  { opacity: 0.15; }
          100% { opacity: 0;    transform: translateY(-92vh) translateX(24px); }
        }
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
        @keyframes elderFlowerSway {
          0%, 100% { filter: brightness(1); }
          50%      { filter: brightness(1.06); }
        }
        @keyframes elderLandscapeIn {
          0%   { opacity: 0; transform: scale(1.22) translateZ(0); filter: blur(9px); }
          100% { opacity: 1; transform: scale(1) translateZ(0);    filter: blur(0); }
        }
        @keyframes elderLandscapeDrift {
          from { transform: scale(1); }
          to   { transform: scale(1.08); }
        }
        @keyframes elderEnchantBreathe {
          0%, 100% { opacity: 0.55; transform: scale(1); }
          50%      { opacity: 1;    transform: scale(1.08); }
        }
        @keyframes elderGlyphBurst {
          0%   { opacity: 0;   transform: translate(-50%,-50%) scale(0.3); }
          35%  { opacity: 0.9; }
          100% { opacity: 0;   transform: translate(-50%,-50%) scale(2.6); }
        }
        @keyframes elderSmokeRise {
          0%   { opacity: 0;   transform: translate(-50%,0) translateY(0) scaleX(1); }
          12%  { opacity: 0.5; }
          70%  { opacity: 0.22; }
          100% { opacity: 0;   transform: translate(-50%,0) translateY(-230px) scaleX(2.2); }
        }
        @keyframes elderSmokeSpiral {
          0%   { opacity: 0;   transform: translate(-50%,0) translateY(0) translateX(0) rotate(0deg); }
          12%  { opacity: 0.5; }
          70%  { opacity: 0.2; }
          100% { opacity: 0;   transform: translate(-50%,0) translateY(-220px) translateX(0) rotate(300deg); }
        }
        @keyframes elderSmokeDisperse {
          0%   { opacity: 0;   transform: translate(-50%,0) translateY(0) translateX(0) scaleX(1); }
          10%  { opacity: 0.45; }
          60%  { opacity: 0.15; }
          100% { opacity: 0;   transform: translate(-50%,0) translateY(-150px) translateX(46px) scaleX(3.4); }
        }
        /* Embers, rings, motes, flower sway, landscape drift/dive, glyph
           pulse/burst, incense smoke -- 14 keyframes across this card, all
           purely decorative (nothing here conveys state a seeker needs).
           One attribute-selector override catches every element carrying
           an inline animation style under this card, rather than
           hand-tagging each -- the [style*=animation] selector below
           matches literally against the rendered inline style attribute,
           which is exactly what React emits, so this can't silently miss
           one the way tagging by hand could as the layer count grows. */
        @media (prefers-reduced-motion: reduce) {
          [data-elder-motion-root] [style*="animation"] {
            animation: none !important;
          }
        }
      `}</style>
      {/* ── CAPTURE REGION ───────────────────────────────────────────
          cardRef now wraps the bordered plate AND the floral ornament so
          html-to-image rasterizes both -- the arrangement is meant to be
          part of the kept/shared image, not a screen-only decoration.
          Padding gives the blooms room to drape outside the frame's
          border without being clipped. The wrapper now also paints an
          ambient glow of its own (obsidian falloff over a faint accent
          halo) rather than staying transparent: a downloaded/shared PNG
          gets viewed on arbitrary backgrounds (iMessage, a white doc,
          Slack) the app's own dark chrome won't be behind it there, so
          without this the flowers used to read as a cutout floating on
          nothing instead of a finished piece. */}
      <div
        ref={cardRef}
        style={{
          position: 'relative',
          padding: 46,
          width: 480 + 92,
          maxWidth: '100%',
          background: `radial-gradient(ellipse 92% 88% at 50% 48%, ${C.obsidian}f5 0%, ${C.obsidian}c8 42%, ${C.obsidian}60 64%, transparent 84%), radial-gradient(ellipse 74% 74% at 50% 48%, ${accent}22 0%, transparent 72%)`,
        }}
      >
        {/* the arrangement -- five blooms of varying size/tilt, weighted
            toward the top corners like a garland laid over the plate,
            with a smaller pair anchoring the bottom edge. Wrapped in its
            own parallax layer: as the nearest thing to the viewer (they
            physically overhang the frame's edge), they carry the largest
            share of the tilt response -- real parallax reads foreground
            objects as moving MORE than background ones for the same head
            movement, so making them the most mobile layer is what sells
            the depth rather than just decorating it. */}
        <div style={{
          position: 'absolute',
          inset: 0,
          transform: `translate3d(${tilt.x * -22}px, ${tilt.y * -16}px, 0)`,
          transition: 'transform 0.35s cubic-bezier(0.16,1,0.3,1)',
          pointerEvents: 'none',
        }}>
          {/* AI-generated floral garland (public/card-flowers/,
              scripts/generate-marker-frame-flowers.mjs) -- additive to the
              hand-drawn Flower blooms below, not a replacement. Sits
              behind them (lower zIndex) so the sharper procedural blooms
              stay the foreground focal points and this reads as an
              atmospheric enrichment draped along the top edge. Rendered
              on pure black by the generator and screen-blended here, the
              same compositing technique this file already uses for its
              grain-texture layer -- no alpha channel needed from the
              model. See docs/shareable-card-visual-system.md: marker-only,
              cached, human-reviewed before shipping (all five reviewed
              2026-08-21). */}
          <img
            src={flowerFrameSrc}
            alt=""
            style={{
              position: 'absolute',
              top: -34,
              left: '50%',
              transform: 'translateX(-50%)',
              width: '92%',
              maxWidth: 520,
              mixBlendMode: 'screen',
              opacity: 0.82,
              zIndex: 1,
              pointerEvents: 'none',
            }}
          />
          <Flower uid="fl-tl" accent={accent} size={128} rotate={-18} tiltX={22} tiltY={-16} petals={6}
            style={{ top: -30, left: -26, zIndex: 2 }} />
          <Flower uid="fl-tl2" accent={accent} size={78} rotate={40} tiltX={16} tiltY={10} petals={5}
            style={{ top: 6, left: 30, zIndex: 2 }} />
          <Flower uid="fl-tr" accent={accent} size={116} rotate={22} tiltX={18} tiltY={16} petals={6}
            style={{ top: -26, right: -24, zIndex: 2 }} />
          <Flower uid="fl-tr2" accent={accent} size={64} rotate={-30} tiltX={14} tiltY={-8} petals={5}
            style={{ top: 14, right: 34, zIndex: 2 }} />
          <Flower uid="fl-bl" accent={accent} size={92} rotate={12} tiltX={20} tiltY={-10} petals={5}
            style={{ bottom: -22, left: -18, zIndex: 2 }} />
          <Flower uid="fl-br" accent={accent} size={98} rotate={-14} tiltX={18} tiltY={14} petals={6}
            style={{ bottom: -26, right: -20, zIndex: 2 }} />
        </div>

      {/* ── THE CARD ─────────────────────────────────────────────── */}
      <div
        ref={plateRef}
        style={{
          position: 'relative',
          zIndex: 1,
          width: 480,
          maxWidth: '100%',
          minHeight: 596,
          background: C.obsidian,
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
          overflow: 'hidden',
          animation: 'elderCardIn 0.9s cubic-bezier(0.16,1,0.3,1) both',
        }}
      >
        {/* landscape plate -- one authored image per marker archetype,
            three compositional variants each (public/card-landscapes/,
            generated by scripts/generate-marker-landscapes.mjs), never
            per voice/tradition: see the "AI-generated imagery, revisited"
            section of docs/shareable-card-visual-system.md for why this
            stays scoped to mood/archetype rather than any
            culturally-specific imagery. Which variant shows is a
            deterministic hash of the quote line itself (cardConfig.ts,
            landscapeFor()), not of marker/voice, so re-opening the same
            card always shows the same picture.

            Three nested layers, each owning ONE transform so they never
            fight each other (a CSS animation with fill-mode:both holds
            its final keyframe's transform indefinitely -- putting a
            second, React-driven transform on the same element would be
            silently overridden the instant the animation "holds"):
              outer  (key={landscapeSrc}) -- the threshold-crossing entrance
                     itself. Re-keyed on every marker change so switching
                     markers reads as diving forward through a new
                     threshold, not a flat crossfade: starts scaled up and
                     blurred (as if still mid-step through the doorway),
                     resolves to sharp -- the same forward-motion language
                     as the app's own crossing/threshold framing, made
                     literal in the one place seekers actually see the
                     landscape arrive.
              middle -- parallax only. Plain inline transform driven by
                     `tilt` (mouse position on desktop, device tilt on
                     mobile) -- background layer, so it moves the least of
                     the three parallax-bearing groups (compare the
                     flowers' -22/-16 multipliers above: nearer things move
                     more for the same head movement).
              inner  (<img>) -- the pre-existing slow continuous Ken Burns
                     drift, unchanged. */}
        <div
          key={landscapeSrc}
          style={{
            position: 'absolute',
            inset: 0,
            overflow: 'hidden',
            animation: 'elderLandscapeIn 1.9s cubic-bezier(0.16,1,0.3,1) both',
          }}
        >
          <div style={{
            position: 'absolute',
            inset: -20,
            transform: `translate3d(${tilt.x * 9}px, ${tilt.y * 7}px, 0)`,
            transition: 'transform 0.5s cubic-bezier(0.16,1,0.3,1)',
          }}>
            <img
              src={landscapeSrc}
              alt=""
              style={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                opacity: 0.88,
                filter: 'saturate(1.18) contrast(1.1) brightness(1.03)',
                animation: 'elderLandscapeDrift 30s ease-in-out infinite alternate',
              }}
            />
          </div>
        </div>
        {/* enchantment glow -- a slow, breathing bloom of warm light behind
            the landscape, as if the scene itself is lit from within rather
            than just photographed under it. Screen-blended so it only ever
            brightens, never muddies the image beneath; the hue drifts
            gently between gold and a cooler ember at the edges rather than
            staying one flat tone, which is what reads as "alive" instead
            of "lit." Sits above the raw landscape but below the
            legibility-darkening wash below it, so the glow itself gets the
            same edge-taper toward the text as everything else on the
            plate -- additive to the existing vignette/grain/motes system,
            not a replacement for any of it. */}
        <div style={{
          position: 'absolute',
          inset: 0,
          mixBlendMode: 'screen',
          background: `radial-gradient(ellipse 68% 52% at 50% 40%, ${accent}38 0%, rgba(180,140,60,0.14) 38%, transparent 68%)`,
          animation: 'elderEnchantBreathe 7s ease-in-out infinite',
          pointerEvents: 'none',
        }} />
        {/* darkening wash over the landscape -- keeps the glyph/text as
            the clear focal point regardless of which image sits behind
            them. Two layers: a broad edge vignette so the picture still
            reads at the frame's border, and a tighter pool of dark behind
            the text block specifically, so legibility doesn't cost the
            whole image its visibility the way one flat gradient did. */}
        <div style={{
          position: 'absolute',
          inset: 0,
          background: `radial-gradient(ellipse at 50% 38%, ${accent}14 0%, transparent 55%), linear-gradient(180deg, rgba(6,5,4,0.22) 0%, rgba(6,5,4,0.3) 30%, rgba(6,5,4,0.46) 62%, ${C.obsidian}d8 88%, ${C.obsidian} 100%)`,
        }} />
        <div style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(ellipse 62% 46% at 50% 54%, rgba(6,5,4,0.62) 0%, transparent 72%)',
        }} />

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

        {/* the cherry: this sheen used to be a fixed foil-catch, justified
            at the time as "not a moving highlight, the card is a still
            image once exported" -- true of the export, but the on-screen
            card now has real depth cues everywhere else (parallax on the
            landscape and flowers above), so a light streak that never
            reacts to the same tilt was the one thing still lying about
            being glass. Tied to the same `tilt` state: the angle and
            position genuinely shift as if catching light off a curved
            surface, exactly the way the flowers/landscape parallax
            already implies this card has a front and a depth. A PNG
            export still freezes whatever angle the light happened to be
            at, same as every other tilt-driven layer -- consistent with
            them now, not an exception to them. */}
        <div style={{
          position: 'absolute',
          inset: 0,
          background: `linear-gradient(${115 + tilt.x * 30}deg, transparent ${28 + tilt.y * 6}%, rgba(255,255,255,${0.035 + Math.abs(tilt.x) * 0.02}) 48%, transparent ${62 - tilt.y * 6}%)`,
          transition: 'background 0.5s cubic-bezier(0.16,1,0.3,1)',
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

        {/* incense smoke -- three staggered wisps rising from the base of
            the plate, each on its own loop and delay so they never move in
            lockstep. Drift shape (rise / spiral / disperse) is chosen by
            marker just above (smokeAnim); see that comment for why this
            exists instead of an actual scent. */}
        {[0, 1, 2].map(i => (
          <svg
            key={i}
            viewBox="0 0 20 60"
            width={26}
            height={78}
            style={{
              position: 'absolute',
              bottom: 6,
              left: `${44 + i * 6}%`,
              transform: 'translate(-50%,0)',
              pointerEvents: 'none',
              mixBlendMode: 'screen',
              animation: `${smokeAnim} ${9 + i * 2.4}s ease-out ${i * 3.1}s infinite`,
            }}
          >
            <path
              d="M10 58 C 4 46, 15 40, 9 30 C 3 20, 14 14, 8 2"
              stroke={C.ash}
              strokeWidth="2.2"
              strokeLinecap="round"
              fill="none"
              opacity="0.5"
            />
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
        {/* the cherry on top: a single silent flare that blooms once behind
            the glyph as the card arrives, like the instant a reading is
            struck true. Timed to land just after elderCardIn settles
            (0.6s delay) so it reads as a beat, not simultaneous noise;
            runs once (no infinite) so it never competes with the glyph's
            own steady pulse for attention. */}
        <div style={{
          position: 'absolute',
          top: '20%',
          left: '50%',
          width: 64,
          height: 64,
          borderRadius: '50%',
          background: `radial-gradient(circle, #fff6df 0%, ${accent}cc 32%, ${accent}00 72%)`,
          pointerEvents: 'none',
          opacity: 0,
          animation: 'elderGlyphBurst 2.2s cubic-bezier(0.16,1,0.3,1) 0.6s 1 both',
        }} />

        {/* foreground content -- lifted into its own stacking context so it
            paints above the positioned decorative layers above (positioned
            elements always paint after static ones, regardless of DOM order).
            The marker glyph below is the card's entire "art" -- deliberately
            not an AI-generated image (see the DECISION note in cardConfig.ts). */}
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

          {/* lineage attribution -- D11: names which voice spoke, not just
              the instrument. Sits between the divider and the THE ELDER
              wordmark so the reading order is quote -> who spoke it ->
              what spoke it, a clearer credit hierarchy than burying the
              voice inside the wordmark line. Deliberately its own row
              with breathing room above and below rather than crowded onto
              the wordmark's line -- a name needs its own margin to read as
              a credit rather than a subtitle. */}
          <div style={{
            fontFamily: "'Gentium Plus', Georgia, serif",
            fontStyle: 'italic',
            fontSize: '0.78rem',
            letterSpacing: '0.04em',
            color: C.bone,
            opacity: 0.78,
            marginTop: 18,
          }}>
            spoken by the {attributionForVoice(voiceKey)}
          </div>

          {/* D10: the seeker's seal -- a deterministic, non-representational
              constellation derived from this reading's own marker + quote
              (lib/mythopoetics/seal.ts). Same reading, same seal, always;
              no model call, no figurative imagery. A quiet companion mark
              beneath the attribution line, not a competing focal point. */}
          <div style={{ marginTop: 10 }}>
            <SeekerSeal marker={marker} line={line} accent={accent} size={40} />
          </div>

          <div style={{
            fontFamily: "'Inter', Arial, sans-serif",
            fontSize: '0.5rem',
            letterSpacing: '0.32em',
            textTransform: 'uppercase',
            marginTop: 14,
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
      </div>

      {/* ── MARKER PICKER (not part of the rasterized card) ─────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 26 }}>
        {(Object.keys(MARKER_GLYPHS) as MarkerType[]).map(m => (
          <SigilButton
            key={m}
            active={m === marker}
            accent={accent}
            onClick={() => onMarkerChange(m)}
            title={MARKER_LABELS[m]}
          >
            {MARKER_GLYPHS[m]}
          </SigilButton>
        ))}

        <div style={{ width: 1, height: 22, background: 'rgba(212,168,67,0.25)', margin: '0 6px' }} />

        {/* audio toggle -- muted by default (browser autoplay policy blocks
            unmuted sound before a user gesture anyway, and a card that
            announces itself with sound the seeker didn't ask for is the
            wrong first impression regardless of policy). Same synthesized
            ambient bed either way; this only starts/stops it. */}
        <SigilButton
          active={audioOn}
          accent={accent}
          onClick={toggleAudio}
          title={audioOn ? 'Mute the ambient sound' : 'Let the fire speak'}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M4 9v6h4l5 5V4L8 9H4z" />
            {audioOn ? (
              <path d="M17.5 8.5a5 5 0 0 1 0 7" />
            ) : (
              <path d="M17 9l4 4M21 9l-4 4" />
            )}
          </svg>
        </SigilButton>
      </div>

      {/* ── NAME SOMEONE THIS IS FOR (not part of the rasterized card) ──
          framed like a small sealed tablet -- the same L-bracket + dashed
          arc corner motif the card itself uses, at a smaller scale, so the
          one text field in this UI reads as a ritual inscription rather
          than a form field. */}
      <div style={{ marginTop: 28, width: 280, maxWidth: '100%', textAlign: 'center', position: 'relative', padding: '4px 10px' }}>
        {[
          { top: -2, left: -2, rot: 0 },
          { top: -2, right: -2, rot: 90 },
          { bottom: -2, right: -2, rot: 180 },
          { bottom: -2, left: -2, rot: 270 },
        ].map((pos, i) => (
          <svg key={i} viewBox="0 0 32 32" width="14" height="14" style={{ position: 'absolute', ...pos, transform: `rotate(${pos.rot}deg)`, opacity: 0.55, pointerEvents: 'none' }}>
            <path d="M2 14 L2 2 L14 2" stroke={accent} strokeWidth="1" fill="none" />
          </svg>
        ))}
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
            border: 'none',
            borderBottom: `1px solid rgba(212,168,67,0.3)`,
            color: C.bone,
            fontFamily: "'Gentium Plus', Georgia, serif",
            fontStyle: 'italic',
            fontSize: '0.95rem',
            letterSpacing: '0.015em',
            lineHeight: 1.5,
            padding: '10px 14px 12px',
            textAlign: 'center',
            borderRadius: 0,
          }}
        />
      </div>

      {/* ── ACTIONS ──────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 30 }}>
        <div style={{ position: 'relative' }}>
          {!busy && (
            <div style={{
              position: 'absolute',
              inset: -6,
              borderRadius: 5,
              background: `radial-gradient(ellipse, ${accent}30 0%, transparent 75%)`,
              animation: 'elderGlyphPulse 5.5s ease-in-out infinite',
              pointerEvents: 'none',
            }} />
          )}
          <button
            onClick={handleShare}
            disabled={busy}
            style={{
              position: 'relative',
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
        </div>
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
            fontFamily: "'Gentium Plus', Georgia, serif",
            fontStyle: 'italic',
            fontSize: '0.72rem',
            letterSpacing: '0.08em',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <span style={{ opacity: 0.6 }}>⟵</span> return to the fire
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
