'use client'

// TreeTeaser.tsx
//
// Surfaces the seeker's own tree (/tree, TreeState.tsx — real render of
// marker_trajectory data, migration 009/020) at the one moment it can
// actually change whether someone comes back: right after a reading,
// not buried behind a small nav link only a returning, already-convinced
// seeker would click. Two jobs:
//
//   1. Make the return-loop visible in the first session ("brainstorm
//      item #1") — a first-timer currently leaves with no signal that
//      anything persists. This gives them one.
//   2. Make a genuinely returning visit feel different in the UI itself,
//      not only in the model's prose ("item #2") — trajectoryContext.ts
//      already lets the reading *speak* to a recurring thread, but
//      nothing on screen confirmed it. currentMarker lets this component
//      say so plainly when the marker just offered in THIS reading is
//      one the seeker has already crossed the recurrence floor on.
//
// Signed-in only (tree-state is 401 for anon) — anonymous seekers
// already get SaveMythPrompt right below this in CouncilTabs, which is
// the correct next step for them (you can't grow a tree with nowhere to
// keep it). This component renders nothing for anon rather than
// duplicating that ask.

import { useEffect, useState } from 'react'

const C = {
  gold: '#d4a843',
  paleGold: '#e8c97a',
  bone: '#ede0c4',
  ash: '#c4b89a',
  smoke: '#a8916f',
}

interface TreeStateMarker {
  value: string
  markerType: string
  count: number
  floorCrossed: boolean
}

interface TreeStatePayload {
  markers: TreeStateMarker[]
  chainDepth: number
}

type Fetched =
  | { phase: 'loading' }
  | { phase: 'none' } // anon, disabled, or fetch failed -- render nothing
  | { phase: 'empty' } // signed in, but nothing has crossed the floor yet
  | { phase: 'grown'; data: TreeStatePayload }

export default function TreeTeaser({
  accent = C.gold,
  currentMarker = null,
}: {
  accent?: string
  /** The marker just offered/confirmed in the reading this teaser follows,
   *  if any -- used only to check whether it's already a recognized
   *  recurring thread, never to name a value the seeker didn't just see. */
  currentMarker?: string | null
}) {
  const [state, setState] = useState<Fetched>({ phase: 'loading' })

  useEffect(() => {
    let cancelled = false
    fetch('/api/user/tree-state')
      .then(async (r) => {
        if (r.status === 401) return { anon: true } as const
        return (await r.json()) as { enabled?: boolean; treeState?: TreeStatePayload }
      })
      .then((d) => {
        if (cancelled) return
        if ('anon' in d) { setState({ phase: 'none' }); return }
        if (d.enabled && d.treeState) {
          if (d.treeState.markers.length > 0) setState({ phase: 'grown', data: d.treeState })
          else setState({ phase: 'empty' })
        } else {
          setState({ phase: 'none' })
        }
      })
      .catch(() => { if (!cancelled) setState({ phase: 'none' }) })
    return () => { cancelled = true }
  }, [])

  if (state.phase === 'loading' || state.phase === 'none') return null

  if (state.phase === 'empty') {
    return (
      <div style={{ textAlign: 'center', marginTop: 20, fontStyle: 'italic', color: C.smoke, fontSize: '0.78rem', lineHeight: 1.75, opacity: 0.85 }}>
        This is the first root of something that grows if you return.{' '}
        <a href="/tree" style={{ color: accent, textDecoration: 'underline', opacity: 0.9 }}>
          What it becomes is yours to find out.
        </a>
      </div>
    )
  }

  const { markers, chainDepth } = state.data
  const rootCount = markers.filter((m) => m.floorCrossed).length
  const matchedRecurring = currentMarker
    ? markers.find((m) => m.markerType === currentMarker && m.floorCrossed)
    : null

  return (
    <div style={{ textAlign: 'center', marginTop: 20 }}>
      {matchedRecurring && (
        <div style={{
          display: 'inline-block', fontStyle: 'italic', color: C.paleGold, fontSize: '0.82rem',
          lineHeight: 1.7, marginBottom: 8, padding: '6px 14px', border: `1px solid ${accent}33`,
        }}>
          You have stood here before — this thread has returned {matchedRecurring.count} times now.
        </div>
      )}
      <div style={{ fontStyle: 'italic', color: C.smoke, fontSize: '0.78rem', lineHeight: 1.75, opacity: 0.85 }}>
        {rootCount > 0
          ? `${rootCount} ${rootCount === 1 ? 'root has' : 'roots have'} taken hold`
          : 'Something is beginning to take root'}
        {chainDepth > 0 ? `, ${chainDepth} ${chainDepth === 1 ? 'reading' : 'readings'} deep in this thread` : ''}
        {' — '}
        <a href="/tree" style={{ color: accent, textDecoration: 'underline', opacity: 0.9 }}>
          see your tree
        </a>
      </div>
    </div>
  )
}
