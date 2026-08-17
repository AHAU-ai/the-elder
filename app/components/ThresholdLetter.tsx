'use client'

// app/components/ThresholdLetter.tsx
//
// The missing third act. The Lintel (separation) and the reading itself
// (liminal threshold) were already well built; this is reaggregation —
// the moment that hands the seeker something specific to carry back into
// ordinary life, instead of ending on a bare "return to the fire" button.
//
// Content is the per-voice ThresholdLetterVars from lib/psychopompLayer.ts
// (volatilization -> return -> gift -> image), already written and
// governance-reviewed for the system prompt, never rendered until now.
//
// Four-beat reveal, silence before each beat, full-chrome — no header,
// no nav, nothing but the four lines and, at the end, a way back.
//
// Renders in-flow, directly beneath OracleResponse's completed reading —
// NOT as a fixed full-viewport overlay. It used to be position:fixed with
// an opaque background, which painted over the entire screen the moment
// showAskAgain flipped true, hiding the reading that had just finished
// revealing (still in the DOM underneath, just visually gone). The reading
// should stay visible; this is its continuation, not a takeover of it.

import { useEffect, useState } from 'react'
import { C, GlyphDivider } from './LintelShared'
import { getThresholdLetterContent } from '../../lib/mythopoetics/thresholdLetter'
import type { VoiceKey } from '../../src/resilience/flags'
import { playClosingExhaleTone } from '../../lib/ambientBreathTone'

interface Props {
  voiceKey: VoiceKey
  onComplete: () => void
  onKeepAsCard?: (line: string) => void
  soundEnabled?: boolean
}

const BEAT_DELAY_MS = 3400 // silence before each line — unhurried, not the fast oracle-line cadence
const RING_SETTLE_MS = 4000 // must match the ring's own transition duration below

export default function ThresholdLetter({ voiceKey, onComplete, onKeepAsCard, soundEnabled = false }: Props) {
  const content = getThresholdLetterContent(voiceKey)
  const [beat, setBeat] = useState(0) // 0..4: how many lines are visible
  const [showContinue, setShowContinue] = useState(false)
  const [exhaled, setExhaled] = useState(false) // one slow breath-out, symmetric to BreathGate's entry inhale

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = []
    for (let i = 1; i <= 4; i++) {
      timers.push(setTimeout(() => setBeat(i), i * BEAT_DELAY_MS))
    }
    timers.push(setTimeout(() => setShowContinue(true), 4 * BEAT_DELAY_MS + 1400))
    timers.push(setTimeout(() => {
      setExhaled(true)
      if (soundEnabled) playClosingExhaleTone(RING_SETTLE_MS)
    }, 4 * BEAT_DELAY_MS + 1800))
    return () => timers.forEach(clearTimeout)
  }, [soundEnabled])

  return (
    <div style={{
      position: 'relative',
      width: '100%',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '48px 28px 0',
      // No header, no nav, nothing else — the point is the absence of chrome.
      // (No fixed/inset/background/zIndex here anymore -- see file header.)
    }}>
      <div style={{ maxWidth: 520, width: '100%', textAlign: 'center' }}>
        <div style={{
          fontFamily: "'Inter', Arial, sans-serif",
          fontSize: '0.56rem',
          letterSpacing: '0.4em',
          color: C.smoke,
          textTransform: 'uppercase',
          opacity: beat > 0 ? 0.55 : 0,
          transition: 'opacity 1.4s ease',
          marginBottom: 36,
        }}>
          The Threshold Letter
        </div>

        <Line visible={beat >= 1} text={content.volatilizationPhrase} style={{ color: C.ash, fontSize: '0.98rem' }} />
        <Line visible={beat >= 2} text={content.returnPhrase} style={{ color: C.bone, fontSize: '1.02rem' }} />

        {beat >= 3 && <GlyphDivider symbol="⟡" opacity={0.35} />}

        <Line
          visible={beat >= 3}
          text={content.returnGift}
          style={{ color: C.paleGold, fontSize: '1.2rem', fontWeight: 400, margin: '8px 0 28px' }}
        />

        <Line visible={beat >= 4} text={content.thresholdImage} style={{ color: C.smoke, fontSize: '0.85rem', fontStyle: 'italic', opacity: 0.75 }} />

        {showContinue && (
          <div
            aria-hidden
            style={{
              width: 44,
              height: 44,
              margin: '32px auto 0',
              borderRadius: '50%',
              border: `1px solid ${C.gold}`,
              boxShadow: `0 0 16px rgba(212,168,67,0.3)`,
              transform: exhaled ? 'scale(1)' : 'scale(1.5)',
              opacity: exhaled ? 0.35 : 0.85,
              transition: 'transform 4s ease-in-out, opacity 4s ease-in-out',
            }}
          />
        )}

        <div style={{ marginTop: 24, minHeight: 90, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
          {showContinue && onKeepAsCard && (
            <button
              onClick={() => onKeepAsCard(content.returnGift)}
              style={{
                background: 'transparent',
                border: `1px solid rgba(212,168,67,0.4)`,
                color: C.gold,
                fontFamily: "'Gentium Plus', Georgia, serif",
                fontSize: '0.66rem',
                letterSpacing: '0.2em',
                padding: '11px 26px',
                cursor: 'pointer',
                textTransform: 'uppercase',
                opacity: 0,
                animation: 'fadeInDelayed 1.2s ease-in forwards',
              }}
            >
              Keep This Gift
            </button>
          )}
          {showContinue && (
            <button
              onClick={onComplete}
              style={{
                background: 'transparent',
                border: 'none',
                color: C.smoke,
                fontFamily: "'Gentium Plus', Georgia, serif",
                fontStyle: 'italic',
                fontSize: '0.78rem',
                letterSpacing: '0.1em',
                cursor: 'pointer',
                padding: '8px 0',
                opacity: 0,
                animation: 'fadeInDelayed 1.2s ease-in forwards',
                animationDelay: '0.4s',
              }}
            >
              return to the fire
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function Line({ visible, text, style }: { visible: boolean; text: string; style: React.CSSProperties }) {
  return (
    <div
      style={{
        ...style,
        fontFamily: "'Gentium Plus', Georgia, serif",
        lineHeight: 1.85,
        marginBottom: 18,
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(8px)',
        transition: 'opacity 1.6s ease, transform 1.6s ease',
      }}
    >
      {text}
    </div>
  )
}
