import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { setSessionCookie } from '@/lib/auth';

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

    const userRows = await sql`
      INSERT INTO elder_user (email) VALUES (${email})
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
