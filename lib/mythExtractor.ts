/**
 * mythExtractor.ts
 *
 * The Elder's readings are prose, not structured data — there is no field
 * to key a database row on. This module is the "intelligence" that reads a
 * just-delivered Reading (or a Council deepening of one) and distills it
 * into the shape myth_archetype needs: which archetype the seeker embodies,
 * what's newly been seen, and who/what circumstances were named.
 *
 * Mirrors welfareGate.ts's classifier shape exactly: an injected ModelJudge
 * so this module stays framework/SDK-free, a narrow single-purpose system
 * prompt, and a defensive parse that returns null rather than throwing on
 * anything malformed. A failed extraction must never surface to the seeker
 * or block their reading — the caller persists nothing and moves on.
 */

export type ModelJudge = (systemPrompt: string, userText: string) => Promise<string>;

export interface MythSignature {
  archetypeName: string;
  depthSummary: string;
  peopleCircumstances: string;
}

export const MYTH_EXTRACT_SYSTEM = `You are a myth-archive classifier for a divination application. Your ONLY job is to read a passage from a mythological Reading and extract three things about the archetype the seeker embodies. You do not divine, advise, or add anything not already present in the text. You output a single JSON object and nothing else.

Fields:
- "archetypeName": the short mythic name of the pattern/archetype the Reading names as living through the seeker (e.g. "The Wounded Healer", "The Threshold Guardian"). If the text names more than one, choose the primary one the Reading centers on. Title case, 2-6 words.
- "depthSummary": one to two sentences distilling what THIS passage newly reveals about that archetype in the seeker's life. Do not repeat generic archetype lore — capture what is specific to this seeker.
- "peopleCircumstances": one short sentence naming any specific people, relationships, or life circumstances the passage mentions in connection with the archetype. Empty string if none are mentioned.

Output ONLY this JSON object, no preamble, no markdown:
{"archetypeName": "...", "depthSummary": "...", "peopleCircumstances": "..."}`;

export function buildMythExtractUser(readingText: string): string {
  return `Extract the myth signature from this passage:\n\n<passage>\n${readingText}\n</passage>`;
}

export function parseMythExtractResponse(raw: string): MythSignature | null {
  try {
    const cleaned = raw.replace(/```json/gi, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleaned) as Record<string, unknown>;
    const archetypeName = typeof parsed.archetypeName === 'string' ? parsed.archetypeName.trim() : '';
    const depthSummary = typeof parsed.depthSummary === 'string' ? parsed.depthSummary.trim() : '';
    const peopleCircumstances = typeof parsed.peopleCircumstances === 'string' ? parsed.peopleCircumstances.trim() : '';
    if (!archetypeName || archetypeName.length > 80) return null;
    return {
      archetypeName,
      depthSummary: depthSummary.slice(0, 800),
      peopleCircumstances: peopleCircumstances.slice(0, 400),
    };
  } catch {
    return null;
  }
}

/** Run the extractor. Returns null on any failure — caller persists nothing. */
export async function extractMythSignature(
  readingText: string,
  modelJudge: ModelJudge
): Promise<MythSignature | null> {
  try {
    const raw = await modelJudge(MYTH_EXTRACT_SYSTEM, buildMythExtractUser(readingText));
    return parseMythExtractResponse(raw);
  } catch {
    return null;
  }
}
