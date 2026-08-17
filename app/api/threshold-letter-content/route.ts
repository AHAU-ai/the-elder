import { NextRequest, NextResponse } from 'next/server';
import { getThresholdLetterContent } from '@/lib/mythopoetics/thresholdLetter';
import type { VoiceKey } from '@/src/resilience/flags';

// Thin wrapper over a pure, deterministic function (no DB, no secrets) --
// exists so ThresholdLetter.tsx can fetch one voice's four-line content
// instead of importing lib/psychopompLayer.ts directly, which would pull
// ~110KB of every lineage's full mythological content into the client
// bundle just to read four short strings for the current voice. Nothing
// here is more exposed than before: this is the same content the
// component was already rendering client-side, just served instead of
// bundled. Unknown/invalid voice values fall through to
// getThresholdLetterContent's own generic fallback rather than erroring.
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const voice = req.nextUrl.searchParams.get('voice');
  if (!voice) {
    return NextResponse.json({ error: 'missing voice' }, { status: 400 });
  }
  const content = getThresholdLetterContent(voice as VoiceKey);
  return NextResponse.json(content);
}
