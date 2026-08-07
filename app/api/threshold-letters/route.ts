import { NextRequest, NextResponse } from 'next/server';
import { getSessionUserId } from '@/lib/auth';
import { getUserThresholdLetters, saveThresholdLetter } from '@/lib/thresholdLetterLedger';
import { LINEAGES } from '@/lib/lineages';
import { lineageToVoiceKey } from '@/lib/lineageToVoiceKey';
import { getThresholdLetterContent } from '@/lib/mythopoetics/thresholdLetter';
import type { MarkerField } from '@/lib/returning/markers';

export const runtime = 'nodejs';

const MAX_RETURN_GIFT_LENGTH = 2000;
const ELDER_COOKIE = 'elder_user_id';
const CANONICAL_MARKERS: MarkerField[] = ['wound', 'threshold', 'pattern', 'exile', 'figure'];

function parseMarker(value: unknown): MarkerField | null {
  return typeof value === 'string' && (CANONICAL_MARKERS as string[]).includes(value)
    ? (value as MarkerField)
    : null;
}

export async function GET(req: NextRequest) {
  const userId = getSessionUserId(req);
  if (!userId || !process.env.DATABASE_URL) {
    return NextResponse.json({ letters: [] });
  }

  try {
    const letters = await getUserThresholdLetters(userId);
    return NextResponse.json({ letters });
  } catch (err) {
    console.error('[threshold-letters] Failed to load letters:', err);
    return NextResponse.json({ letters: [] });
  }
}

export async function POST(req: NextRequest) {
  const userId = getSessionUserId(req);
  if (!userId || !process.env.DATABASE_URL) {
    return NextResponse.json({ saved: false });
  }

  try {
    const body = await req.json().catch(() => null);
    const lineageKeyRaw = body?.lineageKey;
    const returnGift = body?.returnGift;
    if (
      typeof lineageKeyRaw !== 'string' ||
      !(lineageKeyRaw in LINEAGES) ||
      typeof returnGift !== 'string' ||
      !returnGift.trim() ||
      returnGift.length > MAX_RETURN_GIFT_LENGTH
    ) {
      return NextResponse.json({ saved: false });
    }
    const lineageKey = lineageKeyRaw as keyof typeof LINEAGES;

    // volatilizationPhrase / returnPhrase / thresholdImage are deterministic
    // per lineage — recomputed here rather than trusting client-supplied
    // copies, so a kept letter can't be fabricated with arbitrary text.
    const content = getThresholdLetterContent(lineageToVoiceKey(lineageKey));
    const marker = parseMarker(body?.marker);
    // Best-effort/decorative only — never read by the deficit computation.
    const chainId = req.cookies.get(ELDER_COOKIE)?.value ?? null;

    await saveThresholdLetter(
      userId,
      lineageKey,
      content.volatilizationPhrase,
      content.returnPhrase,
      returnGift,
      content.thresholdImage,
      marker,
      chainId
    );
    return NextResponse.json({ saved: true });
  } catch (err) {
    console.error('[threshold-letters] Failed to save letter:', err);
    return NextResponse.json({ saved: false });
  }
}
