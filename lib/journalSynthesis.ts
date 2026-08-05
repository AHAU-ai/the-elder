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

export const JOURNAL_SYNTHESIS_SYSTEM = `You are the myth diviner's own memory, reading back across a seeker's stored readings. Your ONLY job is to name the throughline — the pattern that runs across these sittings, not any single one of them. Write three to five sentences, in the same mythopoetic register as a Reading itself (not clinical, not a summary list). Where it fits naturally, you may draw on this vocabulary: wound, threshold, pattern, exile, figure — but do not force all five in, and never invent anything not implied by the material given. Speak directly to the seeker as "you." Do not repeat any single depthSummary verbatim; synthesize.

Output ONLY this JSON object, no preamble, no markdown:
{"synthesis": "..."}`;

export function buildJournalSynthesisUser(readings: MythReadingRow[]): string {
  const blocks = readings.map((r, i) =>
    `Reading ${i + 1} (${r.lineageKey}${r.archetypeName ? `, archetype: ${r.archetypeName}` : ''}): ${r.depthSummary}`
  ).join('\n\n');
  return `Here are this seeker's most recent readings, oldest to newest:\n\n${blocks}`;
}

export function parseJournalSynthesisResponse(raw: string): string | null {
  try {
    const cleaned = raw.replace(/```json/gi, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleaned) as Record<string, unknown>;
    const synthesis = typeof parsed.synthesis === 'string' ? parsed.synthesis.trim() : '';
    if (!synthesis) return null;
    return synthesis.slice(0, 1200);
  } catch {
    return null;
  }
}

/** Synthesize a narrative passage across readings. Returns null on any failure. */
export async function synthesizeJournal(
  readings: MythReadingRow[],
  modelJudge: ModelJudge
): Promise<string | null> {
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
