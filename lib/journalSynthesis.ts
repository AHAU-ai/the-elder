/**
 * journalSynthesis.ts
 *
 * Reads across a seeker's raw reading history (myth_reading, not the
 * merged myth_archetype rows) and writes a short passage naming the
 * throughline — the difference between a log and a mirror. Same shape as
 * mythExtractor.ts / mythPatterns.ts: injected ModelJudge, narrow system
 * prompt, defensive parse-or-null.
 */

import type { MythReadingRow } from './mythReadingLog';

export type ModelJudge = (systemPrompt: string, userText: string) => Promise<string>;

export const JOURNAL_SYNTHESIS_SYSTEM = `You are the myth diviner's own memory, reading back across a seeker's stored readings. You write two things:

1. "synthesis": the throughline — the pattern that runs across these sittings, not any single one of them. Three to five sentences, in the same mythopoetic register as a Reading itself (not clinical, not a summary list). Where it fits naturally, you may draw on this vocabulary: wound, threshold, pattern, exile, figure — but do not force all five in, and never invent anything not implied by the material given. Speak directly to the seeker as "you." Do not repeat any single depthSummary verbatim; synthesize.

2. "crossLineagePattern": each reading below is marked with which lineage's voice gave it (mayan, greek, egyptian, etc.). No single lineage's voice is permitted to speak about another tradition — that boundary is load-bearing, not incidental. But YOU are reading across all of them, which no single voice can do. If — and only if — the SAME theme, figure, wound, or pattern genuinely recurs in readings from at least two DIFFERENT lineages, name it in one or two sentences, framed as something visible only from outside any single tradition (e.g. "Across two different traditions, the same figure has found you..."). If nothing genuinely recurs across at least two distinct lineages, output "" for this field. Do not stretch a coincidence into a pattern.

Output ONLY this JSON object, no preamble, no markdown:
{"synthesis": "...", "crossLineagePattern": "..."}`;

export function buildJournalSynthesisUser(readings: MythReadingRow[]): string {
  const blocks = readings.map((r, i) =>
    `Reading ${i + 1} (lineage: ${r.lineageKey}${r.archetypeName ? `, archetype: ${r.archetypeName}` : ''}): ${r.depthSummary}`
  ).join('\n\n');
  return `Here are this seeker's most recent readings, oldest to newest:\n\n${blocks}`;
}

export interface JournalSynthesisResult {
  synthesis: string;
  crossLineagePattern: string;
}

export function parseJournalSynthesisResponse(raw: string): JournalSynthesisResult | null {
  try {
    const cleaned = raw.replace(/```json/gi, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleaned) as Record<string, unknown>;
    const synthesis = typeof parsed.synthesis === 'string' ? parsed.synthesis.trim() : '';
    const crossLineagePattern = typeof parsed.crossLineagePattern === 'string' ? parsed.crossLineagePattern.trim() : '';
    if (!synthesis) return null;
    return {
      synthesis: synthesis.slice(0, 1200),
      crossLineagePattern: crossLineagePattern.slice(0, 500),
    };
  } catch {
    return null;
  }
}

/** Synthesize a narrative passage (and, if genuine, a cross-lineage note) across readings. Returns null on any failure. */
export async function synthesizeJournal(
  readings: MythReadingRow[],
  modelJudge: ModelJudge
): Promise<JournalSynthesisResult | null> {
  if (readings.length === 0) return null;
  try {
    // oldest-to-newest reads more naturally as a throughline than newest-first
    const chronological = [...readings].reverse();
    const raw = await modelJudge(JOURNAL_SYNTHESIS_SYSTEM, buildJournalSynthesisUser(chronological));
    return parseJournalSynthesisResponse(raw);
  } catch {
    return null;
  }
}
