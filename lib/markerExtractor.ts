/**
 * markerExtractor.ts
 *
 * Distills up to five mythic markers (wound, figure, threshold, exile,
 * pattern — see MythicMarkers in lib/returning/visit.ts) out of a
 * just-delivered Reading, as a narrow second model call — not a directive
 * asked of the primary model mid-response. The primary model is telling a
 * myth; asking it to also emit a structured tag inside that same creative
 * response risks the tag leaking past a strip-regex into what the seeker
 * reads. This mirrors mythExtractor.ts's shape instead: single-purpose
 * classifier prompt, defensive parse, null on anything malformed.
 *
 * A failed extraction must never surface to the seeker or block their
 * reading — the caller persists an empty markers object and moves on.
 */

import type { MythicMarkers } from '@/lib/returning/visit';

export type ModelJudge = (systemPrompt: string, userText: string) => Promise<string>;

const MARKER_FIELDS = ['wound', 'figure', 'threshold', 'exile', 'pattern'] as const;

export const MARKER_EXTRACT_SYSTEM = `You are a myth-archive classifier for a divination application. Your ONLY job is to read a passage from a mythological Reading and notice which of five specific mythic markers are clearly present in it. You do not divine, advise, or add anything not already present in the text. You output a single JSON object and nothing else.

The five markers:
- "wound": the core injury or ache the passage names or implies the seeker carries.
- "figure": a specific person, relationship, or mythic/archetypal figure the passage names in connection with the seeker's situation.
- "threshold": a transition, decision point, or edge the passage suggests the seeker stands at.
- "exile": a place, role, belonging, or part of self the passage suggests the seeker has been cut off from.
- "pattern": a recurring behavior or dynamic the passage names as repeating in the seeker's life.

For each marker, write ONE short phrase (a few words to one sentence) capturing what THIS passage specifically says about it — never generic archetype lore. If a marker is not clearly present in the passage, omit that key entirely rather than guessing or inventing content. It is normal and expected for most passages to name only one or two of the five.

Output ONLY this JSON object, no preamble, no markdown, omitting any field not clearly present:
{"wound": "...", "figure": "...", "threshold": "...", "exile": "...", "pattern": "..."}`;

export function buildMarkerExtractUser(readingText: string): string {
  return `Notice the mythic markers present in this passage:\n\n<passage>\n${readingText}\n</passage>`;
}

export function parseMarkerExtractResponse(raw: string): MythicMarkers | null {
  try {
    const cleaned = raw.replace(/```json/gi, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleaned) as Record<string, unknown>;
    const markers: MythicMarkers = {};
    for (const field of MARKER_FIELDS) {
      const value = parsed[field];
      if (typeof value === 'string' && value.trim().length > 0) {
        markers[field] = value.trim().slice(0, 300);
      }
    }
    return markers;
  } catch {
    return null;
  }
}

/** Run the extractor. Returns null on any failure — caller persists {} and moves on. */
export async function extractMarkersFromReading(
  readingText: string,
  modelJudge: ModelJudge
): Promise<MythicMarkers | null> {
  try {
    const raw = await modelJudge(MARKER_EXTRACT_SYSTEM, buildMarkerExtractUser(readingText));
    return parseMarkerExtractResponse(raw);
  } catch {
    return null;
  }
}
