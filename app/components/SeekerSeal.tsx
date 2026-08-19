'use client'

// app/components/SeekerSeal.tsx
//
// D10 companion component: renders lib/mythopoetics/seal.ts's deterministic
// constellation geometry as inline SVG. No image asset, no model call --
// just points and lines computed from the reading's own marker + quote.
// See seal.ts's header for the non-representational DECISION this follows.

import { generateSeal } from '../../lib/mythopoetics/seal'
import type { MarkerType } from '../../lib/mythopoetics/cardConfig'

export default function SeekerSeal({
  marker,
  line,
  accent,
  size = 46,
}: {
  marker: MarkerType
  line: string
  accent: string
  size?: number
}) {
  const { points, edges } = generateSeal(marker, line)

  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      aria-hidden="true"
      style={{ display: 'block', opacity: 0.8 }}
    >
      {edges.map(([a, b], i) => (
        <line
          key={i}
          x1={points[a].x}
          y1={points[a].y}
          x2={points[b].x}
          y2={points[b].y}
          stroke={accent}
          strokeWidth={0.6}
          opacity={0.5}
        />
      ))}
      {points.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={1.6} fill={accent} opacity={0.85} />
      ))}
    </svg>
  )
}
