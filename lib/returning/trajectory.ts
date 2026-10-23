// lib/returning/trajectory.ts
//
// THE INTELLIGENCE LAYER — DARK BY DEFAULT.
// Implemented per Makeover v2 Appendix A. Every entry checks trajectoryEnabled().
// While governance gates are unmet, readTrajectory() returns ARRIVING regardless of input.
//
// Invariants:
//   - Consumes ONLY confirmed markers (§1.5). Provisional markers ignored.
//   - Output EPHEMERAL: never persist or log the Movement enum (RT-2).
//   - Fails toward warmth: ambiguity => DESCENDING/ARRIVING, never CIRCLING/RANGING.
//   - Grief signal forces honoring register (RT-1).

import { trajectoryEnabled } from "@/config/returning-features";
import type { Visit, MythicMarkers } from "@/lib/returning/visit";

export type Movement = "ARRIVING" | "DESCENDING" | "CIRCLING" | "RANGING" | "CROSSING";

export interface WelfareContext { griefSignal: boolean; }
export interface TrajectoryRead { movement: Movement; }

// What the database actually holds in visit_record.markers_confirmed is
// { [field]: { value, mode, confirmedAt } } (app/api/elder/confirm-marker), not
// a bare string. Reading it as strings made every .toLowerCase() below throw on
// real data, which the divine route swallowed as "ARRIVING": the classifier
// never fired for anyone with a confirmed marker. Accept both shapes.
function markerText(raw: unknown): string | undefined {
  if (typeof raw === "string") return raw;
  if (raw && typeof raw === "object" && typeof (raw as { value?: unknown }).value === "string") {
    return (raw as { value: string }).value;
  }
  return undefined;
}

function confirmed(v: Visit): MythicMarkers {
  // §1.5: no confirmation => empty => cannot drive a sensitive read
  const raw = (v.markersConfirmed ?? {}) as Record<string, unknown>;
  const out: MythicMarkers = {};
  for (const k of ["wound", "figure", "threshold", "exile", "pattern"] as const) {
    const t = markerText(raw[k]);
    if (t && t.trim()) out[k] = t;
  }
  return out;
}

export function readTrajectory(visits: Visit[], welfare: WelfareContext): TrajectoryRead {
  if (!trajectoryEnabled()) return { movement: "ARRIVING" }; // HARD GATE: dark until governance clears

  if (!visits || visits.length <= 1) return { movement: "ARRIVING" };

  const recent = visits.slice(-5);
  const deepenRatio = recent.filter((v) => v.mode === "deepen").length / recent.length;
  const chains = new Set(recent.map((v) => v.chainId)).size;
  const maxDepth = Math.max(...recent.map((v) => v.depth));

  const wounds = recent.map((v) => (confirmed(v).wound ?? "").toLowerCase()).filter(Boolean);
  const thresholds = recent.map((v) => (confirmed(v).threshold ?? "").toLowerCase()).filter(Boolean);
  const patterns = recent.map((v) => (confirmed(v).pattern ?? "").toLowerCase()).filter(Boolean);

  const recurringWound = wounds.length >= 2 && new Set(wounds).size < wounds.length;
  const thresholdRepeated = thresholds.length >= 2 && new Set(thresholds).size < thresholds.length;
  const patternResolvesThreshold = patterns.length > 0 && thresholds.length > 0 && patterns.length >= thresholds.length;

  if (welfare.griefSignal) return { movement: "DESCENDING" }; // RT-1 grief override

  if (chains >= recent.length && deepenRatio === 0) return { movement: "RANGING" };
  if (deepenRatio >= 0.5 && maxDepth >= 3 && patterns.length > 0) return { movement: "DESCENDING" };
  if (patternResolvesThreshold) return { movement: "CROSSING" };
  if ((recurringWound || thresholdRepeated) && patterns.length === 0) return { movement: "CIRCLING" };

  return { movement: "DESCENDING" }; // fail toward warmth
}
