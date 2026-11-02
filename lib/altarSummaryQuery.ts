/**
 * altarSummaryQuery.ts
 *
 * The one query behind the operator summary, shared by the admin route and the
 * CLI so they cannot drift apart. It takes the sql function as an argument
 * (no module-level connection), and — deliberately — never selects user_id:
 * an aggregate that cannot see who said what cannot leak it.
 */

import type { neon } from '@neondatabase/serverless';
import type { SignalRow } from '@/lib/altarSummary';

type Sql = ReturnType<typeof neon>;

export const DEFAULT_DAYS = 90;
export const MAX_DAYS = 730;
/** Hard cap so a very long window can never become an unbounded read. */
export const MAX_ROWS = 50_000;

/** Parse a `days` query parameter: a whole number in [1, MAX_DAYS], else the default. */
export function parseDays(raw: string | null | undefined): number {
  if (raw == null || raw.trim() === '') return DEFAULT_DAYS;
  const n = Number(raw);
  if (!Number.isFinite(n)) return DEFAULT_DAYS;
  return Math.min(MAX_DAYS, Math.max(1, Math.floor(n)));
}

export async function fetchSignalRows(sql: Sql, days: number): Promise<SignalRow[]> {
  const rows = await sql`
    SELECT lineage, signal, nahual, corpus_version, model_version, contract_version, created_at
    FROM altar_record
    WHERE created_at > now() - (${days}::int * interval '1 day')
    ORDER BY created_at ASC
    LIMIT ${MAX_ROWS}
  `;
  return rows as unknown as SignalRow[];
}
