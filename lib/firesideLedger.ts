// lib/firesideLedger.ts
//
// DB access for fireside_entry (migrations/033_fireside_entry.sql). Every read
// and write is scoped by user_id in the query itself. Writes attached to a
// response fail closed (callers catch and say the exchange was not kept);
// releases are the opposite, user-initiated, so they fail LOUD.
import { sql } from './returning/db';
import { MAX_ENTRIES_PER_USER } from './fireside';

export interface FiresideEntry {
  id: number;
  seekerText: string;
  elderText: string;
  keptText: string | null;
  createdAt: string;
}

function rowToEntry(r: any): FiresideEntry {
  return {
    id: Number(r.id),
    seekerText: r.seeker_text,
    elderText: r.elder_text,
    keptText: r.kept_text ?? null,
    createdAt: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at),
  };
}

/** Newest first. */
export async function listFiresideEntries(userId: number, limit = 50): Promise<FiresideEntry[]> {
  const rows = await sql`
    SELECT id, seeker_text, elder_text, kept_text, created_at
    FROM fireside_entry
    WHERE user_id = ${userId}
    ORDER BY created_at DESC
    LIMIT ${limit}
  `;
  return rows.map(rowToEntry);
}

/**
 * Persist one completed exchange. At the cap, the oldest exchange the seeker
 * has NOT kept a line from is released to make room; a kept line is never
 * evicted, because it is a leaf on their Tree.
 */
export async function saveFiresideEntry(userId: number, seekerText: string, elderText: string): Promise<number> {
  await sql`
    DELETE FROM fireside_entry
    WHERE id IN (
      SELECT id FROM fireside_entry
      WHERE user_id = ${userId} AND kept_text IS NULL
      ORDER BY created_at ASC
      OFFSET ${MAX_ENTRIES_PER_USER - 1}
    )
  `;
  const [row] = await sql`
    INSERT INTO fireside_entry (user_id, seeker_text, elder_text)
    VALUES (${userId}, ${seekerText}, ${elderText})
    RETURNING id
  `;
  return Number(row.id);
}

/**
 * Keep one line, in the seeker's own words, from one of their own exchanges.
 * Returns false when the exchange is not theirs or does not exist. Replaces an
 * earlier kept line on the same exchange (their words, their edit).
 */
export async function keepFiresideLine(userId: number, entryId: number, line: string): Promise<boolean> {
  const rows = await sql`
    UPDATE fireside_entry
    SET kept_text = ${line}, kept_at = now()
    WHERE id = ${entryId} AND user_id = ${userId}
    RETURNING id
  `;
  return rows.length > 0;
}

/** Release one exchange (and with it any Tree leaf it carried). */
export async function releaseFiresideEntry(userId: number, entryId: number): Promise<boolean> {
  const rows = await sql`
    DELETE FROM fireside_entry WHERE id = ${entryId} AND user_id = ${userId} RETURNING id
  `;
  return rows.length > 0;
}

/** Release every exchange. Used by the journal's release-all. */
export async function releaseAllFiresideEntries(userId: number): Promise<number> {
  const rows = await sql`DELETE FROM fireside_entry WHERE user_id = ${userId} RETURNING id`;
  return rows.length;
}

/** The seeker's kept lines, oldest first, for the Tree. Their own words and nothing else. */
export async function keptFiresideLines(userId: number): Promise<{ id: number; line: string; createdAt: string }[]> {
  const rows = await sql`
    SELECT id, kept_text, kept_at
    FROM fireside_entry
    WHERE user_id = ${userId} AND kept_text IS NOT NULL
    ORDER BY kept_at ASC
  `;
  return rows.map((r: any) => ({
    id: Number(r.id),
    line: r.kept_text,
    createdAt: r.kept_at instanceof Date ? r.kept_at.toISOString() : String(r.kept_at),
  }));
}
