import { releaseAllFiresideEntries } from '@/lib/firesideLedger';
import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { WELFARE_MODEL } from '@/lib/model.config';
import { getSessionUserId } from '@/lib/auth';
import { getReadingCount, getRecentReadings, deleteAllMythReadings } from '@/lib/mythReadingLog';
import { getCachedSynthesis, saveSynthesis, deleteSynthesis } from '@/lib/journalSynthesisLedger';
import { deleteAllMythArchetypes } from '@/lib/mythLedger';
import { releaseAllVisits } from '@/lib/returning/visit';
import { releaseAllMappings } from '@/lib/returning/figureMapping';
import { synthesizeJournal, type ModelJudge } from '@/lib/journalSynthesis';
import { languageNameFromInput } from '@/lib/i18n/languages';
import { languageDirective } from '@/lib/i18n/languageDirective';

// The cached synthesis is stored without a language. For non-English seekers
// we never read or write that cache (it would hand back the wrong language);
// instead a short in-memory cache avoids re-calling the model on every view.
const localizedCache = new Map<string, { text: string; pattern: string | null; at: number }>();
const LOCALIZED_TTL_MS = 6 * 60 * 60 * 1000;

export const runtime = 'nodejs';

const MIN_READINGS_FOR_FIRST_SYNTHESIS = 3;
const MIN_NEW_READINGS_TO_RESYNTHESIZE = 3;

export async function GET(req: NextRequest) {
  const userId = getSessionUserId(req);
  if (!userId || !process.env.DATABASE_URL) {
    return NextResponse.json({ synthesis: null, crossLineagePattern: null, readingCount: 0, reason: 'not_enough_sittings' });
  }

  const languageName = languageNameFromInput(req.nextUrl.searchParams.get('languageName'));
  const localized = languageName !== 'English';

  try {
    const readingCount = await getReadingCount(userId);
    if (readingCount < MIN_READINGS_FOR_FIRST_SYNTHESIS) {
      return NextResponse.json({ synthesis: null, crossLineagePattern: null, readingCount, reason: 'not_enough_sittings' });
    }

    const localKey = `${userId}|${languageName}|${readingCount}`;
    const hit = localized ? localizedCache.get(localKey) : undefined;
    if (hit && Date.now() - hit.at < LOCALIZED_TTL_MS) {
      return NextResponse.json({ synthesis: hit.text, crossLineagePattern: hit.pattern, readingCount, reason: null });
    }

    const cached = localized ? null : await getCachedSynthesis(userId);
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
        model: WELFARE_MODEL, max_tokens: localized ? 800 : 500,
        system: localized ? `${system}\n\n${languageDirective(languageName)}` : system,
        messages: [{ role: 'user', content: user }],
      });
      const b = res.content.find((x) => x.type === 'text');
      return b && 'text' in b ? b.text : '';
    };

    const readings = await getRecentReadings(userId, 15);
    const result = await synthesizeJournal(readings, judge);

    if (result) {
      if (localized) {
        localizedCache.set(localKey, { text: result.synthesis, pattern: result.crossLineagePattern || null, at: Date.now() });
      } else {
        await saveSynthesis(userId, result.synthesis, result.crossLineagePattern, readingCount);
      }
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

// ── Whole-journal release ───────────────────────────────────────────────────
// Releases everything the fire holds under the journal: full-text visits,
// the distilled reading log, merged archetypes, and the cached synthesis.
// Threshold letters and shared cards are kept deliberately — they were each
// saved by an explicit act and have their own release paths (staged next as
// account-level erasure). User-initiated, so failures are LOUD: a partial
// release reports release_failed, never a quiet success (fail toward honesty).
export async function DELETE(req: NextRequest) {
  const userId = getSessionUserId(req);
  if (!userId) return NextResponse.json({ error: 'not_signed_in' }, { status: 401 });
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: 'release_failed' }, { status: 500 });
  }

  try {
    // Figure Continuity pairings describe people in the seeker's life and go
    // first (spec G12): a failure leaves everything intact for a retry.
    const mappings = await releaseAllMappings(userId);
    if (!mappings.ok) return NextResponse.json({ error: 'release_failed' }, { status: 500 });
    // The fireside's exchanges, and with them any Tree leaf kept from one.
    const fireside = await releaseAllFiresideEntries(userId);
    const visits = await releaseAllVisits(userId);
    const readings = await deleteAllMythReadings(userId);
    const archetypes = await deleteAllMythArchetypes(userId);
    const synthesis = await deleteSynthesis(userId);
    return NextResponse.json({ released: { visits, readings, archetypes, synthesis, mappings: mappings.count, fireside } });
  } catch (err) {
    console.error('[journal] Release failed:', err);
    return NextResponse.json({ error: 'release_failed' }, { status: 500 });
  }
}
