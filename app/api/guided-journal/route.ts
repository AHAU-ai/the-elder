import { NextRequest, NextResponse } from 'next/server';
import { getSessionUserId } from '@/lib/auth';
import { getUserGuidedJournalEntries, saveGuidedJournalEntry } from '@/lib/guidedJournalLedger';
import { userOwnsLetter } from '@/lib/thresholdLetterLedger';
import { LINEAGES } from '@/lib/lineages';

export const runtime = 'nodejs';

const MAX_RESPONSE_LENGTH = 4000;
const CANONICAL_MARKERS = ['wound', 'threshold', 'pattern', 'exile', 'figure'];

function parseMarker(value: unknown): string | null {
  return typeof value === 'string' && CANONICAL_MARKERS.includes(value) ? value : null;
}

export async function GET(req: NextRequest) {
  const userId = getSessionUserId(req);
  if (!userId || !process.env.DATABASE_URL) {
    return NextResponse.json({ entries: [] });
  }

  try {
    const entries = await getUserGuidedJournalEntries(userId);
    return NextResponse.json({ entries });
  } catch (err) {
    console.error('[guided-journal] Failed to load entries:', err);
    return NextResponse.json({ entries: [] });
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
    const prompt = body?.prompt;
    const response = body?.response;
    if (
      typeof lineageKeyRaw !== 'string' ||
      !(lineageKeyRaw in LINEAGES) ||
      typeof prompt !== 'string' ||
      !prompt.trim() ||
      typeof response !== 'string' ||
      !response.trim() ||
      response.length > MAX_RESPONSE_LENGTH
    ) {
      return NextResponse.json({ saved: false });
    }
    const lineageKey = lineageKeyRaw as keyof typeof LINEAGES;
    const marker = parseMarker(body?.marker);
    // LetterReportForm.tsx's report-back sends letterId to link this entry
    // back to the kept letter it's reporting on (migration 028) -- any
    // other/malformed value is silently dropped rather than rejecting the
    // whole save, since the entry itself is still valid without it.
    const claimedLetterId = Number.isFinite(body?.letterId) && Number(body.letterId) > 0
      ? Number(body.letterId)
      : null;
    const letterId = claimedLetterId && await userOwnsLetter(userId, claimedLetterId).catch(() => false)
      ? claimedLetterId
      : null;

    await saveGuidedJournalEntry(userId, lineageKey, prompt, response, marker, letterId);
    return NextResponse.json({ saved: true });
  } catch (err) {
    console.error('[guided-journal] Failed to save entry:', err);
    return NextResponse.json({ saved: false });
  }
}
