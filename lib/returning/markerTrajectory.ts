// lib/returning/markerTrajectory.ts
//
// Structural recurrence for CONFIRMED markers only (migration 009). Every
// time /api/elder/confirm-marker records a 'confirmed' or 'reshaped'
// response (never 'declined'), recordMarkerAppearance bumps the count for
// that (marker_type, marker_value). Held silently below
// MIN_APPEARANCES_TO_SURFACE — same shape as MIN_READINGS_FOR_FIRST_SYNTHESIS
// in journalSynthesisLedger.ts: a floor exists so the Elder doesn't narrate
// every second-time echo as a revealed pattern. Two occurrences includes
// coincidence; three is the seeker's pattern, not the day's content.
//
// Co-occurrence ("this wound, always beside this figure") is deliberately
// NOT a second table. Only one marker is ever offered/confirmed per visit
// (lib/returning/markers.ts's design constraint), so two markers can never
// be confirmed together in the same visit_record row — a precomputed
// pairing table would have no honest source of "confirmed together" to
// draw from. getMarkerCooccurrences instead reads visit_record.markers
// (the model's proposed superset, which CAN name several markers in one
// passage) and keeps a pair only when BOTH values have independently
// crossed the confirmed floor here. That's the honest claim available:
// not "the model thinks these go together," but "these two things you've
// each ratified as real keep showing up in the same reading."
import { sql } from "./db";
import type { MarkerField } from "./markers";

export const MIN_APPEARANCES_TO_SURFACE = 3;

// Depth stage (migration 020): surface -> confronted -> integrated,
// forward/hold only. Trigger is a pure count on a real seeker action
// (a 'reshape' response, never a passive 'confirm') -- deliberately never
// model-assessed, so the depth-tracking side of Axis 2 carries the same
// integrity bar the recurrence-counting side already does. reshape_count
// on a row is already a distinct-visit count by construction: confirm-
// marker's atomic per-(visitId,field) guard permits at most one answer
// ever per visit, so N reshapes on the same row came from N different
// visits -- no separate visit-tracking needed here for that property.
export type DepthStage = 'surface' | 'confronted' | 'integrated';
export const CONFRONTED_AT_RESHAPE_COUNT = 1;
export const INTEGRATED_AT_RESHAPE_COUNT = 3;

export interface TrajectoryMarker {
  markerType: MarkerField;
  markerValue: string;
  appearanceCount: number;
  firstSeen: string;
  lastSeen: string;
  reshapeCount: number;
  depthStage: DepthStage;
}

export interface MarkerCooccurrence {
  a: { markerType: MarkerField; markerValue: string };
  b: { markerType: MarkerField; markerValue: string };
  count: number;
}

function rowToTrajectory(r: any): TrajectoryMarker {
  return {
    markerType: r.marker_type,
    markerValue: r.marker_value,
    appearanceCount: r.appearance_count,
    firstSeen: String(r.first_seen),
    lastSeen: String(r.last_seen),
    reshapeCount: r.reshape_count,
    depthStage: r.depth_stage,
  };
}

/**
 * Record one confirmed/reshaped marker and compute its depth stage in the
 * same atomic statement. Case-insensitive dedupe on marker_value (same
 * unique index migration 009 established).
 *
 * mode distinguishes a passive 'confirmed' response from an active
 * 'reshaped' one -- only reshapes count toward reshape_count/depth stage;
 * both count toward appearance_count as before. Race-safety: this is a
 * single INSERT ... ON CONFLICT statement (Postgres executes it
 * atomically under a row-level lock), not a read-then-write -- same
 * property recordMarkerAppearance already had, extended rather than
 * reimplemented. Callers must still gate this behind confirm-marker's own
 * atomic "NOT (markers_confirmed ? field)" guard, exactly as before; this
 * function fires at most once per (visitId, field) as a result of that
 * upstream guard, not because of anything new here.
 *
 * Returns the stage transition if one occurred (for the caller to
 * best-effort write to marker_depth_transition), or null if the stage
 * didn't change this call.
 */
function computeStage(oldStage: DepthStage, reshapeCount: number): DepthStage {
  if (oldStage === 'integrated') return 'integrated';
  if (reshapeCount >= INTEGRATED_AT_RESHAPE_COUNT) return 'integrated';
  if (reshapeCount >= CONFRONTED_AT_RESHAPE_COUNT) return 'confronted';
  return 'surface';
}

export async function recordMarkerAppearance(
  userId: number,
  markerType: MarkerField,
  markerValue: string,
  mode: 'confirmed' | 'reshaped' = 'confirmed'
): Promise<{ trajectoryId: number; fromStage: DepthStage; toStage: DepthStage } | null> {
  const value = markerValue.trim();
  if (!value) return null;
  const reshapeDelta = mode === 'reshaped' ? 1 : 0;

  // Step 1: the ONLY statement under real concurrency contention -- a
  // single atomic INSERT ... ON CONFLICT ... DO UPDATE, identical in kind
  // to the pre-existing (unextended) version of this function. This alone
  // is what guarantees appearance_count/reshape_count can't be
  // double-counted under a concurrent double-submit.
  const [row] = await sql`
    INSERT INTO marker_trajectory (user_id, marker_type, marker_value, reshape_count)
    VALUES (${userId}, ${markerType}, ${value}, ${reshapeDelta})
    ON CONFLICT (user_id, marker_type, lower(marker_value)) DO UPDATE SET
      appearance_count = marker_trajectory.appearance_count + 1,
      last_seen = now(),
      reshape_count = marker_trajectory.reshape_count + ${reshapeDelta}
    RETURNING id, reshape_count, depth_stage
  `;
  const trajectoryId = Number(row.id);
  const oldStage = row.depth_stage as DepthStage;
  const newStage = computeStage(oldStage, Number(row.reshape_count));
  if (newStage === oldStage) return null;

  // Step 2: a plain primary-key UPDATE, not a second read-modify-write on
  // a contended value -- newStage was already correctly computed above
  // from the atomically-obtained reshape_count in step 1, so there is
  // nothing left to race here even though this is a separate statement.
  // (An earlier single-CTE version tried to fold both into one round
  // trip; the follow-up UPDATE inside that CTE silently matched zero rows
  // -- verified live, not assumed -- so this two-statement form is the
  // one actually proven correct by tests/markerDepthStage.integration.test.ts.)
  await sql`
    UPDATE marker_trajectory
    SET depth_stage = ${newStage}, depth_stage_updated_at = now()
    WHERE id = ${trajectoryId}
  `;

  return { trajectoryId, fromStage: oldStage, toStage: newStage };
}

/**
 * Best-effort audit write for a stage transition (migration 020). Never
 * allowed to affect the caller -- same posture as recordMarkerAppearance's
 * own callers already use for it.
 */
export async function recordDepthTransition(
  userId: number,
  markerType: MarkerField,
  trajectoryId: number,
  fromStage: DepthStage,
  toStage: DepthStage,
  visitId: string | null
): Promise<void> {
  await sql`
    INSERT INTO marker_depth_transition
      (marker_trajectory_id, user_id, marker_type, from_stage, to_stage, visit_id)
    VALUES (${trajectoryId}, ${userId}, ${markerType}, ${fromStage}, ${toStage}, ${visitId})
  `;
}

/** Confirmed markers that have crossed the surfacing floor, most-recurrent first. */
export async function getTrajectoryMarkers(
  userId: number,
  minAppearances: number = MIN_APPEARANCES_TO_SURFACE
): Promise<TrajectoryMarker[]> {
  const rows = await sql`
    SELECT marker_type, marker_value, appearance_count, first_seen, last_seen, reshape_count, depth_stage
    FROM marker_trajectory
    WHERE user_id = ${userId} AND appearance_count >= ${minAppearances}
    ORDER BY appearance_count DESC, last_seen DESC
  `;
  return rows.map(rowToTrajectory);
}

/**
 * Pairs of confirmed markers that co-appear in the model's proposed markers
 * for the same visit, filtered to pairs where BOTH values have individually
 * crossed the surfacing floor. Read-time only — no write path.
 */
export async function getMarkerCooccurrences(
  userId: number,
  minAppearances: number = MIN_APPEARANCES_TO_SURFACE
): Promise<MarkerCooccurrence[]> {
  const rows = await sql`
    WITH confirmed AS (
      SELECT marker_type, marker_value
      FROM marker_trajectory
      WHERE user_id = ${userId} AND appearance_count >= ${minAppearances}
    ),
    proposed AS (
      SELECT v.id AS visit_id, kv.key AS marker_type, kv.value #>> '{}' AS marker_value
      FROM visit_record v, jsonb_each(v.markers) AS kv
      WHERE v.user_id = ${userId}
    )
    SELECT
      p1.marker_type AS type_a, p1.marker_value AS value_a,
      p2.marker_type AS type_b, p2.marker_value AS value_b,
      count(*)::int AS co_count
    FROM proposed p1
    JOIN proposed p2
      ON p1.visit_id = p2.visit_id
     AND (p1.marker_type, p1.marker_value) < (p2.marker_type, p2.marker_value)
    JOIN confirmed ca ON ca.marker_type = p1.marker_type AND lower(ca.marker_value) = lower(p1.marker_value)
    JOIN confirmed cb ON cb.marker_type = p2.marker_type AND lower(cb.marker_value) = lower(p2.marker_value)
    GROUP BY 1, 2, 3, 4
    ORDER BY co_count DESC
  `;
  return rows.map((r: any) => ({
    a: { markerType: r.type_a, markerValue: r.value_a },
    b: { markerType: r.type_b, markerValue: r.value_b },
    count: r.co_count,
  }));
}
