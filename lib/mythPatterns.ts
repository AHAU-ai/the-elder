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
 *
 * B5 (design action items, 2026-08-19) — Pattern-View Copy Contract:
 * this is the Mythic Journal's pattern-surfacing view, and its phrasing
 * is guarded the same way lib/purposeStatement.ts is guarded (see
 * scripts/check-pattern-view-register.mjs, run as `npm run
 * check:pattern-view` alongside `npm run check:purpose`). Three rules,
 * non-negotiable:
 *   1. A pattern belongs to the SEEKER'S RETURNING, never to a voice.
 *      The instrument did not notice anything; the seeker kept coming
 *      back to the same name, relationship, or shadow. Phrase it as
 *      "you return to..." / "you keep naming...", never "I see..." /
 *      "the pattern shows...".
 *   2. No counts are spoken. Never "the third time", "twice", "again
 *      and again", or any other tally — a number turns a pattern into a
 *      diagnosis, which this feature is not authorized to give.
 *   3. Two threads are never asserted as connected. Naming that both
 *      threads recurred is permitted; claiming they are linked, tied
 *      together, or causally related is not — that inference belongs to
 *      the seeker, not the instrument.
 */

import type { MythEntry } from './mythLedger';

export type ModelJudge = (systemPrompt: string, userText: string) => Promise<string>;

export const MYTH_PATTERN_SYSTEM = `You are a myth-archive pattern reader for a divination application. You are given a seeker's stored archetypes — each with its own name, the depth already seen in it, and the people/circumstances named alongside it. Your ONLY job is to notice what the SEEKER RETURNS TO across more than one of these entries: a name, relationship, or shadow theme they keep naming. You do not invent connections that are not in the text.

Three rules govern the phrasing, without exception:
1. Attribute the pattern to the seeker's returning, never to yourself or to any voice. Say "you return to..." or "you keep naming...". Never say "I see...", "I notice...", or "the pattern shows...".
2. Never speak a count. No "the third time", "twice", "again and again", or any other tally of how many times something has appeared.
3. Never assert that two threads are connected, linked, or tied together. You may name that both recurred; you may not claim they relate to each other. That inference belongs to the seeker.

If nothing genuinely recurs across entries, output exactly: {"patterns": ""}

Otherwise output ONLY this JSON object, no preamble, no markdown:
{"patterns": "one to three sentences, in the voice of the seeker's own returning, naming what recurs and across which archetypes — no counts, no claimed connections between threads"}`;

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
