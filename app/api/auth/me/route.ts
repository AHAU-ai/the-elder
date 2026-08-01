import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { getSessionUserId } from '@/lib/auth';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const userId = getSessionUserId(req);
  if (!userId || !process.env.DATABASE_URL) {
    return NextResponse.json({ email: null });
  }

  try {
    const sql = neon(process.env.DATABASE_URL);
    const rows = await sql`SELECT email FROM elder_user WHERE id = ${userId} LIMIT 1`;
    if (rows.length === 0) return NextResponse.json({ email: null });
    return NextResponse.json({ email: rows[0].email });
  } catch (err) {
    console.error('[auth/me] Failed to look up user:', err);
    return NextResponse.json({ email: null });
  }
}
