'use client'

import { useState, useEffect } from 'react'

export const C = {
  obsidian: '#0a0806',
  gold:     '#d4a843',
  paleGold: '#e8c97a',
  ember:    '#c8601a',
  bone:     '#ede0c4',
  ash:      '#c4b89a',
  smoke:    '#8a7a6a',
  blood:    '#7a1a1a',
}

export function FadeIn({
  children,
  delay = 0,
}: {
  children: React.ReactNode
  delay?: number
}) {
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), delay)
    return () => clearTimeout(t)
  }, [delay])
  return (
    <div style={{
      opacity: visible ? 1 : 0,
      transform: visible ? 'translateY(0)' : 'translateY(10px)',
      transition: 'opacity 1.1s ease, transform 1.1s ease',
    }}>
      {children}
    </div>
  )
}

export function GlyphDivider({ symbol = '⟡', opacity = 0.3, color = C.gold }: { symbol?: string; opacity?: number; color?: string }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 14,
      margin: '28px 0',
      opacity,
    }}>
      <div style={{ flex: 1, height: 1, background: `linear-gradient(90deg,transparent,${color},transparent)` }} />
      <span style={{ color, fontSize: '0.9rem' }}>{symbol}</span>
      <div style={{ flex: 1, height: 1, background: `linear-gradient(90deg,transparent,${color},transparent)` }} />
    </div>
  )
}
