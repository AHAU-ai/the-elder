// lib/returning/becomingStatements.ts
//
// DB access for becoming_statement (migration 023). See that migration's
// header for why this is a separate table from marker_trajectory rather
// than a row inserted there with a fabricated depth_stage.
//
// Same integrity posture as lib/returning/coreMythStatement.ts's
// assembleIntegratedMaterial: assembleBecomingMaterial does a bare 1:1
// map from rows to plain objects. No .join(), no combining sentence, no
// code path that could produce "these statements are related" from this
// function -- that judgment, if ever made, belongs to the seeker writing
// their own Core Myth Statement, never to this layer.

import { sql } from "./db";

const COMPLETION_MIN_CHARS = 3;
const COMPLETION_MAX_CHARS = 140;

export interface BecomingStatementRecord {
  id: number;
  voiceKey: string;
  archetypeName: string | null;
  marker: string;
  completionStem: string;
  completionText: string;
  createdAt: string;
}

export interface SaveBecomingStatementInput {
  voiceKey: string;
  archetypeName: string | null;
  marker: string;
  completionStem: string;
  completionText: string;
}

function rowToStatement(r: any): BecomingStatementRecord {
  return {
    id: Number(r.id),
    voiceKey: r.voice_key,
    archetypeName: r.archetype_name,
    marker: r.marker,
    completionStem: r.completion_stem,
    completionText: r.completion_text,
    createdAt: String(r.created_at),
  };
}

/**
 * Persist one kept Becoming completion. Called immediately when the
 * seeker chooses "Carry This" (Becoming.tsx), not deferred to Core Myth
 * Statement authorship time -- it becomes eligible material the moment
 * it's confirmed, the same way a marker becomes eligible the moment it
 * reaches 'integrated', not when a Core Myth Statement happens to get
 * written.
 */
export async function saveBecomingStatement(
  userId: number,
  input: SaveBecomingStatementInput
): Promise<BecomingStatementRecord> {
  const trimmed = input.completionText.trim();
  if (trimmed.length < COMPLETION_MIN_CHARS || trimmed.length > COMPLETION_MAX_CHARS) {
    throw new RangeError(
      `completion_text must be between ${COMPLETION_MIN_CHARS} and ${COMPLETION_MAX_CHARS} characters`
    );
  }
  const [row] = await sql`
    INSERT INTO becoming_statement (user_id, voice_key, archetype_name, marker, completion_stem, completion_text)
    VALUES (${userId}, ${input.voiceKey}, ${input.archetypeName}, ${input.marker}, ${input.completionStem}, ${trimmed})
    RETURNING id, voice_key, archetype_name, marker, completion_stem, completion_text, created_at
  `;
  return rowToStatement(row);
}

/** How many becoming_statement rows this user has ever confirmed. */
export async function getBecomingStatementCount(userId: number): Promise<number> {
  const [row] = await sql`
    SELECT count(*)::int AS n FROM becoming_statement WHERE user_id = ${userId}
  `;
  return Number(row?.n ?? 0);
}

/** All of a user's becoming_statement rows, oldest first — mirrors
 *  assembleIntegratedMaterial's ordering (depth_stage_updated_at ASC) so
 *  the two material sources read consistently when merged by the caller. */
export async function assembleBecomingMaterial(userId: number): Promise<BecomingStatementRecord[]> {
  const rows = await sql`
    SELECT id, voice_key, archetype_name, marker, completion_stem, completion_text, created_at
    FROM becoming_statement
    WHERE user_id = ${userId}
    ORDER BY created_at ASC
  `;
  return rows.map(rowToStatement);
}

/**
 * Resolve becoming_statement ids back to their rows -- used the same way
 * resolveMarkerMaterial is used, for the Journal spine to show a
 * superseded Core Myth Statement version's source material. Scoped to
 * userId on the query itself, not just trusted from the caller.
 */
export async function resolveBecomingMaterial(userId: number, ids: number[]): Promise<BecomingStatementRecord[]> {
  if (ids.length === 0) return [];
  const rows = await sql`
    SELECT id, voice_key, archetype_name, marker, completion_stem, completion_text, created_at
    FROM becoming_statement
    WHERE user_id = ${userId} AND id = ANY(${ids})
  `;
  return rows.map(rowToStatement);
}
