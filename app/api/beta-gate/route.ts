import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  let body: { passphrase?: string; next?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }

  const expected = process.env.BETA_ACCESS_PASSPHRASE;
  if (!expected) {
    return NextResponse.json(
      { error: 'Server is missing BETA_ACCESS_PASSPHRASE environment variable.' },
      { status: 500 }
    );
  }

  if (body.passphrase !== expected) {
    return NextResponse.json({ error: 'Incorrect passphrase.' }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set('elder_beta_access', 'granted', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30, // 30 days
    path: '/',
  });
  return res;
}
