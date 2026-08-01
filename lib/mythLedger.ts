/**
 * mythLedger.ts
 *
 * Persists the archetype(s) a seeker's myth has named, keyed by
 * (user, archetype name). Continuing a myth appends new depth to the
 * existing row; a genuinely new archetype takes a new row, up to 13 per
 * user — the oldest (by updated_at) is evicted to make room, so an active
 * seeker's living archetypes are never crowded out by one they've moved
 * past.
 *
 * Fails closed like consentLedger.ts: any DB error here must never break
 * the reading response it's attached to, so callers wrap these in
 * try/catch and swallow failures.
 */

import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);

const MAX_ARCHETYPES_PER_USER = 13;

export interface MythEntry {
  id: number;
  lineageKey: string;
  archetypeName: string;
  summary: string;
  peopleCircumstances: string;
  readingCount: number;
  updatedAt: string;
}

function rowToEntry(row: any): MythEntry {
  return {
    id: Number(row.id),
    lineageKey: row.lineage_key,
    archetypeName: row.archetype_name,
    summary: row.summary,
    peopleCircumstances: row.people_circumstances,
    readingCount: row.reading_count,
    updatedAt: row.updated_at,
  };
}

/** All stored myths for a user, newest-first. */
export async function getUserMyths(userId: number): Promise<MythEntry[]> {
  const rows = await sql`
    SELECT id, lineage_key, archetype_name, summary, people_circumstances, reading_count, updated_at
    FROM myth_archetype
    WHERE user_id = ${userId}
    ORDER BY updated_at DESC
    LIMIT ${MAX_ARCHETYPES_PER_USER}
  `;
  return rows.map(rowToEntry);
}

/**
 * Record a newly-named or newly-deepened archetype for a user.
 * New archetype name -> new row (evicting the LRU row first if at the cap).
 * Existing archetype name (case-insensitive) -> appends depth in place.
 */
export async function upsertMythArchetype(
  userId: number,
  lineageKey: string,
  archetypeName: string,
  depthAddition: string,
  peopleAddition: string
): Promise<void> {
  const name = archetypeName.trim();
  if (!name) return;

  const existing = await sql`
    SELECT id FROM myth_archetype
    WHERE user_id = ${userId} AND lower(archetype_name) = lower(${name})
    LIMIT 1
  `;

  if (existing.length > 0) {
    await sql`
      UPDATE myth_archetype
      SET
        summary = CASE WHEN length(summary) = 0 THEN ${depthAddition}
                        ELSE summary || E'\n\n' || ${depthAddition} END,
        people_circumstances = CASE WHEN length(${peopleAddition}) = 0 THEN people_circumstances
                        WHEN length(people_circumstances) = 0 THEN ${peopleAddition}
                        ELSE people_circumstances || E'\n\n' || ${peopleAddition} END,
        reading_count = reading_count + 1,
        updated_at = now()
      WHERE id = ${existing[0].id}
    `;
    return;
  }

  const count = await sql`SELECT count(*)::int AS n FROM myth_archetype WHERE user_id = ${userId}`;
  if (count[0].n >= MAX_ARCHETYPES_PER_USER) {
    await sql`
      DELETE FROM myth_archetype
      WHERE id = (
        SELECT id FROM myth_archetype
        WHERE user_id = ${userId}
        ORDER BY updated_at ASC
        LIMIT 1
      )
    `;
  }

  await sql`
    INSERT INTO myth_archetype (user_id, lineage_key, archetype_name, summary, people_circumstances, reading_count)
    VALUES (${userId}, ${lineageKey}, ${name}, ${depthAddition}, ${peopleAddition}, 1)
    ON CONFLICT (user_id, (lower(archetype_name))) DO UPDATE SET
      summary = CASE WHEN length(myth_archetype.summary) = 0 THEN excluded.summary
                      ELSE myth_archetype.summary || E'\n\n' || excluded.summary END,
      people_circumstances = CASE WHEN length(excluded.people_circumstances) = 0 THEN myth_archetype.people_circumstances
                      WHEN length(myth_archetype.people_circumstances) = 0 THEN excluded.people_circumstances
                      ELSE myth_archetype.people_circumstances || E'\n\n' || excluded.people_circumstances END,
      reading_count = myth_archetype.reading_count + 1,
      updated_at = now()
  `;
}
