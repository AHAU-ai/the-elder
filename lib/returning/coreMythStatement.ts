// lib/returning/coreMythStatement.ts
//
// The Core Myth Statement (migration 022): a seeker-authored, seeker-
// owned capstone artifact. Resolves R1's tension structurally rather than
// working around it forever -- The Elder is forbidden from asserting a
// connection between separately-confirmed markers, but the seeker is the
// sovereign author of claims about their own life. This module never
// drafts, never synthesizes, never proposes a connecting sentence -- it
// only assembles the seeker's own confirmed material and hands it back,
// raw and unconnected, and stores what the seeker chooses to write.
//
// Eligibility, material assembly, and dismissal are all pure arithmetic
// and array operations on real seeker actions -- same integrity posture
// as depth-stage (migrations 020/021): The Elder notices, it never decides.

import { sql } from "./db";
import type { MarkerField } from "./markers";
import {
  getBecomingStatementCount,
  assembleBecomingMaterial as assembleBecomingMaterialRows,
  resolveBecomingMaterial,
  type BecomingStatementRecord,
} from "./becomingStatements";

export const REQUIRED_INTEGRATED_MARKERS = 3;
export const BODY_MIN_CHARS = 50;
export const BODY_MAX_CHARS = 1500;

export interface IntegratedMarkerMaterial {
  trajectoryId: number;
  markerType: MarkerField;
  markerValue: string;
}

/**
 * Unified material item — either a confirmed marker (migrations 020/021)
 * or a kept Becoming statement (migration 027), normalized to one shape
 * so callers (the eligibility offer, the Core Myth Statement writing UI)
 * don't need to branch by source to render or count material. `kind`
 * disambiguates which id space `id` belongs to when it needs to be sent
 * back on save (see saveNewStatement's sourceMarkerIds/sourceBecomingIds
 * split) — never used to imply the two kinds are otherwise related.
 *
 * Structural non-connection guarantee, same as assembleIntegratedMaterial
 * and assembleBecomingMaterial: built by concatenating two independently
 * 1:1-mapped arrays, in confirmation order. No code path here joins,
 * summarizes, or asserts a relationship between any two items.
 */
export interface IntegratedMaterialItem {
  kind: "marker" | "becoming";
  id: number;
  label: string;
  /** When present, the timestamp this material was confirmed/kept —
   *  used only to interleave the two sources chronologically. */
  confirmedAt?: string;
}

export interface CoreMythStatementRecord {
  id: number;
  version: number;
  bodyText: string;
  sourceMarkerIds: number[];
  sourceBecomingIds: number[];
  createdAt: string;
  supersededAt: string | null;
}

/** How many distinct marker VALUES this user has ever brought to 'integrated'. */
export async function getIntegratedMarkerCount(userId: number): Promise<number> {
  const [row] = await sql`
    SELECT count(*)::int AS n FROM marker_trajectory
    WHERE user_id = ${userId} AND depth_stage = 'integrated'
  `;
  return Number(row?.n ?? 0);
}

/**
 * Combined count of everything eligible to count toward the Core Myth
 * Statement threshold: markers the seeker brought to 'integrated' PLUS
 * Becoming statements they kept (migration 027). Eligibility doesn't
 * care which table confirmed material came from — see that migration's
 * header for why the two are stored separately despite counting equally
 * here. `integratedCount` on Eligibility below is this combined number,
 * not marker-only — kept under its original field name so existing
 * callers (CoreMythStatement.tsx) don't need to change their reads of it.
 */
export async function getConfirmedMaterialCount(userId: number): Promise<number> {
  const [markerCount, becomingCount] = await Promise.all([
    getIntegratedMarkerCount(userId),
    getBecomingStatementCount(userId),
  ]);
  return markerCount + becomingCount;
}

export type Eligibility =
  | { status: "not_eligible"; integratedCount: number }
  /** Standing invitation: eligible, not yet dismissed at this count (or
   *  a fresh dismissal-worthy count reached since the last dismissal). */
  | { status: "invited"; integratedCount: number }
  /** Eligible, dismissed at this count -- the quiet permanent entry
   *  point still applies (see docs on the UI side), the ceremonial
   *  offer just doesn't re-surface until integratedCount grows further. */
  | { status: "dismissed"; integratedCount: number };

/**
 * Count-based only, no timers -- the ceremonial offer resurfaces exactly
 * when integratedCount grows PAST whatever it was at last dismissal, and
 * not before. Mirrors declinePendingStage's own philosophy: nothing lost,
 * re-offered only by real re-engagement.
 */
export async function getEligibility(userId: number): Promise<Eligibility> {
  const integratedCount = await getConfirmedMaterialCount(userId);
  if (integratedCount < REQUIRED_INTEGRATED_MARKERS) {
    return { status: "not_eligible", integratedCount };
  }
  const [dismissal] = await sql`
    SELECT dismissed_at_count FROM core_myth_invitation_dismissal WHERE user_id = ${userId}
  `;
  if (dismissal && Number(dismissal.dismissed_at_count) >= integratedCount) {
    return { status: "dismissed", integratedCount };
  }
  return { status: "invited", integratedCount };
}

/** The seeker's own "not now" -- durable, count-anchored, never a timer. */
export async function dismissInvitation(userId: number): Promise<void> {
  const integratedCount = await getConfirmedMaterialCount(userId);
  await sql`
    INSERT INTO core_myth_invitation_dismissal (user_id, dismissed_at_count, dismissed_at)
    VALUES (${userId}, ${integratedCount}, now())
    ON CONFLICT (user_id) DO UPDATE SET
      dismissed_at_count = ${integratedCount},
      dismissed_at = now()
  `;
}

/**
 * Resolves trajectory ids back to their raw marker type/value -- used by
 * the Journal spine (myth-as-home, Part A §3) to show a superseded
 * version's source markers, same unconnected-list discipline as
 * assembleIntegratedMaterial: a rows.map(), never a joined sentence. A
 * version's markers are looked up by id regardless of that marker's
 * CURRENT depth_stage (it may have reshaped further since this version
 * was written) -- this is a historical record of what the statement was
 * built from, not a live claim about the marker's present state.
 *
 * Scoped to userId on the query itself, not just trusted from the
 * caller's own already-scoped ids -- a version row can never be used to
 * pull another seeker's marker_trajectory rows even if ids were guessed.
 */
export async function resolveMarkerMaterial(userId: number, trajectoryIds: number[]): Promise<IntegratedMarkerMaterial[]> {
  if (trajectoryIds.length === 0) return [];
  const rows = await sql`
    SELECT id, marker_type, marker_value FROM marker_trajectory
    WHERE user_id = ${userId} AND id = ANY(${trajectoryIds})
  `;
  return rows.map((r: any) => ({
    trajectoryId: Number(r.id),
    markerType: r.marker_type as MarkerField,
    markerValue: r.marker_value as string,
  }));
}

function becomingLabel(r: BecomingStatementRecord): string {
  return `${r.completionStem} ${r.completionText}`.trim();
}

/**
 * The seeker's confirmed material from BOTH sources (markers + Becoming
 * statements), normalized to IntegratedMaterialItem and interleaved
 * chronologically by confirmation time. This is what the eligibility
 * offer and the writing UI read from now, keeping each source distinct
 * within the normalized list.
 */
export async function assembleConfirmedMaterial(userId: number): Promise<IntegratedMaterialItem[]> {
  const [markerRows, becomingRows] = await Promise.all([
    sql`
      SELECT id, marker_type, marker_value, depth_stage_updated_at FROM marker_trajectory
      WHERE user_id = ${userId} AND depth_stage = 'integrated'
      ORDER BY depth_stage_updated_at ASC NULLS LAST
    ` as unknown as Promise<any[]>,
    assembleBecomingMaterialRows(userId),
  ]);
  const markerItems: IntegratedMaterialItem[] = markerRows.map((r: any) => ({
    kind: "marker" as const,
    id: Number(r.id),
    label: r.marker_value as string,
    confirmedAt: r.depth_stage_updated_at ? String(r.depth_stage_updated_at) : undefined,
  }));
  const becomingItems: IntegratedMaterialItem[] = becomingRows.map((r) => ({
    kind: "becoming" as const,
    id: r.id,
    label: becomingLabel(r),
    confirmedAt: r.createdAt,
  }));
  return [...markerItems, ...becomingItems].sort((a, b) => {
    if (!a.confirmedAt || !b.confirmedAt) return 0;
    return a.confirmedAt.localeCompare(b.confirmedAt);
  });
}

/** Resolves a version's source ids from BOTH tables, for the Journal
 *  spine — same historical-record posture as resolveMarkerMaterial. */
export async function resolveConfirmedMaterial(
  userId: number,
  sourceMarkerIds: number[],
  sourceBecomingIds: number[]
): Promise<IntegratedMaterialItem[]> {
  const [markerRows, becomingRows] = await Promise.all([
    resolveMarkerMaterial(userId, sourceMarkerIds),
    resolveBecomingMaterial(userId, sourceBecomingIds),
  ]);
  return [
    ...markerRows.map((r) => ({ kind: "marker" as const, id: r.trajectoryId, label: r.markerValue })),
    ...becomingRows.map((r) => ({ kind: "becoming" as const, id: r.id, label: becomingLabel(r) })),
  ];
}

function rowToStatement(r: any): CoreMythStatementRecord {
  return {
    id: Number(r.id),
    version: Number(r.version),
    bodyText: r.body_text,
    sourceMarkerIds: Array.isArray(r.source_marker_ids) ? r.source_marker_ids.map(Number) : [],
    sourceBecomingIds: Array.isArray(r.source_becoming_ids) ? r.source_becoming_ids.map(Number) : [],
    createdAt: String(r.created_at),
    supersededAt: r.superseded_at ? String(r.superseded_at) : null,
  };
}

/** The seeker's current (non-superseded) statement, or null if they've never written one. */
export async function getCurrentStatement(userId: number): Promise<CoreMythStatementRecord | null> {
  const rows = await sql`
    SELECT id, version, body_text, source_marker_ids, source_becoming_ids, created_at, superseded_at
    FROM core_myth_statement
    WHERE user_id = ${userId} AND superseded_at IS NULL
  `;
  return rows.length > 0 ? rowToStatement(rows[0]) : null;
}

/** Full version history, newest first — the seeker's own record of how their self-understanding moved. */
export async function getStatementHistory(userId: number): Promise<CoreMythStatementRecord[]> {
  const rows = await sql`
    SELECT id, version, body_text, source_marker_ids, source_becoming_ids, created_at, superseded_at
    FROM core_myth_statement
    WHERE user_id = ${userId}
    ORDER BY version DESC
  `;
  return rows.map(rowToStatement);
}

export class VersionConflictError extends Error {
  constructor() {
    super("A concurrent write already superseded the current statement — refetch and retry.");
    this.name = "VersionConflictError";
  }
}

/**
 * Write a new version, superseding whatever is current. Append-only —
 * never an in-place UPDATE of body_text. Race-safety: the two statements
 * run inside one real transaction (sql.transaction, the same helper
 * lib/thresholdLetterLedger.ts already trusts for its own insert-then-
 * trim atomic pair) so a concurrent UPDATE on the same row blocks on a
 * real Postgres row lock rather than racing past it. The backstop is the
 * partial unique index from migration 022
 * (uq_core_myth_statement_one_current) -- if a concurrent write's UPDATE
 * misses the row because a sibling transaction already superseded it,
 * this INSERT hits that unique constraint and fails loudly (caught below
 * as VersionConflictError) rather than silently double-superseding.
 */
export async function saveNewStatement(
  userId: number,
  bodyText: string,
  sourceMarkerIds: number[],
  sourceBecomingIds: number[] = []
): Promise<CoreMythStatementRecord> {
  const trimmed = bodyText.trim();
  if (trimmed.length < BODY_MIN_CHARS || trimmed.length > BODY_MAX_CHARS) {
    throw new RangeError(`body_text must be between ${BODY_MIN_CHARS} and ${BODY_MAX_CHARS} characters`);
  }
  try {
    await sql.transaction([
      sql`
        UPDATE core_myth_statement
        SET superseded_at = now()
        WHERE user_id = ${userId} AND superseded_at IS NULL
      `,
      sql`
        INSERT INTO core_myth_statement (user_id, version, body_text, source_marker_ids, source_becoming_ids)
        VALUES (
          ${userId},
          (SELECT COALESCE(MAX(version), 0) + 1 FROM core_myth_statement WHERE user_id = ${userId}),
          ${trimmed},
          ${JSON.stringify(sourceMarkerIds)}::jsonb,
          ${JSON.stringify(sourceBecomingIds)}::jsonb
        )
      `,
    ]);
  } catch (err: any) {
    // Postgres unique_violation — the partial unique index caught a
    // concurrent write this transaction's own row lock didn't prevent.
    if (err?.code === '23505') throw new VersionConflictError();
    throw err;
  }
  const current = await getCurrentStatement(userId);
  if (!current) throw new Error("saveNewStatement: no current row found immediately after write");
  return current;
}
