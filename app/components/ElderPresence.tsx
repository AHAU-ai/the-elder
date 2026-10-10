'use client'

// app/components/ElderPresence.tsx
//
// The Elder's presence, felt in energy and not in form (see lib/elderAttention.ts).
// One provider at the root writes a single CSS variable, --elder-stillness, to
// <html>. Nothing is drawn: no figure, no glow, no new sound. The room simply
// grows stiller when the Elder attends, and anything decorative can read the
// variable. Omnipresent: it is mounted for every route and never reaches zero.
//
// Moments claim attention with useElderPhase(); the deepest active claim wins.
// Kill switch: NEXT_PUBLIC_ELDER_PRESENCE=0 turns the whole layer off (the
// hooks become no-ops and the variable is never set, so ambient layers behave
// exactly as before).

import { createContext, useContext, useEffect, useRef } from 'react'
import { createClaimSet, type ElderPhase } from '../../lib/elderAttention'

const ENABLED = process.env.NEXT_PUBLIC_ELDER_PRESENCE !== '0'

type Claim = (phase: ElderPhase) => () => void
const AttentionContext = createContext<Claim | null>(null)

export function ElderPresenceProvider({ children }: { children: React.ReactNode }) {
  const setRef = useRef<ReturnType<typeof createClaimSet> | null>(null)
  if (!setRef.current) {
    setRef.current = createClaimSet((stillness, phase) => {
      if (typeof document === 'undefined') return
      const root = document.documentElement
      root.style.setProperty('--elder-stillness', String(stillness))
      root.dataset.elderPhase = phase
    })
  }
  const claim = useRef<Claim>((phase) => setRef.current!.claim(phase)).current

  useEffect(() => {
    if (!ENABLED) return
    setRef.current!.refresh() // sets the omnipresent baseline on every route
    const root = document.documentElement
    return () => {
      root.style.removeProperty('--elder-stillness')
      delete root.dataset.elderPhase
    }
  }, [])

  return <AttentionContext.Provider value={ENABLED ? claim : null}>{children}</AttentionContext.Provider>
}

/** Claim the Elder's attention for this moment while `active` is true. A no-op when the layer is off. */
export function useElderPhase(phase: ElderPhase, active: boolean = true) {
  const claim = useContext(AttentionContext)
  useEffect(() => {
    if (!claim || !active) return
    return claim(phase)
  }, [claim, phase, active])
}

