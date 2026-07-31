'use client'
import { useEffect, useRef, useState, useCallback } from 'react'

const NAHUAL_GLYPHS: Record<string, React.FC<{ color: string }>> = {
  Imox:   ({ color }) => <svg viewBox="0 0 60 60" width="80" height="80"><path d="M30 5 Q55 30 30 55 Q5 30 30 5Z" stroke={color} strokeWidth="1.2" fill="none" opacity="0.9"/><circle cx="30" cy="30" r="6" fill={color} opacity="0.85"/><path d="M30 5 L30 24 M30 36 L30 55 M5 30 L24 30 M36 30 L55 30" stroke={color} strokeWidth="0.6" opacity="0.45"/></svg>,
  Iq:     ({ color }) => <svg viewBox="0 0 60 60" width="80" height="80"><path d="M30 8 L52 48 L8 48 Z" stroke={color} strokeWidth="1.2" fill="none" opacity="0.9"/><path d="M30 18 L44 42 L16 42 Z" stroke={color} strokeWidth="0.5" fill="none" opacity="0.35"/><circle cx="30" cy="34" r="3.5" fill={color} opacity="0.8"/></svg>,
  Aqabal: ({ color }) => <svg viewBox="0 0 60 60" width="80" height="80"><rect x="14" y="14" width="32" height="32" stroke={color} strokeWidth="1.2" fill="none" opacity="0.9"/><rect x="22" y="22" width="16" height="16" stroke={color} strokeWidth="0.5" fill="none" opacity="0.4"/><circle cx="30" cy="30" r="4" fill={color} opacity="0.85"/></svg>,
  Kat:    ({ color }) => <svg viewBox="0 0 60 60" width="80" height="80"><path d="M30 8 L52 30 L30 52 L8 30 Z" stroke={color} strokeWidth="1.2" fill="none" opacity="0.9"/><path d="M8 30 L52 30 M30 8 L30 52" stroke={color} strokeWidth="0.6" opacity="0.4"/><circle cx="30" cy="30" r="5" fill={color} opacity="0.85"/></svg>,
  Kan:    ({ color }) => <svg viewBox="0 0 60 60" width="80" height="80"><path d="M30 6 C48 6 54 22 54 30 C54 46 44 54 30 54 C16 54 6 46 6 30 C6 14 12 6 30 6Z" stroke={color} strokeWidth="1.2" fill="none" opacity="0.9"/><circle cx="30" cy="30" r="4.5" fill={color} opacity="0.85"/></svg>,
  Keme:   ({ color }) => <svg viewBox="0 0 60 60" width="80" height="80"><path d="M10 50 L30 10 L50 50" stroke={color} strokeWidth="1.2" fill="none" opacity="0.9"/><path d="M18 36 L42 36" stroke={color} strokeWidth="1" opacity="0.7"/></svg>,
  Kej:    ({ color }) => <svg viewBox="0 0 60 60" width="80" height="80"><circle cx="30" cy="30" r="22" stroke={color} strokeWidth="1.2" fill="none" opacity="0.9"/><path d="M30 8 L30 52 M8 30 L52 30 M14 14 L46 46 M46 14 L14 46" stroke={color} strokeWidth="0.5" opacity="0.38"/><circle cx="30" cy="30" r="4" fill={color} opacity="0.85"/></svg>,
  Qanil:  ({ color }) => <svg viewBox="0 0 60 60" width="80" height="80"><path d="M30 6 L54 30 L30 54 L6 30 Z" stroke={color} strokeWidth="1.2" fill="none" opacity="0.9"/><circle cx="30" cy="30" r="10" stroke={color} strokeWidth="0.6" fill="none" opacity="0.4"/><circle cx="30" cy="30" r="4" fill={color} opacity="0.85"/></svg>,
  Toj:    ({ color }) => <svg viewBox="0 0 60 60" width="80" height="80"><path d="M30 8 L30 52 M8 30 L52 30" stroke={color} strokeWidth="1.4" opacity="0.9"/><circle cx="30" cy="30" r="14" stroke={color} strokeWidth="0.8" fill="none" opacity="0.5"/><circle cx="30" cy="30" r="5" fill={color} opacity="0.85"/></svg>,
  Tzi:    ({ color }) => <svg viewBox="0 0 60 60" width="80" height="80"><path d="M15 15 L45 15 L45 45 L15 45 Z" stroke={color} strokeWidth="1.2" fill="none" opacity="0.9"/><path d="M15 30 L45 30 M30 15 L30 45" stroke={color} strokeWidth="0.5" opacity="0.35"/><circle cx="30" cy="30" r="5" fill={color} opacity="0.85"/></svg>,
  Batz:   ({ color }) => <svg viewBox="0 0 60 60" width="80" height="80"><path d="M30 8 C44 8 52 18 52 30 C52 44 42 52 30 52 C18 52 8 44 8 30 C8 16 18 8 30 8Z" stroke={color} strokeWidth="1.2" fill="none" opacity="0.9"/><path d="M22 30 C22 22 38 22 38 30 C38 38 22 38 22 30Z" stroke={color} strokeWidth="0.6" fill="none" opacity="0.4"/></svg>,
  Ee:     ({ color }) => <svg viewBox="0 0 60 60" width="80" height="80"><path d="M10 30 L30 10 L50 30 L30 50 Z" stroke={color} strokeWidth="1.2" fill="none" opacity="0.9"/><circle cx="30" cy="30" r="6" stroke={color} strokeWidth="0.7" fill="none" opacity="0.5"/></svg>,
  Aj:     ({ color }) => <svg viewBox="0 0 60 60" width="80" height="80"><path d="M30 6 L30 54 M18 18 L30 6 L42 18 M18 42 L30 54 L42 42" stroke={color} strokeWidth="1.2" fill="none" opacity="0.9"/><circle cx="30" cy="30" r="5" fill={color} opacity="0.85"/></svg>,
  Ix:     ({ color }) => <svg viewBox="0 0 60 60" width="80" height="80"><path d="M10 50 L30 10 L50 50 Z" stroke={color} strokeWidth="1.2" fill="none" opacity="0.9"/><circle cx="30" cy="30" r="7" stroke={color} strokeWidth="0.7" fill="none" opacity="0.45"/><circle cx="30" cy="32" r="3.5" fill={color} opacity="0.85"/></svg>,
  Tzikin: ({ color }) => <svg viewBox="0 0 60 60" width="80" height="80"><path d="M30 10 C40 20 52 24 52 30 C52 40 40 48 30 50 C20 48 8 40 8 30 C8 24 20 20 30 10Z" stroke={color} strokeWidth="1.2" fill="none" opacity="0.9"/><path d="M30 20 L30 50 M16 30 L44 30" stroke={color} strokeWidth="0.5" opacity="0.3"/></svg>,
  Ajmaq:  ({ color }) => <svg viewBox="0 0 60 60" width="80" height="80"><circle cx="30" cy="30" r="22" stroke={color} strokeWidth="1.2" fill="none" opacity="0.9"/><circle cx="30" cy="30" r="12" stroke={color} strokeWidth="0.6" fill="none" opacity="0.45"/><circle cx="30" cy="30" r="5" fill={color} opacity="0.85"/><path d="M30 8 L30 18 M30 42 L30 52 M8 30 L18 30 M42 30 L52 30" stroke={color} strokeWidth="0.6" opacity="0.4"/></svg>,
  Noj:    ({ color }) => <svg viewBox="0 0 60 60" width="80" height="80"><path d="M8 30 C8 16 16 8 30 8 C44 8 52 16 52 30 C52 44 44 52 30 52" stroke={color} strokeWidth="1.2" fill="none" opacity="0.9" strokeLinecap="round"/><path d="M30 52 C16 52 8 44 8 30" stroke={color} strokeWidth="0.5" fill="none" opacity="0.35" strokeDasharray="3 4"/><circle cx="30" cy="30" r="5" fill={color} opacity="0.85"/></svg>,
  Tijax:  ({ color }) => <svg viewBox="0 0 60 60" width="80" height="80"><path d="M30 8 L50 50 L10 50 Z" stroke={color} strokeWidth="1.2" fill="none" opacity="0.9"/><path d="M30 8 L30 50" stroke={color} strokeWidth="0.8" opacity="0.6"/><path d="M20 34 L40 34" stroke={color} strokeWidth="0.5" opacity="0.35"/></svg>,
  Kawoq:  ({ color }) => <svg viewBox="0 0 60 60" width="80" height="80"><path d="M30 8 L52 22 L52 38 L30 52 L8 38 L8 22 Z" stroke={color} strokeWidth="1.2" fill="none" opacity="0.9"/><path d="M30 8 L30 52 M8 22 L52 38 M8 38 L52 22" stroke={color} strokeWidth="0.4" opacity="0.28"/><circle cx="30" cy="30" r="5" fill={color} opacity="0.85"/></svg>,
  Ajpu:   ({ color }) => <svg viewBox="0 0 60 60" width="80" height="80"><circle cx="30" cy="30" r="20" stroke={color} strokeWidth="1.4" fill="none" opacity="0.9"/><path d="M30 10 L30 50 M10 30 L50 30 M16 16 L44 44 M44 16 L16 44" stroke={color} strokeWidth="0.5" opacity="0.38"/><circle cx="30" cy="30" r="5" fill={color} opacity="0.9"/></svg>,
}

const DefaultGlyph = ({ color }: { color: string }) => (
  <svg viewBox="0 0 60 60" width="80" height="80">
    <path d="M4 30 Q30 8 56 30 Q30 52 4 30Z" stroke={color} strokeWidth="1.2" fill="none" opacity="0.9"/>
    <circle cx="30" cy="30" r="9" stroke={color} strokeWidth="0.8" fill="none" opacity="0.5"/>
    <circle cx="30" cy="30" r="4.5" fill={color} opacity="0.88"/>
    <circle cx="30" cy="30" r="2" fill="#050302"/>
  </svg>
)

const INVOCATIONS = [
  'The council gathers in the smoke\u2026',
  'The fire reads what you carry\u2026',
  'The old patterns are rising\u2026',
  'What lives through you is being named\u2026',
  'The myth stirs in the dark\u2026',
]

interface Particle { id: number; xPct: number; yStart: number; size: number; delay: number; dur: number }

interface ThresholdPauseProps {
  nahual?: string
  glyphColor?: string
  onComplete: (response?: string) => void
  durationMs?: number
  // Optional: pass a promise that resolves to the API response text.
  // ThresholdPause will wait for BOTH the timer and the fetch,
  // then call onComplete with the result.
  responsePromise?: Promise<string>
}

export default function ThresholdPause({
  nahual,
  glyphColor = '#d4a843',
  onComplete,
  durationMs = 10000,
  responsePromise,
}: ThresholdPauseProps) {
  const [visible,      setVisible]      = useState(false)
  const [glyphOpacity, setGlyphOpacity] = useState(0)
  const [invocation,   setInvocation]   = useState(INVOCATIONS[0])
  const [particles,    setParticles]    = useState<Particle[]>([])

  // Track both gates: timer elapsed + response ready
  const timerDone    = useRef(false)
  const responseDone = useRef(false)
  const responseText = useRef<string | undefined>(undefined)
  const completed    = useRef(false)

  const tryComplete = useCallback(() => {
    if (completed.current) return
    if (!timerDone.current) return
    if (responsePromise && !responseDone.current) return
    completed.current = true
    setVisible(false)
    setTimeout(() => onComplete(responseText.current), 600)
  }, [onComplete, responsePromise])

  // Generate particles with fixed px coords (not %)
  useEffect(() => {
    setParticles(
      Array.from({ length: 22 }, (_, i) => ({
        id: i,
        xPct: 35 + (Math.random() - 0.5) * 30,   // % of viewport width
        yStart: window.innerHeight,
        size: 1.5 + Math.random() * 2.5,
        delay: Math.random() * 3,
        dur: 2.5 + Math.random() * 3,
      }))
    )
  }, [])

  // Fade in
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 60)
    return () => clearTimeout(t)
  }, [])

  // Glyph coalesces
  useEffect(() => {
    const t = setTimeout(() => setGlyphOpacity(1), 800)
    return () => clearTimeout(t)
  }, [])

  // Cycle invocations
  useEffect(() => {
    let idx = 0
    const iv = setInterval(() => {
      idx = (idx + 1) % INVOCATIONS.length
      setInvocation(INVOCATIONS[idx])
    }, Math.floor(durationMs / INVOCATIONS.length))
    return () => clearInterval(iv)
  }, [durationMs])

  // Timer gate
  useEffect(() => {
    const t = setTimeout(() => {
      timerDone.current = true
      tryComplete()
    }, durationMs)
    return () => clearTimeout(t)
  }, [durationMs, tryComplete])

  // Response gate
  useEffect(() => {
    if (!responsePromise) return
    responsePromise.then((text) => {
      responseText.current = text
      responseDone.current = true
      tryComplete()
    }).catch(() => {
      // Error handled by caller; still unblock
      responseDone.current = true
      tryComplete()
    })
  }, [responsePromise, tryComplete])

  const GlyphComponent = nahual && NAHUAL_GLYPHS[nahual] ? NAHUAL_GLYPHS[nahual] : DefaultGlyph

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9000,
      background: '#0a0806',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      opacity: visible ? 1 : 0,
      transition: 'opacity 0.8s ease',
    }}>
      {/* Dimmed fire */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0, height: '40vh',
        background: 'radial-gradient(ellipse 100% 80% at 50% 110%, rgba(180,60,8,0.35) 0%, rgba(100,30,4,0.18) 50%, transparent 72%)',
        pointerEvents: 'none',
      }} />

      {/* Ember particles — fixed px positions */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }} aria-hidden>
        {particles.map(p => (
          <div
            key={p.id}
            style={{
              position: 'absolute',
              left: `${p.xPct}%`,
              bottom: 0,
              width: p.size,
              height: p.size,
              borderRadius: '50%',
              background: p.id % 3 === 0 ? '#d4a843' : '#c8601a',
              animationName: 'pauseEmber',
              animationDuration: `${p.dur}s`,
              animationDelay: `${p.delay}s`,
              animationTimingFunction: 'ease-out',
              animationIterationCount: 'infinite',
            }}
          />
        ))}
      </div>

      {/* Glyph */}
      <div style={{
        opacity: glyphOpacity,
        transform: glyphOpacity ? 'scale(1) translateY(0)' : 'scale(0.7) translateY(12px)',
        transition: 'opacity 2.8s ease, transform 2.8s cubic-bezier(0.16,1,0.3,1)',
        filter: `drop-shadow(0 0 18px ${glyphColor}55) drop-shadow(0 0 42px ${glyphColor}22)`,
        marginBottom: 32,
      }}>
        <GlyphComponent color={glyphColor} />
        {nahual && (
          <div style={{
            textAlign: 'center',
            fontFamily: "'Inter', Arial, sans-serif",
            fontSize: '0.6rem',
            letterSpacing: '0.38em',
            color: glyphColor,
            opacity: 0.55,
            marginTop: 10,
            textTransform: 'uppercase',
          }}>
            {nahual}
          </div>
        )}
      </div>

      {/* Invocation */}
      <div
        key={invocation}
        style={{
          fontFamily: "'Gentium Plus', Georgia, serif",
          fontStyle: 'italic',
          fontSize: '1rem',
          color: '#c4b89a',
          opacity: 0.72,
          letterSpacing: '0.04em',
          textAlign: 'center',
          maxWidth: 320,
          animation: 'pauseTextFade 2.2s ease forwards',
        }}
      >
        {invocation}
      </div>

      <div style={{
        position: 'absolute', bottom: '18%', left: '50%',
        transform: 'translateX(-50%)',
        width: 'min(280px, 60vw)', height: 1,
        background: `linear-gradient(90deg, transparent, ${glyphColor}33, transparent)`,
      }} />
    </div>
  )
}
