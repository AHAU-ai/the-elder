/**
 * journalSynthesisLedger.ts
 *
 * Caches the one synthesis passage per user so /api/journal doesn't call
 * the model on every page view — only once at least three new myth_reading
 * rows exist since the cached reading_count_at_synthesis (see route.ts for
 * the gate). Fails closed like mythLedger.ts.
 */

import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);

export interface JournalSynthesisEntry {
  synthesisText: string;
  readingCountAtSynthesis: number;
  createdAt: string;
}

export async function getCachedSynthesis(userId: number): Promise<JournalSynthesisEntry | null> {
  const rows = await sql`
    SELECT synthesis_text, reading_count_at_synthesis, created_at
    FROM journal_synthesis
    WHERE user_id = ${userId}
    LIMIT 1
  `;
  if (rows.length === 0) return null;
  return {
    synthesisText: rows[0].synthesis_text,
    readingCountAtSynthesis: rows[0].reading_count_at_synthesis,
    createdAt: rows[0].created_at,
  };
}

export async function saveSynthesis(userId: number, text: string, readingCount: number): Promise<void> {
  await sql`
    INSERT INTO journal_synthesis (user_id, synthesis_text, reading_count_at_synthesis)
    VALUES (${userId}, ${text}, ${readingCount})
    ON CONFLICT (user_id) DO UPDATE SET
      synthesis_text = excluded.synthesis_text,
      reading_count_at_synthesis = excluded.reading_count_at_synthesis,
      created_at = now()
  `;
}
