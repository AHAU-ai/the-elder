/**
 * mythPatterns.ts
 *
 * The other half of the learning loop: not feedback on a single archetype,
 * but what recurs ACROSS a seeker's whole stored myth (myth_archetype has
 * one row per distinct archetype — a seeker with several readings across
 * several myths may have 3-13 of these). A recurring name, relationship, or
 * shadow theme that shows up in more than one archetype's history is
 * exactly the kind of thing a myth diviner should be able to say "this is
 * the third time this has appeared" about — and no single archetype's row
 * has that view on its own.
 *
 * Same shape as mythExtractor.ts and welfareGate.ts: injected ModelJudge,
 * narrow system prompt, defensive parse-or-empty. Needs at least two
 * archetypes to have anything to compare — with fewer, there is nothing
 * cross-archetype to say, so it returns '' without a model call at all.
 */

import type { MythEntry } from './mythLedger';

export type ModelJudge = (systemPrompt: string, userText: string) => Promise<string>;

export const MYTH_PATTERN_SYSTEM = `You are a myth-archive pattern reader for a divination application. You are given a seeker's stored archetypes — each with its own name, the depth already seen in it, and the people/circumstances named alongside it. Your ONLY job is to notice what recurs ACROSS more than one of these entries: a repeated name, relationship, or shadow theme. You do not invent connections that are not in the text, and you do not comment on an archetype in isolation — only on what threads between at least two of them.

If nothing genuinely recurs across entries, output exactly: {"patterns": ""}

Otherwise output ONLY this JSON object, no preamble, no markdown:
{"patterns": "one to three sentences naming what recurs and across which archetypes"}`;

export function buildMythPatternUser(entries: MythEntry[]): string {
  const blocks = entries.map((e, i) =>
    `Archetype ${i + 1}: ${e.archetypeName}\nSeen so far: ${e.summary}\nPeople/circumstances: ${e.peopleCircumstances || '(none named)'}`
  ).join('\n\n');
  return `Here are this seeker's stored archetypes:\n\n${blocks}`;
}

export function parseMythPatternResponse(raw: string): string {
  try {
    const cleaned = raw.replace(/```json/gi, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleaned) as Record<string, unknown>;
    const patterns = typeof parsed.patterns === 'string' ? parsed.patterns.trim() : '';
    return patterns.slice(0, 600);
  } catch {
    return '';
  }
}

/** Cross-archetype pattern recognition. Returns '' if <2 entries or on any failure. */
export async function findMythPatterns(
  entries: MythEntry[],
  modelJudge: ModelJudge
): Promise<string> {
  if (entries.length < 2) return '';
  try {
    const raw = await modelJudge(MYTH_PATTERN_SYSTEM, buildMythPatternUser(entries));
    return parseMythPatternResponse(raw);
  } catch {
    return '';
  }
}
