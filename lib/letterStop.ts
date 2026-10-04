// lib/letterStop.ts
//
// The one-click stop in every letter email (M4). A signed, expiring token that
// carries only a user id and the single thing it can do: turn letters-by-email
// off. It cannot sign anyone in, read anything, or do anything else.
//
// The payload is purpose-prefixed ("letters-stop:") before signing, so a
// session cookie (lib/auth.ts, same secret) can never be replayed as a stop
// token or the reverse. Stopping is the safe direction to be wrong in: if a
// mail scanner pre-fetches the link, the worst outcome is that letters stop.
//
// Sign/verify are pure given their inputs (key and clock are parameters) so
// they are unit-tested without environment or time. The route supplies both.

import { createHmac, timingSafeEqual } from 'crypto';

const PURPOSE = 'letters-stop';

/**
 * The signing key for stop links. A dedicated ELDER_LETTER_STOP_SECRET is
 * preferred: stop links live in emails that are opened months later, and the
 * session secret is the one an operator might rotate (which would silently kill
 * every stop link already sent). Falls back to ELDER_SESSION_SECRET so nothing
 * needs configuring to work -- but set the dedicated one and do not rotate it
 * casually. Null when neither is set (emails then omit the stop link).
 */
export function letterStopKey(env: Record<string, string | undefined> = process.env): string | null {
  return env.ELDER_LETTER_STOP_SECRET || env.ELDER_SESSION_SECRET || null;
}
/** Long on purpose: people act on a letter email weeks later. */
export const STOP_TOKEN_TTL_DAYS = 400;

function mac(payload: string, key: string): string {
  return createHmac('sha256', key).update(`${PURPOSE}:${payload}`).digest('hex');
}

export function signStopToken(userId: number, key: string, nowMs: number): string {
  const expires = nowMs + STOP_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000;
  const payload = `${userId}.${expires}`;
  return `${payload}.${mac(payload, key)}`;
}

/** The user id the token stops letters for, or null if malformed/expired/forged. */
export function verifyStopToken(token: string | null | undefined, key: string, nowMs: number): number | null {
  if (!token || !key) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [userIdRaw, expiresRaw, sig] = parts;
  const expected = mac(`${userIdRaw}.${expiresRaw}`, key);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  const expires = Number(expiresRaw);
  if (!Number.isFinite(expires) || nowMs > expires) return null;
  const userId = Number(userIdRaw);
  return Number.isInteger(userId) && userId > 0 ? userId : null;
}
