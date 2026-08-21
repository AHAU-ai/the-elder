import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { randomBytes } from 'crypto';
import { checkRateLimit, getClientIP } from '@/lib/rate-limit';
import { sendMagicLink } from '@/lib/email';

export const runtime = 'nodejs';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TOKEN_TTL_MS = 15 * 60 * 1000;

// Generic response either way — never reveal whether an email is known,
// whether the DB is reachable, or whether sending succeeded.
const GENERIC_RESPONSE = {
  ok: true,
  message: 'If that address is yours, a thread back to the fire is on its way.',
};

export async function POST(req: NextRequest) {
  let body: { email?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON in request body.' }, { status: 400 });
  }

  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  if (!email || !EMAIL_RE.test(email) || email.length > 200) {
    return NextResponse.json({ error: 'That does not look like an email address.' }, { status: 400 });
  }

  const ip = getClientIP(req.headers);
  const rl = await checkRateLimit(`auth:${ip}`, 5);
  if (!rl.allowed) {
    // Still generic — a rate-limited attacker learns nothing new.
    return NextResponse.json(GENERIC_RESPONSE, { status: 200 });
  }

  if (!process.env.DATABASE_URL) {
    console.error('[auth/request] DATABASE_URL not configured.');
    return NextResponse.json(GENERIC_RESPONSE, { status: 200 });
  }

  try {
    const sql = neon(process.env.DATABASE_URL);
    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + TOKEN_TTL_MS).toISOString();

    await sql`
      INSERT INTO elder_login_token (token, email, expires_at)
      VALUES (${token}, ${email}, ${expiresAt})
    `;

    const origin = req.nextUrl.origin;
    const link = `${origin}/api/auth/verify?token=${token}`;
    await sendMagicLink(email, link);
  } catch (err) {
    console.error('[auth/request] Failed to create/send login token:', err);
  }

  return NextResponse.json(GENERIC_RESPONSE, { status: 200 });
}
