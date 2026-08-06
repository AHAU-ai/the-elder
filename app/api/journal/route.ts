import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { WELFARE_MODEL } from '@/lib/model.config';
import { getSessionUserId } from '@/lib/auth';
import { getReadingCount, getRecentReadings } from '@/lib/mythReadingLog';
import { getCachedSynthesis, saveSynthesis } from '@/lib/journalSynthesisLedger';
import { synthesizeJournal, type ModelJudge } from '@/lib/journalSynthesis';

export const runtime = 'nodejs';

const MIN_READINGS_FOR_FIRST_SYNTHESIS = 3;
const MIN_NEW_READINGS_TO_RESYNTHESIZE = 3;

export async function GET(req: NextRequest) {
  const userId = getSessionUserId(req);
  if (!userId || !process.env.DATABASE_URL) {
    return NextResponse.json({ synthesis: null, crossLineagePattern: null, readingCount: 0, reason: 'not_enough_sittings' });
  }

  try {
    const readingCount = await getReadingCount(userId);
    if (readingCount < MIN_READINGS_FOR_FIRST_SYNTHESIS) {
      return NextResponse.json({ synthesis: null, crossLineagePattern: null, readingCount, reason: 'not_enough_sittings' });
    }

    const cached = await getCachedSynthesis(userId);
    const needsSynthesis =
      !cached || readingCount - cached.readingCountAtSynthesis >= MIN_NEW_READINGS_TO_RESYNTHESIZE;

    if (!needsSynthesis && cached) {
      return NextResponse.json({
        synthesis: cached.synthesisText,
        crossLineagePattern: cached.crossLineagePattern || null,
        readingCount,
        reason: null,
      });
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      // Can't generate a new one right now — fall back to whatever's cached, if anything.
      return NextResponse.json({
        synthesis: cached?.synthesisText ?? null,
        crossLineagePattern: cached?.crossLineagePattern || null,
        readingCount,
        reason: cached ? null : 'not_enough_sittings',
      });
    }

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const judge: ModelJudge = async (system, user) => {
      const res = await client.messages.create({
        model: WELFARE_MODEL, max_tokens: 500,
        system,
        messages: [{ role: 'user', content: user }],
      });
      const b = res.content.find((x) => x.type === 'text');
      return b && 'text' in b ? b.text : '';
    };

    const readings = await getRecentReadings(userId, 15);
    const result = await synthesizeJournal(readings, judge);

    if (result) {
      await saveSynthesis(userId, result.synthesis, result.crossLineagePattern, readingCount);
      return NextResponse.json({
        synthesis: result.synthesis,
        crossLineagePattern: result.crossLineagePattern || null,
        readingCount,
        reason: null,
      });
    }

    // Synthesis failed — fall back to the previous cached passage if there was one.
    return NextResponse.json({
      synthesis: cached?.synthesisText ?? null,
      crossLineagePattern: cached?.crossLineagePattern || null,
      readingCount,
      reason: cached ? null : 'not_enough_sittings',
    });
  } catch (err) {
    console.error('[journal] Failed to load/compute synthesis:', err);
    return NextResponse.json({ synthesis: null, crossLineagePattern: null, readingCount: 0, reason: 'not_enough_sittings' });
  }
}
