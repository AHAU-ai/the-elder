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

export interface TrajectoryMarker {
  markerType: MarkerField;
  markerValue: string;
  appearanceCount: number;
  firstSeen: string;
  lastSeen: string;
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
  };
}

/** Record one confirmed/reshaped marker. Case-insensitive dedupe on marker_value. */
export async function recordMarkerAppearance(
  userId: number,
  markerType: MarkerField,
  markerValue: string
): Promise<void> {
  const value = markerValue.trim();
  if (!value) return;
  await sql`
    INSERT INTO marker_trajectory (user_id, marker_type, marker_value)
    VALUES (${userId}, ${markerType}, ${value})
    ON CONFLICT (user_id, marker_type, lower(marker_value)) DO UPDATE SET
      appearance_count = marker_trajectory.appearance_count + 1,
      last_seen = now()
  `;
}

/** Confirmed markers that have crossed the surfacing floor, most-recurrent first. */
export async function getTrajectoryMarkers(
  userId: number,
  minAppearances: number = MIN_APPEARANCES_TO_SURFACE
): Promise<TrajectoryMarker[]> {
  const rows = await sql`
    SELECT marker_type, marker_value, appearance_count, first_seen, last_seen
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
