/**
 * Simple in-memory rate limiter.
 *
 * Tracks requests per IP per 24-hour rolling window.
 * Resets when the serverless function cold-starts, which happens
 * frequently on Vercel's free tier — this is a feature, not a bug,
 * for the public/rate-limited use case. Keeps things free.
 *
 * For stricter persistent limits, swap this for Vercel KV or Upstash Redis.
 */

const WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours

type Record = { count: number; firstHit: number };

const buckets = new Map<string, Record>();

export function checkRateLimit(ip: string, limit: number): {
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

export function getClientIP(headers: Headers): string {
  // Vercel forwards the real IP in x-forwarded-for
  const fwd = headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0].trim();

  const real = headers.get('x-real-ip');
  if (real) return real.trim();

  return 'unknown';
}
