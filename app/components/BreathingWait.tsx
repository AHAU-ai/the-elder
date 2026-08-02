'use client'

// app/components/BreathingWait.tsx
//
// Replaces EmberDots for the loading state. Same visual language
// (obsidian/gold, the existing ElderEye-style sigil glow) but paced
// to the same breath cadence as BreathGate.tsx — reuses the
// sigilBreathe keyframe that already existed in globals.css but was
// never wired to anything. Optional ambient tone follows the
// existing soundEnabled preference; no new toggle introduced.

import { useEffect, useRef, useState } from 'react'
import { C } from './LintelShared'
import { BREATH_PHASES, BREATH_CYCLE_MS } from '../../lib/breathTiming'
import { startBreathTone, stopBreathTone } from '../../lib/ambientBreathTone'

interface Props {
  text: string
  soundEnabled?: boolean
}

export default function BreathingWait({ text, soundEnabled = false }: Props) {
  const [cueLabel, setCueLabel] = useState('')
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([])

  useEffect(() => {
    function clearAll() {
      timersRef.current.forEach(t => clearTimeout(t))
      timersRef.current = []
    }

    function runCycle() {
      let elapsed = 0
      BREATH_PHASES.forEach(phase => {
        const t = setTimeout(() => setCueLabel(phase.label), elapsed)
        timersRef.current.push(t)
        elapsed += phase.duration
      })
    }

    runCycle()
    const interval = setInterval(runCycle, BREATH_CYCLE_MS)

    return () => {
      clearAll()
      clearInterval(interval)
    }
  }, [])

  useEffect(() => {
    if (soundEnabled) {
      startBreathTone()
    }
    return () => stopBreathTone()
  }, [soundEnabled])

  return (
    <div style={{ textAlign: 'center', padding: '38px 0' }}>
      <div
        style={{
          width: 48,
          height: 48,
          margin: '0 auto 20px',
          borderRadius: '50%',
          border: `1px solid ${C.gold}`,
          background: 'radial-gradient(circle, rgba(212,168,67,0.12), transparent 70%)',
          animationName: 'sigilBreathe',
          animationDuration: `${BREATH_CYCLE_MS}ms`,
          animationTimingFunction: 'ease-in-out',
          animationIterationCount: 'infinite',
          boxShadow: `0 0 18px rgba(212,168,67,0.25)`,
        }}
      />
      <div style={{
        fontFamily: "'Inter', Arial, sans-serif",
        fontSize: '0.56rem',
        letterSpacing: '0.34em',
        color: C.smoke,
        textTransform: 'uppercase',
        opacity: cueLabel ? 0.6 : 0,
        transition: 'opacity 0.6s ease',
        marginBottom: 14,
        minHeight: 14,
      }}>
        {cueLabel}
      </div>
      <div style={{ fontStyle: 'italic', color: C.smoke, fontSize: '0.88rem' }}>
        {text}
      </div>
    </div>
  )
}
