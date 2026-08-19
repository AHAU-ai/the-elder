/**
 * shareLedger.ts
 *
 * A narrow, deliberate exception to ShareableCard.tsx's "nothing is sent
 * anywhere or stored" design — only the one quoted line + marker + voice +
 * optional dedication + provenance stamp is persisted, never full reading
 * text, and only when the sharer is signed in. Backs the public /share/[id]
 * view and the wordless-glyph response a viewer can leave for the sharer.
 *
 * provenance (added migrations/017_share_card_provenance.sql) is
 * provenanceMetadata()'s shape (src/resilience/provenance.ts) -- version/
 * config identifiers and retrieved-passage ids, never reading content --
 * so it doesn't strain the "never full reading text" guarantee above.
 * Nullable: older rows and any card kept without a provenance stamp
 * available both have it as NULL, meaning genuinely unknown, not empty.
 *
 * Fails closed like mythLedger.ts: any DB error here must never break the
 * card UI it's attached to.
 */

import { neon } from '@neondatabase/serverless';
import type { CardQuote } from './mythopoetics/cardConfig';

const sql = neon(process.env.DATABASE_URL!);

export interface ShareCardEntry {
  id: string;
  ownerUserId: number;
  line: CardQuote;
  marker: string;
  voiceKey: string;
  dedicatedTo: string;
  createdAt: string;
  provenance: Record<string, unknown> | null;
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
    // Cast, not a re-check: rows here were only ever written by
    // createShareCard below, which requires a CardQuote to write one.
    line: row.line as CardQuote,
    marker: row.marker,
    voiceKey: row.voice_key,
    dedicatedTo: row.dedicated_to,
    createdAt: row.created_at,
    provenance: row.provenance ?? null,
  };
}

export async function createShareCard(
  ownerUserId: number,
  line: CardQuote,
  marker: string,
  voiceKey: string,
  dedicatedTo: string,
  provenance: Record<string, unknown> | null = null
): Promise<string> {
  const rows = await sql`
    INSERT INTO share_card (owner_user_id, line, marker, voice_key, dedicated_to, provenance)
    VALUES (${ownerUserId}, ${line.slice(0, 500)}, ${marker}, ${voiceKey}, ${dedicatedTo.slice(0, 40)}, ${provenance ? JSON.stringify(provenance) : null})
    RETURNING id
  `;
  return rows[0].id;
}

export async function getShareCard(id: string): Promise<ShareCardEntry | null> {
  const rows = await sql`
    SELECT id, owner_user_id, line, marker, voice_key, dedicated_to, created_at, provenance
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
  if (cards.length === 0) return [];

  // One batched query instead of one getShareResponseCounts() call per
  // card -- was up to `limit` (20) sequential round trips for a single
  // Journal page load. Group rows by share_card_id in JS instead.
  const cardIds = cards.map((c: any) => c.id);
  const responseRows = await sql`
    SELECT share_card_id, marker, count(*)::int AS n
    FROM share_response
    WHERE share_card_id = ANY(${cardIds})
    GROUP BY share_card_id, marker
  `;
  const countsByCard = new Map<string, Record<string, number>>();
  responseRows.forEach((r: any) => {
    const counts = countsByCard.get(r.share_card_id) ?? {};
    counts[r.marker] = Number(r.n);
    countsByCard.set(r.share_card_id, counts);
  });

  return cards.map((card: any) => ({
    id: card.id,
    line: card.line,
    marker: card.marker,
    createdAt: card.created_at,
    responseCounts: countsByCard.get(card.id) ?? {},
  }));
}
