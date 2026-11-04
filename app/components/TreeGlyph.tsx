'use client'

// TreeGlyph.tsx
//
// Brainstorm item #1, full pass: the tree stops being something only a
// seeker who already clicks a small nav link ever sees, and becomes
// visible on the myth-choice landing screen itself — the actual "welcome
// back" moment for a signed-in returning seeker (Threshold.tsx). This is
// the compact, chrome-free version of the same real render TreeState.tsx
// draws at /tree: same geometry (lib/mythopoetics/treeGeometry.ts), no
// hover-for-detail panel, no page frame — just the glyph, sized down,
// meant to sit inside another screen rather than be one.
//
// Scope note (per the "additive, not a replacement" decision): this is
// shown ONLY on the myth-choice screen, which itself only exists for a
// signed-in seeker who already has saved myths — a first-time or
// anonymous seeker's entry flow is completely untouched by this file.
import { buildRoots, buildCanopyRings, type TreeStateMarker } from '../../lib/mythopoetics/treeGeometry'

const C = {
  gold: '#d4a843',
};

export default function TreeGlyph({
  markers,
  chainDepth,
  size = 220,
  accent = C.gold,
}: {
  markers: TreeStateMarker[];
  chainDepth: number;
  size?: number;
  accent?: string;
}) {
  const cx = 160;
  const cy = 176;
  const roots = buildRoots(markers, cx, cy);
  const canopyRings = buildCanopyRings(chainDepth, cx, cy);

  return (
    <svg
      viewBox="0 0 320 320"
      width={size}
      height={size}
      role="img"
      aria-label="Your tree, grown from your returning threads"
      style={{ display: 'block', margin: '0 auto' }}
    >
      <defs>
        <radialGradient id="tgCanopyGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={accent} stopOpacity="0.22" />
          <stop offset="100%" stopColor={accent} stopOpacity="0" />
        </radialGradient>
      </defs>

      <circle cx={cx} cy={cy} r={44 + chainDepth * 30} fill="url(#tgCanopyGlow)" />

      {canopyRings.map((ring, ri) =>
        ring.map((b, bi) => (
          <path
            key={`${ri}-${bi}`}
            d={b.path}
            stroke={accent}
            strokeWidth={Math.max(0.4, 1.1 - b.ring * 0.15)}
            fill="none"
            strokeLinecap="round"
            opacity={0.4}
          />
        )),
      )}

      {/* trunk */}
      <line x1={cx} y1={cy} x2={cx} y2={cy - 36} stroke={accent} strokeWidth="2" strokeLinecap="round" opacity={0.6} />

      {/* roots -- same silence as TreeState.tsx: never a line drawn
          BETWEEN two roots, even for markers known to co-occur. */}
      {roots.map((r) => (
        <g key={r.key}>
          <path d={r.path} stroke={r.floorCrossed ? accent : '#5c5140'} strokeWidth={r.strokeWidth} fill="none" strokeLinecap="round" opacity={r.opacity} />
          <circle cx={r.endpoint.x} cy={r.endpoint.y} r={r.floorCrossed ? 3 : 1.8} fill={r.floorCrossed ? accent : '#5c5140'} opacity={r.opacity} />
        </g>
      ))}
    </svg>
  );
}
