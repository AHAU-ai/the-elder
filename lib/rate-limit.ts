/**
 * Rate limiter — Neon Postgres-backed when DATABASE_URL is set
 * (lib/rateLimitLedger.ts, migrations/019_rate_limit_bucket.sql), falling
 * back to an in-memory Map otherwise (local dev without a DB) or on any DB
 * error (never let this ancillary check take the whole app down for an
 * unrelated outage — same fail-open posture as every other *Ledger.ts file
 * in this codebase).
 *
 * The in-memory fallback resets on every serverless cold start and is
 * fragmented across concurrent warm instances — accepted there as a
 * best-effort safety net, not the primary guarantee anymore.
 */

import { checkRateLimitDB } from './rateLimitLedger';

const WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours

type Record = { count: number; firstHit: number };

const buckets = new Map<string, Record>();

function checkRateLimitInMemory(ip: string, limit: number): {
  allowed: boolean;
  remaining: number;
  resetIn: number;
} {
  const now = Date.now();
  const existing = buckets.get(ip);

  // Fresh or expired bucket
  if (!existing || now - existing.firstHit > WINDOW_MS) {
    buckets.set(ip, { count: 1, firstHit: now });
    return { allowed: true, remaining: limit - 1, resetIn: WINDOW_MS };
  }

  // Within window
  if (existing.count >= limit) {
    return {
      allowed: false,
      remaining: 0,
      resetIn: WINDOW_MS - (now - existing.firstHit),
    };
  }

  existing.count += 1;
  return {
    allowed: true,
    remaining: limit - existing.count,
    resetIn: WINDOW_MS - (now - existing.firstHit),
  };
}

export async function checkRateLimit(ip: string, limit: number): Promise<{
  allowed: boolean;
  remaining: number;
  resetIn: number;
}> {
  if (!process.env.DATABASE_URL) {
    return checkRateLimitInMemory(ip, limit);
  }
  try {
    return await checkRateLimitDB(ip, limit);
  } catch (err) {
    console.error('[rate-limit] DB check failed, falling back to in-memory:', err);
    return checkRateLimitInMemory(ip, limit);
  }
}

export function getClientIP(headers: Headers): string {
  // Vercel forwards the real IP in x-forwarded-for
  const fwd = headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0].trim();

  const real = headers.get('x-real-ip');
  if (real) return real.trim();

  return 'unknown';
}
