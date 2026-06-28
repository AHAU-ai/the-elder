/**
 * retrieval.ts — Lineage-scoped hybrid retrieval for the Elder READY flow.
 * Voyage voyage-3-large (1024 dims) + rerank-2.
 * Lineage Integrity of Voice enforced at the SQL layer. Non-negotiable.
 */

import { neon } from '@neondatabase/serverless';
import { normalize } from '@/src/corpus/normalize';

export interface RetrievedPassage {
  passageId:   string;
  body:        string;
  source:      string;
  section:     string;
  themes:      string[];
  nahuales:    string[];
  rerankScore: number;
}

export interface RetrievalResult {
  passages:       RetrievedPassage[];
  queryUsed:      string;
  candidateCount: number;
  skipped:        boolean;
}

const VECTOR_CANDIDATES = 20;
const RERANK_TOP_K      = 5;

async function embedQuery(query: string): Promise<number[]> {
  const key = process.env.VOYAGE_API_KEY;
  if (!key) throw new Error('VOYAGE_API_KEY not set');
  const res = await fetch('https://api.voyageai.com/v1/embeddings', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'voyage-3-large', input: [query], input_type: 'query' }),
  });
  if (!res.ok) throw new Error(`Voyage embed failed: ${res.status} ${await res.text()}`);
  const data = await res.json() as { data: Array<{ embedding: number[] }> };
  return data.data[0].embedding;
}

async function rerankPassages(
  query: string,
  candidates: Array<{ passageId: string; body: string; source: string; section: string; themes: string[]; nahuales: string[] }>
): Promise<RetrievedPassage[]> {
  const key = process.env.VOYAGE_API_KEY;
  if (!key) throw new Error('VOYAGE_API_KEY not set');
  const res = await fetch('https://api.voyageai.com/v1/rerank', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'rerank-2',
      query,
      documents: candidates.map(c => c.body),
      top_k: RERANK_TOP_K,
      return_documents: false,
    }),
  });
  if (!res.ok) throw new Error(`Voyage rerank failed: ${res.status} ${await res.text()}`);
  const data = await res.json() as { data: Array<{ index: number; relevance_score: number }> };
  return data.data.map(r => ({ ...candidates[r.index], rerankScore: r.relevance_score }));
}

export async function retrievePassages(
  query: string,
  lineageKey: string
): Promise<RetrievalResult> {
  const db = process.env.DATABASE_URL;
  if (!db) throw new Error('DATABASE_URL not set');
  const normalizedQuery = normalize(query);
  const embedding = await embedQuery(normalizedQuery);
  const vectorLiteral = `[${embedding.join(',')}]`;
  const sql = neon(db);
  const rows = await sql`
    SELECT
      passage_id, body, source, section, themes, nahuales,
      1 - (embedding <=> ${vectorLiteral}::vector) AS cosine_similarity
    FROM corpus_passage
    WHERE lineage_key            = ${lineageKey}
      AND review_status          = 'approved'
      AND body_normalized        = TRUE
      AND embedding              IS NOT NULL
      AND ceremonial_sensitivity = 'open'
    ORDER BY embedding <=> ${vectorLiteral}::vector
    LIMIT ${VECTOR_CANDIDATES}
  `;
  if (rows.length === 0) {
    return { passages: [], queryUsed: normalizedQuery, candidateCount: 0, skipped: true };
  }
  const candidates = rows.map(r => ({
    passageId: r.passage_id as string,
    body:      r.body as string,
    source:    r.source as string,
    section:   r.section as string,
    themes:    (r.themes as string[]) ?? [],
    nahuales:  (r.nahuales as string[]) ?? [],
  }));
  const reranked = await rerankPassages(normalizedQuery, candidates);
  return { passages: reranked, queryUsed: normalizedQuery, candidateCount: rows.length, skipped: false };
}

export function formatGroundingBlock(passages: RetrievedPassage[]): string {
  if (passages.length === 0) return '';
  const formatted = passages.map((p, i) =>
    `[${i + 1}] ${p.source} \u2014 ${p.section}\n${p.body}`
  ).join('\n\n');
  return `\u2501\u2501\u2501 CORPUS GROUNDING \u2014 READING ANCHORS \u2501\u2501\u2501
The following passages have been drawn from the reviewed corpus for this lineage.
They are anchors, not scripts. You speak from within your tradition\u02bcs field.
Let them inform the mythological precision of each section. Do not quote them directly.

${formatted}

\u2501\u2501\u2501 END CORPUS GROUNDING \u2501\u2501\u2501`;
}
