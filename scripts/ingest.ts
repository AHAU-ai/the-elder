/**
 * ingest.ts — Corpus ingestion. Idempotent. Run: node scripts/run-ingest.mjs
 */
import { neon } from '@neondatabase/serverless';
import { assertCanonical } from '../src/corpus/normalize';

const VOYAGE_KEY   = process.env.VOYAGE_API_KEY;
const DATABASE_URL = process.env.DATABASE_URL;
const BATCH_SIZE   = 20;

if (!VOYAGE_KEY)   throw new Error('VOYAGE_API_KEY not set');
if (!DATABASE_URL) throw new Error('DATABASE_URL not set');

const sql = neon(DATABASE_URL);

interface PassageRow { passage_id: string; body: string; lineage_key: string; }

async function fetchUnembedded(): Promise<PassageRow[]> {
  const rows = await sql`
    SELECT passage_id, body, lineage_key FROM corpus_passage
    WHERE review_status='approved' AND body_normalized=TRUE
      AND ceremonial_sensitivity='open' AND embedding IS NULL
    ORDER BY passage_id
  `;
  return rows as PassageRow[];
}

async function embedBatch(texts: string[]): Promise<number[][]> {
  const res = await fetch('https://api.voyageai.com/v1/embeddings', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${VOYAGE_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'voyage-3-large', input: texts, input_type: 'document' }),
  });
  if (!res.ok) throw new Error(`Voyage embed failed: ${res.status} ${await res.text()}`);
  const data = await res.json() as { data: Array<{ embedding: number[] }> };
  return data.data.map(d => d.embedding);
}

async function writeEmbedding(passageId: string, embedding: number[]): Promise<void> {
  const v = `[${embedding.join(',')}]`;
  await sql`UPDATE corpus_passage SET embedding=${v}::vector, updated_at=now() WHERE passage_id=${passageId}`;
}

async function main() {
  console.log('[ingest] Starting...');
  const passages = await fetchUnembedded();
  console.log(`[ingest] ${passages.length} passages need embedding`);
  if (passages.length === 0) { console.log('[ingest] Nothing to do.'); return; }

  const valid = passages.filter(p => {
    try { assertCanonical(p.body); return true; }
    catch { console.error(`[ingest] NormalizationGateViolation: ${p.passage_id}`); return false; }
  });

  let processed = 0, failed = 0;
  for (let i = 0; i < valid.length; i += BATCH_SIZE) {
    const batch = valid.slice(i, i + BATCH_SIZE);
    try {
      const embeddings = await embedBatch(batch.map(p => p.body));
      for (let j = 0; j < batch.length; j++) {
        try {
          await writeEmbedding(batch[j].passage_id, embeddings[j]);
          console.log(`[ingest] \u2713 ${batch[j].passage_id} (${batch[j].lineage_key})`);
          processed++;
        } catch (err) {
          console.error(`[ingest] \u2717 ${batch[j].passage_id}`, err); failed++;
        }
      }
    } catch (err) {
      console.error(`[ingest] \u2717 batch ${i / BATCH_SIZE + 1}`, err); failed += batch.length;
    }
    if (i + BATCH_SIZE < valid.length) await new Promise(r => setTimeout(r, 500));
  }
  console.log(`[ingest] Done. processed=${processed} failed=${failed}`);
  const count = await sql`SELECT COUNT(*) as n FROM retrievable_passage`;
  console.log(`[ingest] retrievable_passage now has ${(count[0] as any).n} rows`);
}
main().catch(err => { console.error('[ingest] Fatal:', err); process.exit(1); });
