// treeGeometry.ts
//
// Pure layout math for the seeker's tree, shared between the full /tree
// page (app/components/TreeState.tsx) and the compact preview shown on
// the myth-choice landing screen (app/components/TreeGlyph.tsx) — moved
// out of TreeState.tsx so the two renderers can never silently drift
// (a bug fixed in one root-fan calculation but not the other would be
// invisible until someone compared them side by side).
//
// R-1 (docs/axis-2-marker-trajectory.md): cooccurrencePairs are never
// consumed here. A connecting path between two roots would go right
// here, and must not — see buildRoots' own comment below.

export type DepthStage = 'surface' | 'confronted' | 'integrated';

export interface TreeStateMarker {
  value: string;
  markerType: string;
  count: number;
  floorCrossed: boolean;
  firstSeen: string;
  depthStage: DepthStage;
  pendingStage: DepthStage | null;
}

export interface Root extends TreeStateMarker {
  key: string;
  angle: number;
  path: string;
  endpoint: { x: number; y: number };
  strokeWidth: number;
  opacity: number;
}

export interface CanopyBranch {
  path: string;
  ring: number;
}

export function polarPoint(cx: number, cy: number, angleDeg: number, radius: number) {
  const rad = (angleDeg * Math.PI) / 180;
  return { x: cx + Math.cos(rad) * radius, y: cy + Math.sin(rad) * radius };
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
export function buildRoots(markers: TreeStateMarker[], cx: number, cy: number): Root[] {
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
export function buildCanopyRings(depth: number, cx: number, cy: number): CanopyBranch[][] {
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
