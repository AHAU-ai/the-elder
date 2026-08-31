// lib/returning/treeState.ts
//
// The VISUAL side of Axis 2 (marker trajectory) — a second consumer of
// exactly the data trajectoryContext.ts already assembles for the PROMPT
// layer (getTrajectoryMarkers, MIN_APPEARANCES_TO_SURFACE,
// getMarkerCooccurrences, mostRecentChain). This is not a new tracking
// system: every number here is already computed and governed elsewhere.
//
// Same governance posture as trajectoryContext.ts: returns null (never
// throws) unless trajectoryEnabled() — the tree is a rendering of the
// trajectory layer, so it cannot light before that layer does.
//
// R-1 (docs/axis-2-marker-trajectory.md): cooccurrencePairs are carried
// in the payload as COUNTED data only. They must never be drawn as an
// explicit visual connection between two roots. Proximity, never a line.
import { trajectoryEnabled } from '@/config/returning-features';
import {
  getTrajectoryMarkers,
  getMarkerCooccurrences,
  MIN_APPEARANCES_TO_SURFACE,
  type DepthStage,
} from './markerTrajectory';
import { mostRecentChain } from './visit';
import { getUserThresholdLetters } from '@/lib/thresholdLetterLedger';
import type { MarkerField } from './markers';

export interface TreeStateMarker {
  /** The seeker's own confirmed/reshaped text for this thread. */
  value: string;
  /** Which of the five marker fields it sits in. */
  markerType: MarkerField;
  /** Raw appearance count — carried for the client's stroke weight, never
   *  rendered as a number to the seeker (same discipline as
   *  trajectoryContext, which speaks no counts). */
  count: number;
  /** count >= MIN_APPEARANCES_TO_SURFACE — the same floor the prompt
   *  layer uses to decide a thread is real enough to speak. Below-floor
   *  markers are still returned (rendered thin/dim client-side). */
  floorCrossed: boolean;
  firstSeen: string;
  depthStage: DepthStage;
  pendingStage: DepthStage | null;
}

export interface TreeState {
  /** Motif key — the most recent chain's lineage, else 'default'. */
  lineageKey: string;
  markers: TreeStateMarker[];
  /** COUNTED ONLY — see R-1. Never a drawn connection. */
  cooccurrencePairs: [string, string][];
  /** Readings deep in the current (most recent) chain. */
  chainDepth: number;
  keptLetterCount: number;
}

/**
 * Assemble the tree-state payload for a signed-in seeker. null when the
 * trajectory layer is not lit, or when the seeker has no trajectory data
 * at all yet (no roots to draw).
 */
export async function buildTreeState(userId: number): Promise<TreeState | null> {
  try {
    if (!trajectoryEnabled()) return null;

    // minAppearances: 1 -> every confirmed marker row, including those
    // still below the surfacing floor. floorCrossed is derived here so
    // the client can render below-floor threads as "not yet real"
    // without a second query.
    const allMarkers = await getTrajectoryMarkers(userId, 1);
    if (allMarkers.length === 0) return null;

    const markers: TreeStateMarker[] = allMarkers.map((m) => ({
      value: m.markerValue,
      markerType: m.markerType,
      count: m.appearanceCount,
      floorCrossed: m.appearanceCount >= MIN_APPEARANCES_TO_SURFACE,
      firstSeen: m.firstSeen,
      depthStage: m.depthStage,
      pendingStage: m.pendingStage,
    }));

    let cooccurrencePairs: [string, string][] = [];
    try {
      const pairs = await getMarkerCooccurrences(userId);
      cooccurrencePairs = pairs.map((p) => [p.a.markerValue, p.b.markerValue] as [string, string]);
    } catch {
      // Optional grace — a pairs failure never blocks the tree.
    }

    let lineageKey = 'default';
    let chainDepth = 0;
    try {
      const head = await mostRecentChain(userId);
      if (head) {
        lineageKey = head.lineageKey || 'default';
        // head.depth is 0-indexed (nextDepth = depth + 1 in visit.ts), so
        // the number of readings deep in this thread is depth + 1.
        chainDepth = Math.max(0, Number(head.depth) || 0) + 1;
      }
    } catch {
      // No chain / lookup failure — a rootless-but-markered seeker still
      // gets a tree, just with no canopy rings.
    }

    let keptLetterCount = 0;
    try {
      keptLetterCount = (await getUserThresholdLetters(userId)).length;
    } catch {
      // Letter count is decoration on the header line — never fatal.
    }

    return { lineageKey, markers, cooccurrencePairs, chainDepth, keptLetterCount };
  } catch {
    return null;
  }
}
