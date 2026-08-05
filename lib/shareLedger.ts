/**
 * shareLedger.ts
 *
 * A narrow, deliberate exception to ShareableCard.tsx's "nothing is sent
 * anywhere or stored" design — only the one quoted line + marker + voice +
 * optional dedication is persisted, never full reading text, and only when
 * the sharer is signed in. Backs the public /share/[id] view and the
 * wordless-glyph response a viewer can leave for the sharer.
 *
 * Fails closed like mythLedger.ts: any DB error here must never break the
 * card UI it's attached to.
 */

import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);

export interface ShareCardEntry {
  id: string;
  ownerUserId: number;
  line: string;
  marker: string;
  voiceKey: string;
  dedicatedTo: string;
  createdAt: string;
}

export interface ShareWithResponses {
  id: string;
  line: string;
  marker: string;
  createdAt: string;
  responseCounts: Record<string, number>;
}

function rowToEntry(row: any): ShareCardEntry {
  return {
    id: row.id,
    ownerUserId: Number(row.owner_user_id),
    line: row.line,
    marker: row.marker,
    voiceKey: row.voice_key,
    dedicatedTo: row.dedicated_to,
    createdAt: row.created_at,
  };
}

export async function createShareCard(
  ownerUserId: number,
  line: string,
  marker: string,
  voiceKey: string,
  dedicatedTo: string
): Promise<string> {
  const rows = await sql`
    INSERT INTO share_card (owner_user_id, line, marker, voice_key, dedicated_to)
    VALUES (${ownerUserId}, ${line.slice(0, 500)}, ${marker}, ${voiceKey}, ${dedicatedTo.slice(0, 40)})
    RETURNING id
  `;
  return rows[0].id;
}

export async function getShareCard(id: string): Promise<ShareCardEntry | null> {
  const rows = await sql`
    SELECT id, owner_user_id, line, marker, voice_key, dedicated_to, created_at
    FROM share_card
    WHERE id = ${id}
    LIMIT 1
  `;
  return rows.length > 0 ? rowToEntry(rows[0]) : null;
}

export async function addShareResponse(shareCardId: string, marker: string): Promise<void> {
  await sql`
    INSERT INTO share_response (share_card_id, marker)
    VALUES (${shareCardId}, ${marker})
  `;
}

export async function getShareResponseCounts(shareCardId: string): Promise<Record<string, number>> {
  const rows = await sql`
    SELECT marker, count(*)::int AS n
    FROM share_response
    WHERE share_card_id = ${shareCardId}
    GROUP BY marker
  `;
  const counts: Record<string, number> = {};
  rows.forEach((r: any) => { counts[r.marker] = Number(r.n); });
  return counts;
}

/** All of a user's shares, newest-first, each with its response counts — for the Journal. */
export async function getUserShares(ownerUserId: number, limit = 20): Promise<ShareWithResponses[]> {
  const cards = await sql`
    SELECT id, line, marker, created_at
    FROM share_card
    WHERE owner_user_id = ${ownerUserId}
    ORDER BY created_at DESC
    LIMIT ${limit}
  `;
  const results: ShareWithResponses[] = [];
  for (const card of cards) {
    const responseCounts = await getShareResponseCounts(card.id);
    results.push({ id: card.id, line: card.line, marker: card.marker, createdAt: card.created_at, responseCounts });
  }
  return results;
}
