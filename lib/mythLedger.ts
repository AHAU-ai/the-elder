/**
 * mythLedger.ts
 *
 * Persists ONE archetype per (user, lineage) — migration 026 moved the
 * unique key from (user, archetype name) to (user, lineage_key), so a
 * lineage's archetype is now a fixed identity, not just whatever name
 * happened to repeat. First reading in a lineage names it (system-prompt-
 * builder.ts picks from that lineage's catalog); every reading after
 * restates it and only ever deepens the existing row — the archetype
 * name itself is immutable once a lineage has one, exactly the guarantee
 * Lineage Integrity of Voice already makes about content: this is the
 * same principle applied to the seeker's own archetype identity. Up to
 * 13 lineage-slots per user — the oldest (by updated_at) is evicted to
 * make room, so an active seeker's living archetypes are never crowded
 * out by one they've moved past.
 *
 * Depth stage (surface -> confronted -> integrated) is v1: a pure
 * reading_count threshold, auto-advanced here with no seeker
 * confirmation step -- unlike marker_trajectory's propose/ratify shape
 * (migration 021), this is a simpler first pass. Forward/hold only,
 * same as markers, so a seeker never regresses.
 *
 * Fails closed like consentLedger.ts: any DB error here must never break
 * the reading response it's attached to, so callers wrap these in
 * try/catch and swallow failures.
 */

import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);

const MAX_ARCHETYPES_PER_USER = 13;

export type ArchetypeDepthStage = 'surface' | 'confronted' | 'integrated';

// v1, count-only, auto-advance -- see migration 026's doc comment for why
// these numbers (not markerTrajectory.ts's reshape-based 1/3): reading_count
// increments on every reading in the lineage, a much higher-frequency
// signal than a marker's reshape_count, so the thresholds sit higher.
export const CONFRONTED_AT_READING_COUNT = 3;
export const INTEGRATED_AT_READING_COUNT = 6;

export function computeArchetypeStage(
  oldStage: ArchetypeDepthStage,
  readingCount: number
): ArchetypeDepthStage {
  if (oldStage === 'integrated') return 'integrated';
  if (readingCount >= INTEGRATED_AT_READING_COUNT) return 'integrated';
  if (readingCount >= CONFRONTED_AT_READING_COUNT) return 'confronted';
  return 'surface';
}

export interface MythEntry {
  id: number;
  lineageKey: string;
  archetypeName: string;
  summary: string;
  peopleCircumstances: string;
  readingCount: number;
  depthStage: ArchetypeDepthStage;
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
    depthStage: row.depth_stage,
    updatedAt: row.updated_at,
  };
}

/** All stored myths for a user, newest-first. */
export async function getUserMyths(userId: number): Promise<MythEntry[]> {
  const rows = await sql`
    SELECT id, lineage_key, archetype_name, summary, people_circumstances, reading_count, depth_stage, updated_at
    FROM myth_archetype
    WHERE user_id = ${userId}
    ORDER BY updated_at DESC
    LIMIT ${MAX_ARCHETYPES_PER_USER}
  `;
  return rows.map(rowToEntry);
}

/** This user's already-named archetype for one lineage, if any. Null if the lineage has no archetype yet. */
export async function getLineageArchetype(userId: number, lineageKey: string): Promise<MythEntry | null> {
  const rows = await sql`
    SELECT id, lineage_key, archetype_name, summary, people_circumstances, reading_count, depth_stage, updated_at
    FROM myth_archetype
    WHERE user_id = ${userId} AND lineage_key = ${lineageKey}
    LIMIT 1
  `;
  return rows.length > 0 ? rowToEntry(rows[0]) : null;
}

/**
 * Renders an existing lineage archetype into the priorMythContext string
 * buildSystemPrompt consumes, the same role renderChainContext plays for a
 * live deepen chain -- so a lineage's identity persists across separate
 * chains/sittings, not just within one.
 */
export function renderLineageArchetypeContext(entry: MythEntry): string {
  const stageLine = entry.depthStage !== 'surface' ? ` (${entry.depthStage})` : '';
  const people = entry.peopleCircumstances ? `\nPeople/circumstances named so far: ${entry.peopleCircumstances}` : '';
  return `Archetype already named for this seeker in this lineage: "${entry.archetypeName}"${stageLine}.\nWhat has been seen so far: ${entry.summary}${people}`;
}

/**
 * Record a newly-named or newly-deepened archetype for a user's lineage.
 * New lineage for this user -> new row (evicting the LRU row first if at
 * the cap), named from archetypeName. Existing lineage -> the name is
 * NEVER changed (archetypeName here is ignored once a row exists — the
 * model was already instructed to restate it exactly, this is just the
 * enforcement backstop); only summary/people/reading_count/depth_stage
 * advance.
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
    SELECT id, reading_count, depth_stage FROM myth_archetype
    WHERE user_id = ${userId} AND lineage_key = ${lineageKey}
    LIMIT 1
  `;

  if (existing.length > 0) {
    const newReadingCount = Number(existing[0].reading_count) + 1;
    const newStage = computeArchetypeStage(existing[0].depth_stage as ArchetypeDepthStage, newReadingCount);
    await sql`
      UPDATE myth_archetype
      SET
        summary = CASE WHEN length(summary) = 0 THEN ${depthAddition}
                        ELSE summary || E'\n\n' || ${depthAddition} END,
        people_circumstances = CASE WHEN length(${peopleAddition}) = 0 THEN people_circumstances
                        WHEN length(people_circumstances) = 0 THEN ${peopleAddition}
                        ELSE people_circumstances || E'\n\n' || ${peopleAddition} END,
        reading_count = ${newReadingCount},
        depth_stage = ${newStage},
        depth_stage_updated_at = CASE WHEN ${newStage} <> depth_stage THEN now() ELSE depth_stage_updated_at END,
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
    ON CONFLICT (user_id, lineage_key) DO UPDATE SET
      summary = CASE WHEN length(myth_archetype.summary) = 0 THEN excluded.summary
                      ELSE myth_archetype.summary || E'\n\n' || excluded.summary END,
      people_circumstances = CASE WHEN length(excluded.people_circumstances) = 0 THEN myth_archetype.people_circumstances
                      WHEN length(myth_archetype.people_circumstances) = 0 THEN excluded.people_circumstances
                      ELSE myth_archetype.people_circumstances || E'\n\n' || excluded.people_circumstances END,
      reading_count = myth_archetype.reading_count + 1,
      updated_at = now()
  `;
}

/** Release every merged archetype for this seeker (whole-journal release). Loud on failure. */
export async function deleteAllMythArchetypes(userId: number): Promise<number> {
  const rows = await sql`
    DELETE FROM myth_archetype WHERE user_id = ${userId} RETURNING id
  `;
  return rows.length;
}
