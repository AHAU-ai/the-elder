/**
 * corpusRetrieval.ts
 *
 * Real retrieval against retrievable_passage, for voices that have
 * lineage-approved corpus content (currently: mekubal). Embeds the
 * seeker's own text and does a cosine-similarity lookup, scoped to a
 * single lineage_key, against ONLY rows the build gate already cleared
 * (review_status='approved', ceremonial_sensitivity='open',
 * body_normalized, embedding IS NOT NULL -- see retrievable_passage
 * in scripts-resilience/schema.sql).
 *
 * Fails soft, on purpose: any error here (missing key, DB down, no
 * rows for this voice) returns an empty array rather than throwing.
 * An empty result is what makes renderProvenanceBlock() fall back to
 * the honest "not grounded in specific passages" language -- retrieval
 * being unavailable should degrade the provenance claim, never block
 * the reading itself.
 *
 * BUT "fails soft" used to also mean "fails invisibly": a real bug
 * (retrievable_passage's frozen SELECT * view not exposing the filter
 * column at all) hid behind an empty array in production for as long as
 * this file existed, indistinguishable from "no relevant passage" until
 * someone queried the DB by hand. Found + fixed 2026-08-18 (see
 * migrations/013_fix_lineage_key_drift.sql). To stop that recurring
 * invisibly: every REAL failure path here (not "legitimate no match")
 * reports through the optional `onAnomaly` callback, which route.ts wires
 * to its existing telemetryAllowed()-gated logAnomaly(). A clean empty
 * result from a healthy query is never reported -- only reporting actual
 * errors, or every ordinary "nothing relevant" reading would flood
 * anomaly_record with noise.
 */

import { neon } from '@neondatabase/serverless';
import type { RetrievedPassage } from '@/src/resilience/provenance';

const sql = neon(process.env.DATABASE_URL!);

// Must match scripts-resilience/ingest.py's VOYAGE_MODEL/VOYAGE_DIMS exactly --
// a query embedded with a different model than the corpus was embedded with
// produces meaningless similarity scores, not an error, so this can't be
// caught automatically. If you change one, change both.
const VOYAGE_MODEL = 'voyage-multilingual-2';
const VOYAGE_DIMS = 1024;
const VOYAGE_URL = 'https://api.voyageai.com/v1/embeddings';

export interface RetrievalAnomaly {
  kind: 'near_miss';
  voice?: string;
  at: string;
  note: string; // bounded, no raw seeker text -- same contract as AnomalyEntry.note elsewhere
}

type EmbedResult = { ok: true; vec: number[] } | { ok: false; reason: string };

async function embedQuery(text: string): Promise<EmbedResult> {
  const apiKey = process.env.VOYAGE_API_KEY;
  if (!apiKey) return { ok: false, reason: 'voyage_api_key_unset' };

  let resp: Response;
  try {
    resp = await fetch(VOYAGE_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        input: [text],
        model: VOYAGE_MODEL,
        input_type: 'query',
      }),
    });
  } catch {
    return { ok: false, reason: 'voyage_network_error' };
  }

  if (!resp.ok) return { ok: false, reason: `voyage_http_${resp.status}` };

  const data = await resp.json().catch(() => null);
  const vec = data?.data?.[0]?.embedding;
  if (!Array.isArray(vec) || vec.length !== VOYAGE_DIMS) {
    return { ok: false, reason: 'voyage_malformed_response' };
  }
  return { ok: true, vec };
}

export interface CorpusMatch extends RetrievedPassage {
  body: string;
}

/**
 * Retrieve up to `limit` corpus passages for a given voice, ranked by
 * similarity to seekerText. Returns [] if the voice legitimately has no
 * matching approved corpus -- never throws, since this is an enhancement
 * to grounding, not a gate a reading must pass.
 *
 * `onAnomaly`, if provided, is called ONLY for real failures (missing
 * config, embedding API errors, DB/SQL errors) -- never for a clean query
 * that simply found nothing relevant. Callers that don't care about
 * observability can omit it and get the exact old fail-soft behavior.
 */
export async function retrieveForVoice(
  voiceKey: string,
  seekerText: string,
  limit = 2,
  onAnomaly?: (entry: RetrievalAnomaly) => void
): Promise<CorpusMatch[]> {
  const report = (note: string) => {
    onAnomaly?.({ kind: 'near_miss', voice: voiceKey, at: new Date().toISOString(), note });
  };

  if (!seekerText.trim()) return []; // nothing to search on -- not a failure

  if (!process.env.DATABASE_URL) {
    report('corpus_retrieval:database_url_unset');
    return [];
  }

  const embedded = await embedQuery(seekerText);
  if (embedded.ok === false) {
    report(`corpus_retrieval:embed_failed:${embedded.reason}`);
    return [];
  }
  const vec: number[] = embedded.vec;

  try {
    const vecLiteral = `[${vec.join(',')}]`;
    const rows = await sql`
      SELECT passage_id, source, section, body
      FROM retrievable_passage
      WHERE lineage_key = ${voiceKey}
      ORDER BY embedding <=> ${vecLiteral}::vector
      LIMIT ${limit}
    `;
    // rows.length === 0 here is a CLEAN result -- the query ran fine and
    // genuinely found nothing for this voice/query. Not reported: this is
    // the expected, common case for every voice without a corpus yet, and
    // reporting it would flood anomaly_record with non-anomalies.
    return rows.map((r: any) => ({
      passageId: r.passage_id,
      source: r.source,
      section: r.section,
      body: r.body,
    }));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    report(`corpus_retrieval:db_error:${message.slice(0, 120)}`);
    return [];
  }
}
