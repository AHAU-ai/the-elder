// app/api/figure-mappings/release/route.ts
//
// Release pairings: all of the session user's (no body, or an empty one), or
// those of one chain ({ chainId }). Deletes mappings and pending offers alike.
// Spec G12: this exists, and works whether or not the feature is lit, before
// the flag can flip. Deliberately NOT rate limited -- a seeker must always be
// able to take their third-party descriptions back. Fails loud: a database
// failure is a 500, never a silent "released".
import { NextRequest, NextResponse } from 'next/server';
import { getSessionUserId } from '@/lib/auth';
import { releaseAllMappings, releaseMappingsForChain } from '@/lib/returning/figureMapping';

export const runtime = 'nodejs';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function DELETE(req: NextRequest) {
  const userId = getSessionUserId(req);
  if (!userId) return NextResponse.json({ error: 'not_signed_in' }, { status: 401 });
  if (!process.env.DATABASE_URL) return NextResponse.json({ error: 'release_failed' }, { status: 500 });

  let chainId: string | null = null;
  const text = await req.text();
  if (text.trim().length > 0) {
    let body: { chainId?: unknown };
    try { body = JSON.parse(text); } catch {
      return NextResponse.json({ error: 'bad_request' }, { status: 400 });
    }
    if (body === null || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json({ error: 'bad_request' }, { status: 400 });
    }
    if (body.chainId !== undefined) {
      if (typeof body.chainId !== 'string' || !UUID_RE.test(body.chainId)) {
        return NextResponse.json({ error: 'bad_request' }, { status: 400 });
      }
      chainId = body.chainId;
    }
  }

  const result = chainId
    ? await releaseMappingsForChain(userId, chainId)
    : await releaseAllMappings(userId);
  if (!result.ok) return NextResponse.json({ error: 'release_failed' }, { status: 500 });
  return NextResponse.json({ released: result.count });
}
