/**
 * thresholdLetterLedger.ts
 *
 * Persists the Threshold Letter — the four-line closing sequence
 * (volatilization / return / gift / image) a seeker is given when they
 * choose to keep it — keyed by user. Only written on that deliberate
 * "Keep This Gift" gesture, never silently on every completed reading;
 * a returning seeker's kept letters, newest first, up to 20 per user —
 * the oldest is evicted to make room.
 *
 * Fails closed like mythLedger.ts / consentLedger.ts: any DB error here
 * must never break the closing screen it's attached to, so callers wrap
 * these in try/catch and swallow failures.
 */

import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);

const MAX_LETTERS_PER_USER = 20;

export interface ThresholdLetterEntry {
  id: number;
  lineageKey: string;
  volatilizationPhrase: string;
  returnPhrase: string;
  returnGift: string;
  thresholdImage: string;
  createdAt: string;
  marker: string | null;
}

function rowToEntry(row: any): ThresholdLetterEntry {
  return {
    id: Number(row.id),
    lineageKey: row.lineage_key,
    volatilizationPhrase: row.volatilization_phrase,
    returnPhrase: row.return_phrase,
    returnGift: row.return_gift,
    thresholdImage: row.threshold_image,
    createdAt: row.created_at,
    marker: row.marker,
  };
}

/** All kept Threshold Letters for a user, newest-first. */
export async function getUserThresholdLetters(userId: number): Promise<ThresholdLetterEntry[]> {
  const rows = await sql`
    SELECT id, lineage_key, volatilization_phrase, return_phrase, return_gift, threshold_image, created_at, marker
    FROM threshold_letter
    WHERE user_id = ${userId}
    ORDER BY created_at DESC
    LIMIT ${MAX_LETTERS_PER_USER}
  `;
  return rows.map(rowToEntry);
}

/**
 * Save a kept Threshold Letter for a user, evicting the oldest (by
 * created_at) first if already at the cap. Each keep is its own row —
 * unlike myth_archetype, letters are not merged/deepened over time,
 * since each one closes a specific reading.
 */
export async function saveThresholdLetter(
  userId: number,
  lineageKey: string,
  volatilizationPhrase: string,
  returnPhrase: string,
  returnGift: string,
  thresholdImage: string,
  marker: string | null = null,
  chainId: string | null = null
): Promise<void> {
  const gift = returnGift.trim();
  if (!gift) return;

  // Insert-then-trim-excess in one transaction so concurrent callers for the
  // same user can't both pass a stale count check and push the row count
  // past MAX_LETTERS_PER_USER (the previous count/delete/insert as separate
  // round-trips was racy under concurrent requests).
  await sql.transaction([
    sql`
      INSERT INTO threshold_letter
        (user_id, lineage_key, volatilization_phrase, return_phrase, return_gift, threshold_image, marker, chain_id)
      VALUES
        (${userId}, ${lineageKey}, ${volatilizationPhrase}, ${returnPhrase}, ${gift}, ${thresholdImage}, ${marker}, ${chainId})
    `,
    sql`
      DELETE FROM threshold_letter
      WHERE user_id = ${userId}
        AND id NOT IN (
          SELECT id FROM threshold_letter
          WHERE user_id = ${userId}
          ORDER BY created_at DESC
          LIMIT ${MAX_LETTERS_PER_USER}
        )
    `,
  ]);
}
