/**
 * retrievalQuery.ts
 *
 * ELD-008 query construction: the retrieval query is built from a diagnosis of
 * what the seeker brought (the five markers, plus the Cruz Maya position when
 * a birth date was given), not from their literal words. Pure and testable;
 * the route owns the model call and corpusRetrieval.ts owns the embedding and
 * the rerank.
 *
 * This is retrieval steering only. It reads the seeker's CURRENT message, once,
 * and the result is used to choose which corpus passages ground the Reading and
 * then discarded: never stored, never shown, never added to the seeker's
 * trajectory, never counted. A diagnosis here is not a marker and does not touch
 * markers_confirmed (Axis 2 stays confirm-only). It is the same posture as the
 * myth-first selector: a small separate call that overlaps the other
 * pre-generation lookups, discarded on a crisis or distress turn.
 *
 * Fails toward the literal words: any error, timeout or empty diagnosis returns
 * the seeker's text unchanged, which is exactly today's behavior.
 */

import { MARKER_FIELDS, type ModelJudge } from '@/lib/markerExtractor';
import type { CruzMaya } from '@/lib/chol-qij';

/** Opt-in. Off, retrieval is byte-for-byte what it was. A governance-neutral engineering flag. */
export function retrievalV2Enabled(): boolean {
  return process.env.CORPUS_RETRIEVAL_V2 === 'true';
}

export const DIAGNOSE_SYSTEM = `You are a retrieval assistant for a mythological text archive. You read what a person has brought and write a short description of it, in the archive's own terms, so the right passages can be found. You do not advise, comfort or interpret beyond what is written. You output a single JSON object and nothing else.

Describe, in at most one short phrase each, only what the person's own words clearly contain:
- "wound": the ache or injury they name or imply.
- "figure": a person, relationship or archetypal figure they name.
- "threshold": a transition, decision or edge they stand at.
- "exile": something they have been cut off from.
- "pattern": a recurring dynamic they name.

Omit any key that is not clearly present. Never invent. Output ONLY the JSON object.`;

const MAX_QUERY_CHARS = 700;

export interface Diagnosis {
  wound?: string;
  figure?: string;
  threshold?: string;
  exile?: string;
  pattern?: string;
}

export function parseDiagnosis(raw: string): Diagnosis | null {
  try {
    const parsed = JSON.parse(raw.replace(/```json/gi, '').replace(/```/g, '').trim()) as Record<string, unknown>;
    const d: Diagnosis = {};
    for (const f of MARKER_FIELDS) {
      const v = parsed[f];
      if (typeof v === 'string' && v.trim()) d[f] = v.replace(/\s+/g, ' ').trim().slice(0, 160);
    }
    return Object.keys(d).length ? d : null;
  } catch {
    return null;
  }
}

/** The Cruz Maya position as retrieval vocabulary: the birth nahual and its four flanking signs. */
export function cruzTerms(cruz: CruzMaya | null | undefined): string {
  if (!cruz) return '';
  const n = (s: { nahual: { name: string } }) => s.nahual.name;
  return `${n(cruz.center)}; origin ${n(cruz.origin)}; destiny ${n(cruz.destiny)}; paternal ${n(cruz.paternal)}; maternal ${n(cruz.maternal)}`;
}

/**
 * Assemble the query. With no usable diagnosis it is the literal text. With one
 * it is the diagnosis (and Cruz position) followed by a short slice of the
 * seeker's own words, so a thin diagnosis cannot pull retrieval off the subject.
 */
export function buildDiagnosisQuery(
  seekerText: string,
  diagnosis: Diagnosis | null,
  cruz?: CruzMaya | null
): string {
  const literal = seekerText.trim();
  if (!diagnosis) return literal;
  const parts = MARKER_FIELDS.filter((f) => diagnosis[f]).map((f) => `${f}: ${diagnosis[f]}`);
  const c = cruzTerms(cruz);
  if (c) parts.push(`nahual: ${c}`);
  const head = parts.join('. ');
  const room = Math.max(0, MAX_QUERY_CHARS - head.length - 2);
  return room > 40 ? `${head}. ${literal.slice(0, room)}` : head.slice(0, MAX_QUERY_CHARS);
}

/** Run the diagnosis. Returns the literal text on any failure. */
export async function diagnosisQuery(
  seekerText: string,
  judge: ModelJudge,
  cruz?: CruzMaya | null
): Promise<string> {
  if (!seekerText.trim()) return seekerText;
  try {
    const raw = await judge(DIAGNOSE_SYSTEM, `What the person brought:\n\n<text>\n${seekerText.slice(0, 2000)}\n</text>`);
    return buildDiagnosisQuery(seekerText, parseDiagnosis(raw), cruz);
  } catch {
    return seekerText;
  }
}

/**
 * Apply a Voyage rerank response (indices into `items`, with scores) and keep
 * the top `limit`. Anything malformed keeps the input order, so a bad response
 * can only ever cost the improvement, never the passages.
 */
export function applyRerank<T>(items: T[], data: unknown, limit: number): T[] {
  const results = (data as { data?: { index?: unknown; relevance_score?: unknown }[] } | null)?.data;
  if (!Array.isArray(results)) return items.slice(0, limit);
  const used = new Set<number>();
  const order: T[] = [];
  const valid = results
    .filter((r) => Number.isInteger(r.index) && (r.index as number) >= 0 && (r.index as number) < items.length)
    .sort((a, b) => Number(b.relevance_score ?? 0) - Number(a.relevance_score ?? 0));
  for (const r of valid) {
    const i = r.index as number;
    if (used.has(i)) continue;
    used.add(i);
    order.push(items[i]);
  }
  return (order.length ? order : items).slice(0, limit);
}
