import { NextRequest, NextResponse } from 'next/server';
import { getBecomingContent } from '@/lib/mythopoetics/becoming';
import type { VoiceKey } from '@/src/resilience/flags';

// Same shape as app/api/threshold-letter-content/route.ts: a thin,
// pure, deterministic wrapper so Becoming.tsx doesn't need to import
// lib/mythopoetics/becoming.ts's full per-voice map into the client
// bundle. Unknown/invalid voice values fall through to
// getBecomingContent's own generic fallback rather than erroring.
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const voice = req.nextUrl.searchParams.get('voice');
  if (!voice) {
    return NextResponse.json({ error: 'missing voice' }, { status: 400 });
  }
  const content = getBecomingContent(voice as VoiceKey);
  return NextResponse.json(content);
}
