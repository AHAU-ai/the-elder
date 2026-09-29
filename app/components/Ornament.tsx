// app/components/Ornament.tsx
//
// Decorative flourishes drawn from the Elder's own sigil (diamond frame,
// almond eye, four cardinal points) so the ornament reads as part of the
// mark rather than as generic filigree. Purely presentational: every piece
// is aria-hidden, pointer-events none, and adds no content.
//
// Motion: the only animation is a slow glow on the diamond, timed to the
// same BREATH_CYCLE_MS the fire, the loading wait and the ceremony use
// (lib/breathTiming.ts), so nothing here introduces a second rhythm. It is
// switched off entirely under prefers-reduced-motion (see globals.css,
// "Ornament" block).

import type { CSSProperties } from 'react';
import { BREATH_CYCLE_MS } from '../../lib/breathTiming';

const GOLD = '#c8a84a';

const breathVars = { ['--elder-breath-ms' as string]: `${BREATH_CYCLE_MS}ms` } as CSSProperties;

/**
 * A hairline rule that fades in from both ends toward a small
 * diamond-and-eye at its centre. `size` scales the whole piece.
 */
export function OrnamentDivider({
  width = 260,
  eye = true,
  rise = false,
  style,
}: {
  width?: number;
  /** Draw the tiny almond eye inside the centre diamond. */
  eye?: boolean;
  /** Fade in once on mount (skipped under reduced motion). */
  rise?: boolean;
  style?: CSSProperties;
}) {
  const height = (width * 28) / 260;
  return (
    <svg
      className={`elder-ornament elder-ornament--divider${rise ? ' elder-ornament--rise' : ''}`}
      viewBox="0 0 260 28"
      width={width}
      height={height}
      aria-hidden="true"
      focusable="false"
      style={{ display: 'block', pointerEvents: 'none', ...breathVars, ...style }}
    >
      <defs>
        <linearGradient id="elder-orn-rule-l" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor={GOLD} stopOpacity="0" />
          <stop offset="1" stopColor={GOLD} stopOpacity="0.7" />
        </linearGradient>
        <linearGradient id="elder-orn-rule-r" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor={GOLD} stopOpacity="0.7" />
          <stop offset="1" stopColor={GOLD} stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* hairlines */}
      <rect x="6" y="13.5" width="100" height="1" fill="url(#elder-orn-rule-l)" />
      <rect x="154" y="13.5" width="100" height="1" fill="url(#elder-orn-rule-r)" />

      {/* small lozenge terminals stepping in toward the centre */}
      <polygon points="112,14 115,11 118,14 115,17" fill={GOLD} opacity="0.55" />
      <polygon points="142,14 145,11 148,14 145,17" fill={GOLD} opacity="0.55" />
      <circle cx="98" cy="14" r="1.1" fill={GOLD} opacity="0.5" />
      <circle cx="162" cy="14" r="1.1" fill={GOLD} opacity="0.5" />

      {/* centre: the sigil in miniature */}
      <g className="elder-ornament__glow">
        <polygon
          points="130,2 144,14 130,26 116,14"
          fill="none"
          stroke={GOLD}
          strokeWidth="1"
          strokeLinejoin="round"
          opacity="0.9"
        />
        {eye && (
          <>
            <path
              d="M 121,14 C 125,9.5 135,9.5 139,14 C 135,18.5 125,18.5 121,14 Z"
              fill="none"
              stroke={GOLD}
              strokeWidth="0.9"
              strokeLinejoin="round"
            />
            <circle cx="130" cy="14" r="2.1" fill={GOLD} />
          </>
        )}
        {/* cardinal points, as on the mark */}
        <polygon points="130,0.6 131.4,2 130,3.4 128.6,2" fill={GOLD} />
        <polygon points="130,24.6 131.4,26 130,27.4 128.6,26" fill={GOLD} />
      </g>
    </svg>
  );
}

/**
 * One corner of the ceremonial frame: an L-bracket with a small lozenge at
 * the elbow. Drawn for the top-left; the frame mirrors it into the other
 * three corners with CSS transforms.
 */
function FrameCorner({ className }: { className: string }) {
  return (
    <svg
      className={`elder-frame__corner ${className}`}
      viewBox="0 0 48 48"
      width={48}
      height={48}
      aria-hidden="true"
      focusable="false"
    >
      <path d="M 2,46 L 2,10 Q 2,2 10,2 L 46,2" fill="none" stroke={GOLD} strokeWidth="1" strokeLinecap="round" />
      <path d="M 8,46 L 8,14 Q 8,8 14,8 L 46,8" fill="none" stroke={GOLD} strokeWidth="0.6" strokeLinecap="round" opacity="0.55" />
      <polygon points="13,13 17,17 13,21 9,17" fill={GOLD} opacity="0.85" transform="translate(-3 -3)" />
    </svg>
  );
}

/**
 * A quiet gilded frame around the whole viewport, mounted once in the root
 * layout. It sits above the ambient fire and below every ceremony beat
 * (which paint their own layers over it), so it frames the resting rooms
 * without competing with the fire, the breath or the reading.
 */
export function CeremonyFrame() {
  return (
    <div className="elder-frame" aria-hidden="true" style={breathVars}>
      <div className="elder-frame__rule elder-frame__rule--outer" />
      <div className="elder-frame__rule elder-frame__rule--inner" />
      <FrameCorner className="elder-frame__corner--tl" />
      <FrameCorner className="elder-frame__corner--tr" />
      <FrameCorner className="elder-frame__corner--bl" />
      <FrameCorner className="elder-frame__corner--br" />
    </div>
  );
}
