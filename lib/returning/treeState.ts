// lib/returning/treeState.ts
//
// The visual side of Axis 2 (marker trajectory), with a separate layer
// for the seeker's own kept Becoming sentences. Marker roots consume the
// same governed data as trajectoryContext.ts; Becoming leaves are authored
// by the seeker and remain visible independently of that feature gate.
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
import { assembleBecomingMaterial, type BecomingStatementRecord } from '@/lib/returning/becomingStatements';
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
  /** Kept, seeker-authored sentences. Rendered as outer leaves, never
   * connected to marker roots or combined with one another. */
  becomingStatements: { id: number; sentence: string; createdAt: string }[];
  /** COUNTED ONLY — see R-1. Never a drawn connection. */
  cooccurrencePairs: [string, string][];
  /** Readings deep in the current (most recent) chain. */
  chainDepth: number;
  keptLetterCount: number;
}

/**
 * Assemble the tree-state payload for a signed-in seeker. Marker roots
 * remain behind the trajectory governance gate; kept Becoming sentences
 * can appear independently as outer leaves.
 */
export async function buildTreeState(userId: number): Promise<TreeState | null> {
  try {
    const trajectoryIsEnabled = trajectoryEnabled();
    const allMarkers = trajectoryIsEnabled
      // minAppearances: 1 -> every confirmed marker row, including those
      // still below the surfacing floor. floorCrossed is derived here so
      // the client can render below-floor threads as "not yet real"
      // without a second query.
      ? await getTrajectoryMarkers(userId, 1)
      : [];
    let becomingRows: BecomingStatementRecord[] = [];
    try {
      becomingRows = await assembleBecomingMaterial(userId);
    } catch (err) {
      // Keep marker roots available if the Becoming migration is not yet
      // present or this optional source is temporarily unavailable.
      console.error('[tree-state] Becoming statements unavailable:', err);
    }
    if (allMarkers.length === 0 && becomingRows.length === 0) return null;

    const markers: TreeStateMarker[] = allMarkers.map((m) => ({
      value: m.markerValue,
      markerType: m.markerType,
      count: m.appearanceCount,
      floorCrossed: m.appearanceCount >= MIN_APPEARANCES_TO_SURFACE,
      firstSeen: m.firstSeen,
      depthStage: m.depthStage,
      pendingStage: m.pendingStage,
    }));
    const becomingStatements = becomingRows.map((r) => ({
      id: r.id,
      sentence: `${r.completionStem} ${r.completionText}`.trim(),
      createdAt: r.createdAt,
    }));

    let cooccurrencePairs: [string, string][] = [];
    if (trajectoryIsEnabled) {
      try {
        const pairs = await getMarkerCooccurrences(userId);
        cooccurrencePairs = pairs.map((p) => [p.a.markerValue, p.b.markerValue] as [string, string]);
      } catch {
        // Optional grace — a pairs failure never blocks the tree.
      }
    }

    let lineageKey = 'default';
    let chainDepth = 0;
    if (trajectoryIsEnabled) {
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
    }

    let keptLetterCount = 0;
    try {
      keptLetterCount = (await getUserThresholdLetters(userId)).length;
    } catch {
      // Letter count is decoration on the header line — never fatal.
    }

    return { lineageKey, markers, becomingStatements, cooccurrencePairs, chainDepth, keptLetterCount };
  } catch (err) {
    console.error('[tree-state] Could not assemble tree state:', err);
    return null;
  }
}
