/**
 * verify-figure-release.ts -- the staging release check (governance doc, pre-flip checklist item 6).
 *
 * Proves, against a DEPLOYED app over real HTTP, that every way a seeker can let go of
 * Figure Continuity pairings actually removes the rows: one pairing, one myth, everything,
 * the last reading of a chain, and a whole-journal release. It also proves another seeker's
 * session cannot remove them. Passing it is what justifies setting FIGURE_CONTINUITY_RELEASE_VERIFIED.
 *
 * The release routes are not gated on the feature flag, so the flag need not be lit.
 *
 * Run (all three values are required; nothing is inferred):
 *   STAGING_URL=https://<staging deployment>           the deployment under test
 *   STAGING_SESSION_SECRET=<its ELDER_SESSION_SECRET>  so this script can sign a throwaway seeker's session
 *   DATABASE_URL=<the SAME database that deployment uses>
 *   FIGURE_TEST_DB_HOST=<that database's host>         tests/support/devDatabaseGuard.ts
 *   npx tsx scripts/verify-figure-release.ts
 *
 * Safety, in order:
 *  1. devDatabaseGuard refuses the production database (exit 2), before anything is written.
 *  2. Seeds ONLY throwaway users (@example.invalid) and deletes them at the end.
 *  3. BEFORE any DELETE, one read-only GET asks the deployment for the seeded pairing. Only if the
 *     deployment returns this run's unique label do we know it shares our database; anything else
 *     (another database, no table, an error) is a safety stop, and no DELETE is ever sent. This
 *     also means a deployment that is really production, with a real user who happens to share
 *     the throwaway id, is never written to.
 *
 * Exit codes: 0 every check passed; 1 a release check failed (a verdict); 2 safety/config stop.
 */
import { randomUUID } from 'node:crypto';
import { neon } from '@neondatabase/serverless';
import { assertDevDatabase } from '../tests/support/devDatabaseGuard';

const stop = (msg: string): never => { console.error(`SAFETY/CONFIG STOP: ${msg}\nNOTHING WAS DELETED ON THE DEPLOYMENT.`); process.exit(2); };

const STAGING_URL = (process.env.STAGING_URL || '').replace(/\/+$/, '');
if (!STAGING_URL) stop('STAGING_URL is not set.');
let stagingHost = '';
try {
  const u = new URL(STAGING_URL);
  if (u.protocol !== 'https:' && u.hostname !== 'localhost') stop('STAGING_URL must be https (or localhost).');
  stagingHost = u.host;
} catch { stop('STAGING_URL is not a valid URL.'); }
if (!process.env.STAGING_SESSION_SECRET) stop('STAGING_SESSION_SECRET is not set.');
// The session helper reads this at call time; set it before the helper is imported.
process.env.ELDER_SESSION_SECRET = process.env.STAGING_SESSION_SECRET;

const dbHost = assertDevDatabase();
const sql = neon(process.env.DATABASE_URL as string);

let failures = 0;
const check = (name: string, ok: boolean, detail = '') => {
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${name}${ok || !detail ? '' : `  (${detail})`}`);
  if (!ok) failures++;
};

const users: number[] = [];
async function newUser(tag: string): Promise<number> {
  const [r] = await sql`INSERT INTO elder_user (email) VALUES (${`release-check-${tag}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@example.invalid`}) RETURNING id`;
  users.push(Number(r.id));
  return Number(r.id);
}
async function newChain(userId: number, visits = 1): Promise<{ chainId: string; visitIds: string[] }> {
  const chainId = randomUUID();
  const visitIds: string[] = [];
  for (let i = 0; i < visits; i++) {
    const [v] = await sql`
      INSERT INTO visit_record (user_id, chain_id, visit_mode, lineage_key, myth_title, elder_response, markers_confirmed, depth)
      VALUES (${userId}, ${chainId}, 'explore', 'maya', 'Release check', 'test reading', ${JSON.stringify({ figure: 'The Hero Twin' })}::jsonb, ${i})
      RETURNING id`;
    visitIds.push(String(v.id));
  }
  return { chainId, visitIds };
}
async function pairing(userId: number, chainId: string, label: string): Promise<number> {
  const [r] = await sql`
    INSERT INTO figure_mapping (user_id, chain_id, lineage_key, myth_title, figure_label, subject_kind, subject_label, counterpart_label, counterpart_basis, status, confirmed_at)
    VALUES (${userId}, ${chainId}, 'maya', 'Release check', 'The Hero Twin', 'person', ${`my ${label}`}, ${`counterpart ${label}`}, 'model_report', 'confirmed', now())
    RETURNING id`;
  return Number(r.id);
}
const rowCount = async (userId: number, chainId?: string): Promise<number> => {
  const rows = chainId
    ? await sql`SELECT count(*)::int AS n FROM figure_mapping WHERE user_id = ${userId} AND chain_id = ${chainId}`
    : await sql`SELECT count(*)::int AS n FROM figure_mapping WHERE user_id = ${userId}`;
  return Number(rows[0].n);
};
const visitCount = async (userId: number): Promise<number> => Number((await sql`SELECT count(*)::int AS n FROM visit_record WHERE user_id = ${userId}`)[0].n);

async function cleanup() {
  while (users.length > 0) {
    const id = users.pop() as number;
    try { await sql`DELETE FROM elder_user WHERE id = ${id}`; } catch { console.error(`cleanup of throwaway user ${id} failed`); }
  }
}

async function main() {
  const { signSession, SESSION_COOKIE } = await import('../lib/auth');
  const cookie = (id: number) => `${SESSION_COOKIE}=${signSession(id)}`;
  const call = async (method: string, path: string, userId: number, body?: unknown) => {
    const headers: Record<string, string> = { cookie: cookie(userId) };
    if (body !== undefined) headers['content-type'] = 'application/json';
    const res = await fetch(STAGING_URL + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), redirect: 'manual' });
    let json: Record<string, any> = {};
    try { json = await res.json() as Record<string, any>; } catch { /* not json */ }
    return { status: res.status, json };
  };

  console.log(`Deployment: ${stagingHost}\nDatabase:   ${dbHost}\n`);

  // 0. The deployment must share OUR database. One read-only GET; no DELETE is sent before this passes.
  const probeUser = await newUser('probe');
  const probeChain = await newChain(probeUser);
  const unique = randomUUID().slice(0, 8);
  await pairing(probeUser, probeChain.chainId, `fingerprint-${unique}`);
  const seen = await call('GET', '/api/figure-mappings', probeUser);
  const mappings: Array<{ subjectLabel?: string }> = Array.isArray(seen.json.mappings) ? seen.json.mappings : [];
  if (seen.status !== 200 || !mappings.some(m => m.subjectLabel === `my fingerprint-${unique}`)) {
    await cleanup();
    stop(`the deployment did not return this run's seeded pairing (HTTP ${seen.status}). It does not share database ${dbHost}, the migration is missing there, or STAGING_SESSION_SECRET is wrong.`);
  }
  console.log('Fingerprint ok: the deployment reads the same database and accepts the signed session.\n');

  // A. one pairing
  console.log('A. release ONE pairing');
  {
    const u = await newUser('one'); const c = await newChain(u);
    const keep = await pairing(u, c.chainId, 'keep'); const drop = await pairing(u, c.chainId, 'drop');
    const r = await call('DELETE', `/api/figure-mappings/${drop}`, u);
    check('the route says it removed one', r.status === 200 && r.json.removed === 1, `HTTP ${r.status}`);
    check('that row is gone', (await sql`SELECT 1 FROM figure_mapping WHERE id = ${drop}`).length === 0);
    check('its sibling is untouched', (await sql`SELECT 1 FROM figure_mapping WHERE id = ${keep}`).length === 1);
  }

  // A2. another seeker's session
  console.log('A2. another seeker cannot release it');
  {
    const owner = await newUser('owner'); const other = await newUser('other'); const c = await newChain(owner);
    const id = await pairing(owner, c.chainId, 'private');
    const r = await call('DELETE', `/api/figure-mappings/${id}`, other);
    check('refused as not found', r.status === 404, `HTTP ${r.status}`);
    check('the owner still has it', (await rowCount(owner)) === 1);
    const all = await call('DELETE', '/api/figure-mappings/release', other);
    check("another seeker's release-all does not touch it", all.status === 200 && all.json.released === 0 && (await rowCount(owner)) === 1, `HTTP ${all.status}`);
  }

  // B. one myth (one chain)
  console.log('B. release ONE myth (chain)');
  {
    const u = await newUser('myth'); const c1 = await newChain(u); const c2 = await newChain(u);
    await pairing(u, c1.chainId, 'a1'); await pairing(u, c1.chainId, 'a2'); await pairing(u, c2.chainId, 'b1');
    const r = await call('DELETE', '/api/figure-mappings/release', u, { chainId: c1.chainId });
    check('the route says it released two', r.status === 200 && r.json.released === 2, `HTTP ${r.status}`);
    check("that myth's pairings are gone", (await rowCount(u, c1.chainId)) === 0);
    check("the other myth's pairing remains", (await rowCount(u, c2.chainId)) === 1);
  }

  // C. everything
  console.log('C. release EVERYTHING');
  {
    const u = await newUser('all'); const c1 = await newChain(u); const c2 = await newChain(u);
    await pairing(u, c1.chainId, 'x'); await pairing(u, c2.chainId, 'y');
    const r = await call('DELETE', '/api/figure-mappings/release', u);
    check('the route says it released two', r.status === 200 && r.json.released === 2, `HTTP ${r.status}`);
    check('no pairing remains', (await rowCount(u)) === 0);
    check('the readings themselves are untouched by a pairing-only release', (await visitCount(u)) === 2);
  }

  // D. the last reading of a chain (D9)
  console.log('D. release the LAST READING of a chain (D9)');
  {
    const u = await newUser('last'); const c = await newChain(u, 2); const other = await newChain(u);
    await pairing(u, c.chainId, 'chain'); await pairing(u, other.chainId, 'elsewhere');
    const first = await call('DELETE', '/api/user/history', u, { visitId: c.visitIds[0] });
    check('releasing the first of two readings succeeds', first.status === 200, `HTTP ${first.status}`);
    check('the chain still has readings, so its pairing stays', (await rowCount(u, c.chainId)) === 1);
    const last = await call('DELETE', '/api/user/history', u, { visitId: c.visitIds[1] });
    check('releasing the last reading succeeds', last.status === 200, `HTTP ${last.status}`);
    check("the chain's pairing went with it", (await rowCount(u, c.chainId)) === 0);
    check("another chain's pairing is untouched", (await rowCount(u, other.chainId)) === 1);
  }

  // E. whole journal
  console.log('E. release the WHOLE JOURNAL');
  {
    const u = await newUser('journal'); const c1 = await newChain(u); const c2 = await newChain(u);
    await pairing(u, c1.chainId, 'j1'); await pairing(u, c2.chainId, 'j2');
    const r = await call('DELETE', '/api/journal', u);
    check('the route reports pairings released', r.status === 200 && r.json.released?.mappings === 2, `HTTP ${r.status} ${JSON.stringify(r.json).slice(0, 120)}`);
    check('no pairing remains', (await rowCount(u)) === 0);
    check('no reading remains', (await visitCount(u)) === 0);
  }
}

main()
  .catch(err => { console.error('verify-figure-release crashed:', err instanceof Error ? err.message : err); failures++; })
  .finally(async () => {
    await cleanup();
    console.log(failures === 0 ? '\nRELEASE CHECK PASSED' : `\nRELEASE CHECK FAILED (${failures})`);
    process.exit(failures === 0 ? 0 : 1);
  });
