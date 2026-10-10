// lib/returning/counterpartMatch.ts
//
// Decides the honest BASIS of a Figure Continuity counterpart (spec v0.2,
// section 5 step 3, guard G9). The model's own claim about its source is
// advisory; the server decides:
//   'corpus'        the counterpart matches a term in an APPROVED, OPEN passage
//                   of the chain's own voice (corpus_passage), and the passage
//                   id is recorded
//   'model_report'  anything else: the model's recollection of its tradition,
//                   stored and disclosed as such in the provenance block
// A lineage with no approved passages (most of them, today) simply yields
// model_report; nothing is dropped for lacking a corpus.
//
// The match is deliberately strict and explainable. After normalizing both
// sides (case, diacritics, punctuation, a leading article), a counterpart
// matches a passage when it equals one of the passage's `themes` or `nahuales`
// terms or its `section` title, or appears as a whole-word phrase inside the
// section title (titles carry character names). Passages are tried in
// passage_id order, so the same input always links the same passage.
//
// normalizeTerm and matchCounterpart are pure. The loader reads corpus_passage
// lazily and caches per voice for a few minutes, because offers are rare but a
// voice's approved set can run to thousands of rows.

import { lineageToVoiceKey } from '@/lib/lineageToVoiceKey';

export interface CandidatePassage {
  passageId: string;
  section: string;
  themes: string[];
  nahuales: string[];
}

export interface CounterpartResolution {
  basis: 'corpus' | 'model_report';
  passageId: string | null;
}

const MIN_TERM_CHARS = 3;
const ARTICLES = new Set(['the', 'a', 'an']);

/** Case-, diacritic- and punctuation-insensitive form of a term, minus a leading article. */
export function normalizeTerm(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  const words = raw
    .normalize('NFD')
    .replace(/\p{M}+/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .split(' ')
    .filter(Boolean);
  if (words.length > 1 && ARTICLES.has(words[0])) words.shift();
  return words.join(' ');
}

/** The passage id a counterpart matches, or null. Deterministic: lowest passage_id wins. */
export function matchCounterpart(rows: CandidatePassage[], counterpart: string): string | null {
  const c = normalizeTerm(counterpart);
  if (c.length < MIN_TERM_CHARS) return null;
  const sorted = [...rows].sort((a, b) => (a.passageId < b.passageId ? -1 : a.passageId > b.passageId ? 1 : 0));
  for (const row of sorted) {
    const section = normalizeTerm(row.section);
    if (section === c || (' ' + section + ' ').includes(' ' + c + ' ')) return row.passageId;
    const terms = [...(row.themes ?? []), ...(row.nahuales ?? [])];
    if (terms.some(t => normalizeTerm(t) === c)) return row.passageId;
  }
  return null;
}

// ── database side, loaded lazily so importing this module never needs a connection ──

const CACHE_TTL_MS = 10 * 60 * 1000;
const ROW_LIMIT = 6000;
const cache = new Map<string, { at: number; rows: CandidatePassage[] }>();

async function loadApprovedPassages(voiceKey: string): Promise<CandidatePassage[] | null> {
  const hit = cache.get(voiceKey);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.rows;
  try {
    const { sql } = await import('./db');
    const found = await sql`
      SELECT passage_id, section, themes, nahuales
      FROM corpus_passage
      WHERE review_status = 'approved'
        AND ceremonial_sensitivity = 'open'
        AND lineage_key = ${voiceKey}
      ORDER BY passage_id
      LIMIT ${ROW_LIMIT}
    `;
    const rows = found.map(r => ({
      passageId: String(r.passage_id),
      section: String(r.section ?? ''),
      themes: Array.isArray(r.themes) ? (r.themes as unknown[]).map(String) : [],
      nahuales: Array.isArray(r.nahuales) ? (r.nahuales as unknown[]).map(String) : [],
    }));
    cache.set(voiceKey, { at: Date.now(), rows });
    return rows;
  } catch (err) {
    console.error('[counterpartMatch] load failed:', (err as Error)?.message);
    return null;
  }
}

/**
 * The honest basis for a counterpart on a chain in `lineageKey` (the visit
 * vocabulary, e.g. 'norse'; mapped to the corpus's voice vocabulary, e.g.
 * 'volva'). Never throws; any failure yields model_report, which is the
 * conservative and disclosed answer.
 */
export async function resolveCounterpart(lineageKey: string, counterpart: string): Promise<CounterpartResolution> {
  const rows = await loadApprovedPassages(lineageToVoiceKey(lineageKey));
  const passageId = rows ? matchCounterpart(rows, counterpart) : null;
  return passageId ? { basis: 'corpus', passageId } : { basis: 'model_report', passageId: null };
}
