/**
 * mythReadingLog.ts
 *
 * Append-only per-reading log, companion to mythLedger.ts's merged
 * myth_archetype rows. myth_archetype keeps the *current* state of each
 * archetype (a running summary); this keeps the raw history a narrative
 * synthesis, archetype-arc count, or within-lineage recall needs to draw
 * on. Written alongside the myth_archetype upsert, never in place of it.
 *
 * Fails closed like mythLedger.ts: any DB error here must never break the
 * reading response it's attached to, so callers wrap these in try/catch
 * and swallow failures.
 */

import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);

const MAX_READINGS_PER_USER = 300;

export interface MythReadingRow {
  id: number;
  lineageKey: string;
  archetypeName: string | null;
  depthSummary: string;
  peopleCircumstances: string;
  createdAt: string;
}

export interface ArchetypeArcEntry {
  archetypeName: string;
  count: number;
  firstSeen: string;
  lastSeen: string;
}

function rowToEntry(row: any): MythReadingRow {
  return {
    id: Number(row.id),
    lineageKey: row.lineage_key,
    archetypeName: row.archetype_name,
    depthSummary: row.depth_summary,
    peopleCircumstances: row.people_circumstances,
    createdAt: row.created_at,
  };
}

/** Record one reading's extracted signature. Evicts the oldest row if at the cap. */
export async function logMythReading(
  userId: number,
  lineageKey: string,
  archetypeName: string,
  depthSummary: string,
  peopleCircumstances: string
): Promise<void> {
  const count = await sql`SELECT count(*)::int AS n FROM myth_reading WHERE user_id = ${userId}`;
  if (count[0].n >= MAX_READINGS_PER_USER) {
    await sql`
      DELETE FROM myth_reading
      WHERE id = (
        SELECT id FROM myth_reading
        WHERE user_id = ${userId}
        ORDER BY created_at ASC
        LIMIT 1
      )
    `;
  }

  await sql`
    INSERT INTO myth_reading (user_id, lineage_key, archetype_name, depth_summary, people_circumstances)
    VALUES (${userId}, ${lineageKey}, ${archetypeName}, ${depthSummary}, ${peopleCircumstances})
  `;
}

/** Total reading count for a user — used to gate journal synthesis. */
export async function getReadingCount(userId: number): Promise<number> {
  const rows = await sql`SELECT count(*)::int AS n FROM myth_reading WHERE user_id = ${userId}`;
  return rows[0].n;
}

/** Most recent readings, newest-first — synthesis input. */
export async function getRecentReadings(userId: number, limit = 15): Promise<MythReadingRow[]> {
  const rows = await sql`
    SELECT id, lineage_key, archetype_name, depth_summary, people_circumstances, created_at
    FROM myth_reading
    WHERE user_id = ${userId}
    ORDER BY created_at DESC
    LIMIT ${limit}
  `;
  return rows.map(rowToEntry);
}

/** How many times each archetype has appeared, most-frequent first. */
export async function getArchetypeArc(userId: number): Promise<ArchetypeArcEntry[]> {
  const rows = await sql`
    SELECT archetype_name, count(*)::int AS n, min(created_at) AS first_seen, max(created_at) AS last_seen
    FROM myth_reading
    WHERE user_id = ${userId} AND archetype_name IS NOT NULL
    GROUP BY archetype_name
    ORDER BY n DESC
  `;
  return rows.map((row: any) => ({
    archetypeName: row.archetype_name,
    count: Number(row.n),
    firstSeen: row.first_seen,
    lastSeen: row.last_seen,
  }));
}

/** Most recent reading in a given lineage — the substrate for within-lineage recall. */
export async function getMostRecentForLineage(
  userId: number,
  lineageKey: string
): Promise<MythReadingRow | null> {
  const rows = await sql`
    SELECT id, lineage_key, archetype_name, depth_summary, people_circumstances, created_at
    FROM myth_reading
    WHERE user_id = ${userId} AND lineage_key = ${lineageKey}
    ORDER BY created_at DESC
    LIMIT 1
  `;
  return rows.length > 0 ? rowToEntry(rows[0]) : null;
}

/** Release the entire reading log for this seeker (whole-journal release). Loud on failure. */
export async function deleteAllMythReadings(userId: number): Promise<number> {
  const rows = await sql`
    DELETE FROM myth_reading WHERE user_id = ${userId} RETURNING id
  `;
  return rows.length;
}
