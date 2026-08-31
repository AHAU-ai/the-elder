'use client';

// app/components/TreeState.tsx
//
// The seeker's tree — a visual reading of their marker trajectory, drawn
// entirely from /api/user/tree-state (which is itself a second consumer
// of the same data trajectoryContext.ts feeds the prompt layer).
//
// Roots are generated from the data, not hand-placed: buildRoots() takes
// the real marker array and computes angle / length / weight / opacity
// from each thread's count and floorCrossed state. Below-floor threads
// render thin and dim — present, but "not yet real", the same way the
// trajectory system treats an unconfirmed recurrence.
//
// R-1 (docs/axis-2-marker-trajectory.md): cooccurrencePairs arrive in the
// payload but are NEVER drawn as a line between two roots. There is a
// marked spot in buildRoots() where that would be tempting; it is left
// deliberately untouched. Proximity only, never connection.
//
// Converted to the Elder's one-container palette (obsidian / gold /
// ember) per docs/fire-container-decision.md — no per-lineage re-skin.

import type React from 'react';
import { useState, useEffect, useMemo } from 'react';

const C = {
  obsidian: '#0a0806',
  gold:     '#d4a843',
  paleGold: '#e8c97a',
  ember:    '#c8601a',
  bone:     '#ede0c4',
  ash:      '#c4b89a',
  smoke:    '#a8916f',
  dim:      '#5c5140',
};

type DepthStage = 'surface' | 'confronted' | 'integrated';

interface TreeStateMarker {
  value: string;
  markerType: string;
  count: number;
  floorCrossed: boolean;
  firstSeen: string;
  depthStage: DepthStage;
  pendingStage: DepthStage | null;
}

interface TreeStatePayload {
  lineageKey: string;
  markers: TreeStateMarker[];
  cooccurrencePairs: [string, string][];
  chainDepth: number;
  keptLetterCount: number;
}

type Fetched =
  | { phase: 'loading' }
  | { phase: 'anon' }
  | { phase: 'empty' }
  | { phase: 'tree'; data: TreeStatePayload };

function polarPoint(cx: number, cy: number, angleDeg: number, radius: number) {
  const rad = (angleDeg * Math.PI) / 180;
  return { x: cx + Math.cos(rad) * radius, y: cy + Math.sin(rad) * radius };
}

interface Root extends TreeStateMarker {
  key: string;
  angle: number;
  path: string;
  endpoint: { x: number; y: number };
  strokeWidth: number;
  opacity: number;
}

// Procedurally lays out one root per marker from real trajectory data.
// Floor-crossed markers fan out across the lower arc with a length/weight
// that grows with their appearance count; below-floor markers are
// interleaved but rendered short, thin and dim — "counted, not yet
// surfaced", exactly as the trajectory layer itself treats them.
//
// R-1: `cooccurrencePairs` is available to this function's callers but is
// deliberately NOT read here. A connecting path between two roots would
// go right here, and must not.
function buildRoots(markers: TreeStateMarker[], cx: number, cy: number): Root[] {
  const spread = 130; // degrees of downward arc the fan covers
  const startAngle = 90 - spread / 2;
  const step = spread / Math.max(1, markers.length - 1);
  return markers.map((m, i) => {
    const angle = startAngle + step * i;
    const lengthBase = 70;
    const length = m.floorCrossed ? lengthBase + m.count * 18 : lengthBase * 0.45;
    const end = polarPoint(cx, cy, angle, length);
    const mid = polarPoint(cx, cy, angle + (i % 2 === 0 ? 8 : -8), length * 0.55);
    return {
      ...m,
      key: `${m.markerType}:${m.value}`,
      angle,
      path: `M ${cx} ${cy} Q ${mid.x} ${mid.y} ${end.x} ${end.y}`,
      endpoint: end,
      strokeWidth: m.floorCrossed ? 1.2 + m.count * 0.35 : 0.8,
      opacity: m.floorCrossed ? 0.78 : 0.32,
    };
  });
}

// One canopy ring per reading deep in the current chain — reading N's
// canopy is reading N+1's ground floor (docs axis-3 §4 spatial-deepen
// groundwork, expressed as concentric growth rather than camera movement,
// which is a separate, larger build).
function buildCanopyRings(depth: number, cx: number, cy: number) {
  return [...Array(Math.max(0, depth))].map((_, ring) => {
    const baseRadius = 60 + ring * 55;
    const branchCount = 5 + ring * 2;
    return [...Array(branchCount)].map((_, i) => {
      const angle = 180 + (180 / Math.max(1, branchCount - 1)) * i; // upper arc
      const end = polarPoint(cx, cy, angle, baseRadius);
      const mid = polarPoint(cx, cy, angle + (i % 2 === 0 ? 6 : -6), baseRadius * 0.6);
      return { path: `M ${cx} ${cy} Q ${mid.x} ${mid.y} ${end.x} ${end.y}`, ring };
    });
  });
}

function monthYear(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  try {
    return new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' }).format(d);
  } catch {
    return '';
  }
}

// Same language the prompt layer uses (trajectoryContext.ts STAGE_CLAUSE)
// — never a count, never a claim the seeker hasn't ratified.
const STAGE_NOTE: Record<DepthStage, string> = {
  surface: '',
  confronted: ' · met more than once now in your own words',
  integrated: " · already carried in your own words",
};

export default function TreeState() {
  const [state, setState] = useState<Fetched>({ phase: 'loading' });
  const [hovered, setHovered] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/user/tree-state')
      .then(async (r) => {
        if (r.status === 401) return { anon: true } as const;
        return (await r.json()) as { enabled?: boolean; treeState?: TreeStatePayload };
      })
      .then((d) => {
        if (cancelled) return;
        if ('anon' in d) { setState({ phase: 'anon' }); return; }
        if (d.enabled && d.treeState && d.treeState.markers.length > 0) {
          setState({ phase: 'tree', data: d.treeState });
        } else {
          setState({ phase: 'empty' });
        }
      })
      .catch(() => { if (!cancelled) setState({ phase: 'empty' }); });
    return () => { cancelled = true; };
  }, []);

  const cx = 310;
  const cy = 340;

  const roots = useMemo(
    () => (state.phase === 'tree' ? buildRoots(state.data.markers, cx, cy) : []),
    [state],
  );
  const canopyRings = useMemo(
    () => (state.phase === 'tree' ? buildCanopyRings(state.data.chainDepth, cx, cy) : []),
    [state],
  );

  const hoveredRoot = roots.find((r) => r.key === hovered) ?? null;

  return (
    <div
      style={{
        minHeight: '100vh',
        background: C.obsidian,
        color: C.bone,
        fontFamily: "'Gentium Plus', Georgia, 'Times New Roman', serif",
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '56px 24px 72px',
      }}
    >
      <style>{`
        .ts-root { transition: opacity 0.25s ease, stroke-width 0.25s ease; cursor: pointer; }
        .ts-canopy-ring { animation: tsFadeIn 1s ease forwards; opacity: 0; }
        @keyframes tsFadeIn { to { opacity: 0.4; } }
        .ts-back {
          background: none; border: none; color: ${C.smoke}; cursor: pointer;
          font-family: 'Inter', Arial, sans-serif; font-size: 0.6rem;
          letter-spacing: 0.2em; text-transform: uppercase;
          border-bottom: 1px solid transparent; padding: 4px 0;
        }
        .ts-back:hover, .ts-back:focus-visible { border-bottom-color: ${C.smoke}; outline: none; }
        @media (prefers-reduced-motion: reduce) {
          .ts-canopy-ring { animation: none !important; opacity: 0.4 !important; }
        }
      `}</style>

      <div style={{ maxWidth: 680, width: '100%' }}>
        <a href="/" className="ts-back" style={{ textDecoration: 'none', display: 'inline-block', marginBottom: 28 }}>
          &larr; the fire
        </a>

        {state.phase === 'loading' && (
          <div style={{ color: C.smoke, fontStyle: 'italic', opacity: 0.7 }}>&hellip;</div>
        )}

        {state.phase === 'anon' && (
          <div style={{ color: C.ash, fontStyle: 'italic', lineHeight: 1.9, maxWidth: 440 }}>
            The tree is grown from what you have carried between fires. Sign in, and
            sit more than once, and it will begin to take root.
          </div>
        )}

        {state.phase === 'empty' && (
          <div style={{ color: C.ash, fontStyle: 'italic', lineHeight: 1.9, maxWidth: 440 }}>
            Nothing has taken root yet. The tree grows only from threads you have
            named and met again — return to the fire, and it will come.
          </div>
        )}

        {state.phase === 'tree' && (
          <>
            <div style={{ fontSize: 13, color: C.smoke, marginBottom: 6, fontStyle: 'italic' }}>
              your tree
            </div>
            <div style={{ fontSize: 13, color: C.dim, marginBottom: 32 }}>
              {state.data.chainDepth > 0
                ? `${state.data.chainDepth} ${state.data.chainDepth === 1 ? 'reading' : 'readings'} deep in this thread`
                : 'no thread open yet'}
              {state.data.keptLetterCount > 0 &&
                ` · ${state.data.keptLetterCount} ${state.data.keptLetterCount === 1 ? 'letter' : 'letters'} kept`}
            </div>

            <svg viewBox="0 0 620 620" width="100%" height="560" style={{ display: 'block' }} role="img" aria-label="Your tree, grown from your returning threads">
              <defs>
                <radialGradient id="tsCanopyGlow" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor={C.gold} stopOpacity="0.24" />
                  <stop offset="100%" stopColor={C.gold} stopOpacity="0" />
                </radialGradient>
              </defs>

              <circle cx={cx} cy={cy} r={80 + state.data.chainDepth * 55} fill="url(#tsCanopyGlow)" />
              {canopyRings.map((ring, ri) =>
                ring.map((b, bi) => (
                  <path
                    key={`${ri}-${bi}`}
                    className="ts-canopy-ring"
                    d={b.path}
                    stroke={C.gold}
                    strokeWidth={Math.max(0.4, 1.1 - b.ring * 0.15)}
                    fill="none"
                    strokeLinecap="round"
                    style={{ animationDelay: `${ri * 0.3 + bi * 0.05}s` } as React.CSSProperties}
                  />
                )),
              )}

              {/* trunk */}
              <line x1={cx} y1={cy} x2={cx} y2={cy - 70} stroke={C.smoke} strokeWidth="2.4" strokeLinecap="round" />

              {/* roots — one per marker, real data-driven. No line is ever
                  drawn BETWEEN two roots, even for markers that co-occur. */}
              {roots.map((r) => (
                <g key={r.key}>
                  <path
                    className="ts-root"
                    d={r.path}
                    stroke={r.floorCrossed ? C.gold : C.dim}
                    strokeWidth={r.strokeWidth}
                    fill="none"
                    strokeLinecap="round"
                    opacity={hovered === r.key ? 1 : r.opacity}
                    onMouseEnter={() => setHovered(r.key)}
                    onMouseLeave={() => setHovered(null)}
                  />
                  <circle
                    cx={r.endpoint.x}
                    cy={r.endpoint.y}
                    r={r.floorCrossed ? 3 : 1.8}
                    fill={r.floorCrossed ? C.gold : C.dim}
                    opacity={hovered === r.key ? 1 : r.opacity}
                    style={{ cursor: 'pointer' }}
                    onMouseEnter={() => setHovered(r.key)}
                    onMouseLeave={() => setHovered(null)}
                  />
                </g>
              ))}
            </svg>

            <div style={{ minHeight: 44, marginTop: 8 }}>
              {hoveredRoot ? (
                <div style={{ fontSize: 14, color: C.ash }}>
                  <span style={{ color: C.bone }}>{hoveredRoot.value}</span>
                  {' · '}
                  {hoveredRoot.floorCrossed
                    ? `returning${monthYear(hoveredRoot.firstSeen) ? ` since ${monthYear(hoveredRoot.firstSeen)}` : ''}`
                    : 'still taking root — not yet spoken in a reading'}
                  {hoveredRoot.floorCrossed && STAGE_NOTE[hoveredRoot.depthStage]}
                </div>
              ) : (
                <div style={{ fontSize: 13, color: C.dim }}>hover a root to see what it is</div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
