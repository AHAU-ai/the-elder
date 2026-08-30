import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { setSessionCookie } from '@/lib/auth';
import { getReferralSource } from '@/lib/referral';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token');
  const origin = req.nextUrl.origin;

  if (!token || !process.env.DATABASE_URL) {
    return NextResponse.redirect(`${origin}/?authError=1`);
  }

  try {
    const sql = neon(process.env.DATABASE_URL);

    const rows = await sql`
      SELECT id, email FROM elder_login_token
      WHERE token = ${token} AND used_at IS NULL AND expires_at > now()
      LIMIT 1
    `;
    if (rows.length === 0) {
      return NextResponse.redirect(`${origin}/?authError=1`);
    }
    const { id: tokenId, email } = rows[0];

    await sql`UPDATE elder_login_token SET used_at = now() WHERE id = ${tokenId}`;

    // §Acquisition attribution (lib/referral.ts) -- first-touch only.
    // referral_source/referred_at are in the INSERT's VALUES but
    // deliberately absent from the DO UPDATE SET clause below: on a
    // fresh account they get written once; on a conflict (an existing
    // seeker signing in again, possibly via a different link entirely)
    // Postgres leaves them at whatever was already stored. That's the
    // whole mechanism -- no separate "already attributed" check needed.
    const referralSource = getReferralSource(req);
    const userRows = await sql`
      INSERT INTO elder_user (email, referral_source, referred_at)
      VALUES (${email}, ${referralSource}, ${referralSource ? new Date().toISOString() : null})
      ON CONFLICT (email) DO UPDATE SET email = excluded.email
      RETURNING id
    `;
    const userId = Number(userRows[0].id);

    const res = NextResponse.redirect(`${origin}/`);
    setSessionCookie(res, userId);
    return res;
  } catch (err) {
    console.error('[auth/verify] Failed to verify login token:', err);
    return NextResponse.redirect(`${origin}/?authError=1`);
  }
}
