'use client'

// app/components/useLineSelection.ts
//
// Detects a text selection inside a given container ref and exposes
// it, so the seeker can highlight the line that named them and turn
// it into a card — the same interaction as highlighting in a Kindle
// book, not a separate "pick a quote" UI.

import { useEffect, useRef, useState, type RefObject } from 'react'

interface Selection {
  text: string
  // Position for placing a floating "Make this your card" affordance
  // near the highlighted text.
  x: number
  y: number
}

export function useLineSelection(containerRef: RefObject<HTMLElement>) {
  const [selection, setSelection] = useState<Selection | null>(null)

  useEffect(() => {
    function handleUp() {
      const sel = window.getSelection()
      if (!sel || sel.isCollapsed || !containerRef.current) {
        setSelection(null)
        return
      }
      const text = sel.toString().trim()
      if (!text || text.length < 8 || text.length > 280) {
        setSelection(null)
        return
      }
      // Only react to selections that live inside the reading container.
      const anchorNode = sel.anchorNode
      if (!anchorNode || !containerRef.current.contains(anchorNode)) {
        setSelection(null)
        return
      }
      const range = sel.getRangeAt(0)
      const rect = range.getBoundingClientRect()
      setSelection({ text, x: rect.left + rect.width / 2, y: rect.top })
    }

    function handleDown(e: MouseEvent) {
      // Clear once a fresh click starts, so a stale bubble doesn't linger.
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setSelection(null)
      }
    }

    document.addEventListener('mouseup', handleUp)
    document.addEventListener('touchend', handleUp)
    document.addEventListener('mousedown', handleDown)
    return () => {
      document.removeEventListener('mouseup', handleUp)
      document.removeEventListener('touchend', handleUp)
      document.removeEventListener('mousedown', handleDown)
    }
  }, [containerRef])

  return { selection, clearSelection: () => setSelection(null) }
}
