/**
 * auth.ts
 *
 * Stateless signed-cookie sessions for the optional "save my myth" account.
 * No session table: the cookie itself carries the user id, an expiry, and an
 * HMAC signature over both. Verification is pure and synchronous — no DB hit
 * needed just to know who's asking.
 *
 * This sits alongside consentLedger.ts's fail-closed philosophy: an unset
 * ELDER_SESSION_SECRET or a malformed/expired/tampered cookie all resolve to
 * "not signed in," never to a guessed or default identity.
 */

import { createHmac, timingSafeEqual } from 'crypto';
import type { NextRequest, NextResponse } from 'next/server';

export const SESSION_COOKIE = 'elder_session';
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 180; // 180 days

function secret(): string | null {
  return process.env.ELDER_SESSION_SECRET || null;
}

function sign(payload: string, key: string): string {
  return createHmac('sha256', key).update(payload).digest('hex');
}

/** Build the session cookie value for a given user id. */
export function signSession(userId: number): string | null {
  const key = secret();
  if (!key) return null;
  const expires = Date.now() + SESSION_MAX_AGE_SECONDS * 1000;
  const payload = `${userId}.${expires}`;
  return `${payload}.${sign(payload, key)}`;
}

/** Verify a session cookie value, returning the user id or null. */
export function verifySession(cookieValue: string | undefined | null): number | null {
  const key = secret();
  if (!key || !cookieValue) return null;

  const parts = cookieValue.split('.');
  if (parts.length !== 3) return null;
  const [userIdRaw, expiresRaw, sig] = parts;
  const payload = `${userIdRaw}.${expiresRaw}`;
  const expected = sign(payload, key);

  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  const expires = Number(expiresRaw);
  if (!Number.isFinite(expires) || Date.now() > expires) return null;

  const userId = Number(userIdRaw);
  if (!Number.isFinite(userId) || userId <= 0) return null;

  return userId;
}

/** Read the signed-in user id from a route handler's request, or null. */
export function getSessionUserId(req: NextRequest): number | null {
  return verifySession(req.cookies.get(SESSION_COOKIE)?.value);
}

/** Attach a fresh session cookie to a response. No-op if secret is unset. */
export function setSessionCookie(res: NextResponse, userId: number): void {
  const value = signSession(userId);
  if (!value) return;
  res.cookies.set(SESSION_COOKIE, value, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

export function clearSessionCookie(res: NextResponse): void {
  res.cookies.set(SESSION_COOKIE, '', { path: '/', maxAge: 0 });
}
