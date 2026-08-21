/**
 * rateLimitLedger.ts
 *
 * DB-backed rate limiting (migrations/019_rate_limit_bucket.sql), replacing
 * lib/rate-limit.ts's in-memory Map as the primary path when DATABASE_URL
 * is set. The in-memory version resets on every serverless cold start and
 * is fragmented across concurrent warm instances -- on Vercel this meant a
 * "10 requests/day" cap was never actually a global per-IP guarantee, only
 * a per-instance one, silently and unmeasurably looser than the number in
 * the code.
 *
 * One row per key, reused (not append-only) across the 24h window and
 * reset in place once expired -- a single atomic UPSERT does both the
 * "fresh or expired -> reset" and "within window -> increment" cases in
 * one round trip, so concurrent requests for the same key can't race past
 * the same stale count the way two separate SELECT-then-UPDATE calls could.
 *
 * Callers must still fall back to the in-memory limiter on any DB error --
 * see lib/rate-limit.ts. This file only implements the DB path.
 */

import { neon, type NeonQueryFunction } from '@neondatabase/serverless';

let _sql: NeonQueryFunction<false, false> | null = null;
function sql(strings: TemplateStringsArray, ...values: unknown[]) {
  if (!_sql) _sql = neon(process.env.DATABASE_URL!);
  return _sql(strings, ...values);
}

const WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours, matches rate-limit.ts

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetIn: number;
}

export async function checkRateLimitDB(key: string, limit: number): Promise<RateLimitResult> {
  const windowSeconds = WINDOW_MS / 1000;
  const rows = await sql`
    INSERT INTO rate_limit_bucket (key, count, first_hit)
    VALUES (${key}, 1, now())
    ON CONFLICT (key) DO UPDATE SET
      count = CASE
        WHEN now() - rate_limit_bucket.first_hit > (${windowSeconds} || ' seconds')::interval
        THEN 1
        ELSE rate_limit_bucket.count + 1
      END,
      first_hit = CASE
        WHEN now() - rate_limit_bucket.first_hit > (${windowSeconds} || ' seconds')::interval
        THEN now()
        ELSE rate_limit_bucket.first_hit
      END
    RETURNING count, first_hit
  `;
  const row = rows[0] as { count: number; first_hit: string };
  const count = Number(row.count);
  const firstHit = new Date(row.first_hit).getTime();
  const resetIn = Math.max(0, WINDOW_MS - (Date.now() - firstHit));

  return {
    allowed: count <= limit,
    remaining: Math.max(0, limit - count),
    resetIn,
  };
}
