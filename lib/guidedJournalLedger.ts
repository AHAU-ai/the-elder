/**
 * guidedJournalLedger.ts
 *
 * Persists guided journal entries — a seeker's own written reflection,
 * offered once right after a reading is kept as a Shareable Card
 * (migrations/018_guided_journal_entry.sql). Distinct from
 * journalSynthesisLedger.ts (model-generated, cross-reading) and
 * mythLedger.ts (the myth itself): this is unedited seeker prose, tied
 * to one specific reading.
 *
 * Fails closed like thresholdLetterLedger.ts / mythLedger.ts: any DB
 * error here must never break the reading screen it's attached to, so
 * callers wrap these in try/catch and swallow failures.
 */

import { neon, type NeonQueryFunction } from '@neondatabase/serverless';

let _sql: NeonQueryFunction<false, false> | null = null;
function sql(strings: TemplateStringsArray, ...values: unknown[]) {
  if (!_sql) _sql = neon(process.env.DATABASE_URL!);
  return _sql(strings, ...values);
}
sql.transaction = (queries: any[]) => {
  if (!_sql) _sql = neon(process.env.DATABASE_URL!);
  return (_sql as any).transaction(queries);
};

const MAX_ENTRIES_PER_USER = 100;

export interface GuidedJournalEntry {
  id: number;
  lineageKey: string;
  marker: string | null;
  prompt: string;
  response: string;
  createdAt: string;
}

function rowToEntry(row: any): GuidedJournalEntry {
  return {
    id: Number(row.id),
    lineageKey: row.lineage_key,
    marker: row.marker,
    prompt: row.prompt,
    response: row.response,
    createdAt: row.created_at,
  };
}

export async function getUserGuidedJournalEntries(userId: number): Promise<GuidedJournalEntry[]> {
  const rows = await sql`
    SELECT id, lineage_key, marker, prompt, response, created_at
    FROM guided_journal_entry
    WHERE user_id = ${userId}
    ORDER BY created_at DESC
    LIMIT ${MAX_ENTRIES_PER_USER}
  `;
  return rows.map(rowToEntry);
}

/**
 * Save one guided journal entry, evicting the oldest first if already at
 * the cap. Each reflection is its own row — never merged/edited later.
 */
export async function saveGuidedJournalEntry(
  userId: number,
  lineageKey: string,
  prompt: string,
  response: string,
  marker: string | null = null
): Promise<void> {
  const text = response.trim();
  if (!text) return;

  await sql.transaction([
    sql`
      INSERT INTO guided_journal_entry (user_id, lineage_key, marker, prompt, response)
      VALUES (${userId}, ${lineageKey}, ${marker}, ${prompt}, ${text})
    `,
    sql`
      DELETE FROM guided_journal_entry
      WHERE user_id = ${userId}
        AND id NOT IN (
          SELECT id FROM guided_journal_entry
          WHERE user_id = ${userId}
          ORDER BY created_at DESC
          LIMIT ${MAX_ENTRIES_PER_USER}
        )
    `,
  ]);
}
