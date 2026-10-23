/**
 * figureMappingRoutes.integration.test.ts -- HTTP-layer tests for the Figure
 * Continuity routes (FC-B) and the release-path integration (spec G12, D9).
 * Calls the route handlers directly with real NextRequests and signed session
 * cookies; no dev server needed.
 *
 * Covers: unauthenticated and forged sessions, IDOR across sequential ids,
 * replay and forged confirm, cap, malformed input, the per-user rate limit
 * (and that release is exempt), and that history/journal releases delete
 * pairings.
 *
 * Requires a live DATABASE_URL pointing at a DEV branch with migration 030.
 * Run: npm run test:figure-mapping-routes
 */
import { randomUUID } from 'node:crypto';

process.env.ELDER_SESSION_SECRET = 'test-secret-' + randomUUID();

import { NextRequest } from 'next/server';
import { sql } from '../lib/returning/db';
import { assertDevDatabase } from './support/devDatabaseGuard';
import { signSession, SESSION_COOKIE } from '../lib/auth';
import { createOffer, confirmOffer, MAX_CONFIRMED_MAPPINGS } from '../lib/returning/figureMapping';
import { GET as listGET } from '../app/api/figure-mappings/route';
import { DELETE as itemDELETE } from '../app/api/figure-mappings/[id]/route';
import { POST as confirmPOST } from '../app/api/figure-mappings/[id]/confirm/route';
import { DELETE as releaseDELETE } from '../app/api/figure-mappings/release/route';
import { DELETE as historyDELETE } from '../app/api/user/history/route';
import { DELETE as journalDELETE } from '../app/api/journal/route';

let failures = 0;
function check(name: string, cond: boolean) {
  if (cond) {
    console.log(`  ok  ${name}`);
  } else {
    console.error(`  FAIL  ${name}`);
    failures++;
  }
}

const BASE = 'http://localhost';
const cookieFor = (userId: number) => `${SESSION_COOKIE}=${signSession(userId)}`;

function req(method: string, path: string, opts: { userId?: number; cookie?: string; body?: unknown; rawBody?: string } = {}) {
  const headers: Record<string, string> = {};
  const cookie = opts.cookie ?? (opts.userId ? cookieFor(opts.userId) : undefined);
  if (cookie) headers.cookie = cookie;
  const init: { method: string; headers: Record<string, string>; body?: string } = { method, headers };
  if (opts.rawBody !== undefined) init.body = opts.rawBody;
  else if (opts.body !== undefined) { init.body = JSON.stringify(opts.body); headers['content-type'] = 'application/json'; }
  return new NextRequest(BASE + path, init);
}
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const json = async (res: Response) => res.json() as Promise<Record<string, any>>;

async function newUser(tag: string): Promise<number> {
  const [row] = await sql`
    INSERT INTO elder_user (email) VALUES (${`figure-map-rt-routes-${tag}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@example.invalid`})
    RETURNING id
  `;
  return Number(row.id);
}
async function newChain(userId: number): Promise<string> {
  const chainId = randomUUID();
  await sql`
    INSERT INTO visit_record (user_id, chain_id, visit_mode, lineage_key, myth_title, elder_response, markers_confirmed)
    VALUES (${userId}, ${chainId}, 'explore', 'ojer_tzij', 'The Twins', 'test reading', ${JSON.stringify({ figure: 'The Hero Twin' })}::jsonb)
  `;
  return chainId;
}
async function mapping(userId: number, chainId: string, subject: string, counterpart: string, confirm = true): Promise<number> {
  const o = await createOffer(userId, chainId, { kind: 'person', subject, counterpart, basis: 'model_report' });
  if (!('id' in o)) throw new Error('setup offer failed');
  if (confirm) {
    const c = await confirmOffer(userId, o.id);
    if (!(c.ok && c.outcome === 'confirmed')) throw new Error('setup confirm failed');
  }
  return o.id;
}
const countRows = async (userId: number) =>
  (await sql`SELECT count(*)::int AS n FROM figure_mapping WHERE user_id = ${userId}`)[0].n as number;

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL required for this integration test.');
    process.exit(1);
  }
  assertDevDatabase(); // these suites create and delete rows: never production (exit 2 = safety stop, not a verdict)
  const users: number[] = [];
  try {
    const A = await newUser('a'); users.push(A);
    const B = await newUser('b'); users.push(B);
    const chainA = await newChain(A);
    const chainB = await newChain(B);
    const aConfirmed = await mapping(A, chainA, 'my sister', 'the Maize Maiden');
    const bConfirmed = await mapping(B, chainB, 'their brother', 'the Elder Twin');
    const aOffer = await mapping(A, await newChain(A), 'my boss', 'the Lord', false);

    // ── unauthenticated and forged sessions ────────────────────────────
    const tampered = cookieFor(A).slice(0, -3) + 'abc';
    const noAuth: Array<[string, () => Promise<Response>]> = [
      ['GET list', () => listGET(req('GET', '/api/figure-mappings'))],
      ['DELETE item', () => itemDELETE(req('DELETE', `/api/figure-mappings/${aConfirmed}`), ctx(String(aConfirmed)))],
      ['POST confirm', () => confirmPOST(req('POST', `/api/figure-mappings/${aOffer}/confirm`), ctx(String(aOffer)))],
      ['DELETE release', () => releaseDELETE(req('DELETE', '/api/figure-mappings/release'))],
    ];
    for (const [name, call] of noAuth) {
      check(`no session: ${name} is 401`, (await call()).status === 401);
    }
    const forged = await itemDELETE(req('DELETE', `/api/figure-mappings/${aConfirmed}`, { cookie: tampered }), ctx(String(aConfirmed)));
    check('tampered session cookie is 401', forged.status === 401);
    check('401s changed nothing', (await countRows(A)) === 2 && (await countRows(B)) === 1);

    // ── GET ────────────────────────────────────────────────────────────
    const list = await listGET(req('GET', '/api/figure-mappings', { userId: A }));
    const listBody = await json(list);
    check('GET lists the session user\'s confirmed mappings only', list.status === 200 && listBody.mappings.length === 1 && listBody.mappings[0].subjectLabel === 'my sister');
    check('GET never returns pending offers', !listBody.mappings.some((m: any) => m.id === aOffer));
    check('GET response is not cacheable', list.headers.get('cache-control') === 'no-store');
    check('GET exposes no user id or other user\'s rows', !JSON.stringify(listBody).includes('their brother') && !('userId' in listBody.mappings[0]));
    const byChain = await json(await listGET(req('GET', `/api/figure-mappings?chainId=${chainA}`, { userId: A })));
    check('GET ?chainId filters to that chain', byChain.mappings.length === 1);
    const foreignChain = await listGET(req('GET', `/api/figure-mappings?chainId=${chainB}`, { userId: A }));
    check('GET with someone else\'s chain id is an empty list, not an error', foreignChain.status === 200 && (await json(foreignChain)).mappings.length === 0);
    check('GET with a malformed chainId is 400', (await listGET(req('GET', '/api/figure-mappings?chainId=nope', { userId: A }))).status === 400);

    // ── IDOR: sequential ids across users ──────────────────────────────
    const idorDelete = await itemDELETE(req('DELETE', `/api/figure-mappings/${bConfirmed}`, { userId: A }), ctx(String(bConfirmed)));
    check('IDOR: deleting another user\'s mapping is 404', idorDelete.status === 404);
    const idorConfirm = await confirmPOST(req('POST', `/api/figure-mappings/${bConfirmed}/confirm`, { userId: A }), ctx(String(bConfirmed)));
    check('IDOR: confirming another user\'s row is the neutral noop', idorConfirm.status === 200 && (await json(idorConfirm)).outcome === 'noop');
    check('IDOR: B still holds its mapping', (await countRows(B)) === 1);
    // Ids are sequential, so probe the ids that really are another seeker's rows.
    const C = await newUser('c'); users.push(C);
    const cIds = [
      await mapping(C, await newChain(C), 'c one', 'door one'),
      await mapping(C, await newChain(C), 'c two', 'door two'),
      await mapping(C, await newChain(C), 'c pending', 'door three', false),
    ];
    for (const id of [...cIds, bConfirmed]) {
      const r = await itemDELETE(req('DELETE', `/api/figure-mappings/${id}`, { userId: A }), ctx(String(id)));
      check(`IDOR: deleting another seeker's row ${id} reveals nothing (404, same body as a missing id)`, r.status === 404 && JSON.stringify(await json(r)) === '{"error":"not_found"}');
      const c = await confirmPOST(req('POST', `/api/figure-mappings/${id}/confirm`, { userId: A }), ctx(String(id)));
      check(`IDOR: confirming another seeker's row ${id} is the neutral noop`, c.status === 200 && (await json(c)).outcome === 'noop');
    }
    const missing = await itemDELETE(req('DELETE', '/api/figure-mappings/9999999999', { userId: A }), ctx('9999999999'));
    check('IDOR: a missing id gives the identical 404 body', missing.status === 404 && JSON.stringify(await json(missing)) === '{"error":"not_found"}');
    check('IDOR: C still holds all of its rows', (await countRows(C)) === 3);
    check('IDOR: A\'s own rows are intact after the probing', (await countRows(A)) === 2);

    // ── confirm: replay, junk, cap ─────────────────────────────────────
    const first = await confirmPOST(req('POST', `/api/figure-mappings/${aOffer}/confirm`, { userId: A }), ctx(String(aOffer)));
    check('confirm: first press confirms', first.status === 200 && (await json(first)).outcome === 'confirmed');
    const replay = await confirmPOST(req('POST', `/api/figure-mappings/${aOffer}/confirm`, { userId: A }), ctx(String(aOffer)));
    check('confirm: replay is the neutral noop and not an error', replay.status === 200 && (await json(replay)).outcome === 'noop');
    check('confirm: still exactly 2 confirmed after a replay', (await sql`SELECT count(*)::int n FROM figure_mapping WHERE user_id = ${A} AND status = 'confirmed'`)[0].n === 2);
    for (const junk of ['abc', '0', '-1', '1e3', '1.5', '99999999999999999999', '', ' 5', '5 ']) {
      const r = await confirmPOST(req('POST', '/api/figure-mappings/x/confirm', { userId: A }), ctx(junk));
      check(`confirm: junk id ${JSON.stringify(junk)} is the neutral noop`, r.status === 200 && (await json(r)).outcome === 'noop');
    }
    const capUser = await newUser('cap'); users.push(capUser);
    const capChain = await newChain(capUser);
    await sql`
      INSERT INTO figure_mapping
        (user_id, chain_id, lineage_key, myth_title, figure_label, subject_kind, subject_label, counterpart_label, counterpart_basis, status, confirmed_at)
      SELECT ${capUser}, ${capChain}, 'ojer_tzij', 'The Twins', 'The Hero Twin', 'person',
             'subject ' || g, 'counterpart ' || g, 'model_report', 'confirmed', now()
      FROM generate_series(1, ${MAX_CONFIRMED_MAPPINGS}) AS g
    `;
    const capOffer = await mapping(capUser, await newChain(capUser), 'one too many', 'a door', false);
    const capRes = await confirmPOST(req('POST', `/api/figure-mappings/${capOffer}/confirm`, { userId: capUser }), ctx(String(capOffer)));
    const capBody = await json(capRes);
    check('cap: 409 with a named outcome and message', capRes.status === 409 && capBody.outcome === 'capReached' && capBody.max === MAX_CONFIRMED_MAPPINGS && typeof capBody.message === 'string');
    check('cap: nothing evicted', (await sql`SELECT count(*)::int n FROM figure_mapping WHERE user_id = ${capUser} AND status = 'confirmed'`)[0].n === MAX_CONFIRMED_MAPPINGS);

    // ── DELETE item: offer vs remove ───────────────────────────────────
    const staleDecline = await itemDELETE(req('DELETE', `/api/figure-mappings/${aConfirmed}?offer=1`, { userId: A }), ctx(String(aConfirmed)));
    check('"Not quite" (?offer=1) can never remove a confirmed mapping', staleDecline.status === 404 && (await countRows(A)) === 2);
    const declineChain = await newChain(A);
    const declinable = await mapping(A, declineChain, 'a stranger', 'the Owl', false);
    const declined = await itemDELETE(req('DELETE', `/api/figure-mappings/${declinable}?offer=1`, { userId: A }), ctx(String(declinable)));
    check('"Not quite" deletes a pending offer', declined.status === 200 && (await json(declined)).removed === 1);
    const removed = await itemDELETE(req('DELETE', `/api/figure-mappings/${aConfirmed}`, { userId: A }), ctx(String(aConfirmed)));
    check('remove deletes a confirmed mapping', removed.status === 200 && (await countRows(A)) === 1);
    const again = await itemDELETE(req('DELETE', `/api/figure-mappings/${aConfirmed}`, { userId: A }), ctx(String(aConfirmed)));
    check('removing twice: second is 404', again.status === 404);
    for (const junk of ['abc', '0', '-4', '1e3', '07']) {
      const r = await itemDELETE(req('DELETE', '/api/figure-mappings/x', { userId: A }), ctx(junk));
      check(`DELETE junk id ${JSON.stringify(junk)} is 404`, r.status === 404);
    }

    // ── rate limit: confirm and item delete limited, release exempt ────
    const rlUser = await newUser('rl'); users.push(rlUser);
    const rlKey = `figmap:${rlUser}`;
    await sql`
      INSERT INTO rate_limit_bucket (key, count, first_hit) VALUES (${rlKey}, 100000, now())
      ON CONFLICT (key) DO UPDATE SET count = 100000, first_hit = now()
    `;
    const rlConfirm = await confirmPOST(req('POST', '/api/figure-mappings/1/confirm', { userId: rlUser }), ctx('1'));
    check('rate limit: confirm over the limit is 429', rlConfirm.status === 429);
    const rlDelete = await itemDELETE(req('DELETE', '/api/figure-mappings/1', { userId: rlUser }), ctx('1'));
    check('rate limit: item delete over the limit is 429', rlDelete.status === 429);
    const rlRelease = await releaseDELETE(req('DELETE', '/api/figure-mappings/release', { userId: rlUser }));
    check('rate limit: release is exempt (a seeker can always take their data back)', rlRelease.status === 200);
    const rlOther = await confirmPOST(req('POST', '/api/figure-mappings/1/confirm', { userId: A }), ctx('1'));
    check('rate limit is per user: another user is unaffected', rlOther.status === 200);

    // ── release route ──────────────────────────────────────────────────
    const R = await newUser('rel'); users.push(R);
    const rc1 = await newChain(R);
    const rc2 = await newChain(R);
    await mapping(R, rc1, 'my mother', 'the Grandmother');
    await mapping(R, rc2, 'my father', 'the Old Man');
    await mapping(R, rc2, 'a pending one', 'the Owl', false);
    for (const [name, rawBody] of [['not json', 'nope{'], ['array', '[]'], ['bad chainId', JSON.stringify({ chainId: 'x' })], ['numeric chainId', JSON.stringify({ chainId: 5 })]] as const) {
      const r = await releaseDELETE(req('DELETE', '/api/figure-mappings/release', { userId: R, rawBody }));
      check(`release: ${name} body is 400`, r.status === 400);
    }
    check('release: bad bodies deleted nothing', (await countRows(R)) === 3);
    const relChain = await releaseDELETE(req('DELETE', '/api/figure-mappings/release', { userId: R, body: { chainId: rc2 } }));
    check('release: one chain (mapping and pending offer)', relChain.status === 200 && (await json(relChain)).released === 2 && (await countRows(R)) === 1);
    const relForeign = await releaseDELETE(req('DELETE', '/api/figure-mappings/release', { userId: A, body: { chainId: rc1 } }));
    check('release: another user\'s chain id deletes nothing', relForeign.status === 200 && (await json(relForeign)).released === 0 && (await countRows(R)) === 1);
    const relAll = await releaseDELETE(req('DELETE', '/api/figure-mappings/release', { userId: R }));
    check('release: all (no body)', relAll.status === 200 && (await json(relAll)).released === 1 && (await countRows(R)) === 0);

    // ── history release integration (G12, D9) ──────────────────────────
    const H = await newUser('hist'); users.push(H);
    const hc = await newChain(H);
    const secondVisit = randomUUID();
    await sql`
      INSERT INTO visit_record (id, user_id, chain_id, visit_mode, lineage_key, depth, elder_response)
      VALUES (${secondVisit}, ${H}, ${hc}, 'deepen', 'ojer_tzij', 2, 'second reading')
    `;
    await mapping(H, hc, 'my aunt', 'the Weaver');
    const visits = await sql`SELECT id FROM visit_record WHERE user_id = ${H} AND chain_id = ${hc} ORDER BY depth`;
    const rel1 = await historyDELETE(req('DELETE', '/api/user/history', { userId: H, body: { visitId: String(visits[1].id) } }));
    check('history: releasing one of two readings keeps the chain\'s pairings', rel1.status === 200 && (await countRows(H)) === 1);
    const rel2 = await historyDELETE(req('DELETE', '/api/user/history', { userId: H, body: { visitId: String(visits[0].id) } }));
    check('D9: releasing the last reading deletes the chain\'s pairings', rel2.status === 200 && (await countRows(H)) === 0);

    const hc2 = await newChain(H);
    await mapping(H, hc2, 'my cousin', 'the Parrot');
    const relChainHist = await historyDELETE(req('DELETE', '/api/user/history', { userId: H, body: { chainId: hc2 } }));
    const relChainBody = await json(relChainHist);
    check('history: chain release deletes the chain\'s pairings too', relChainHist.status === 200 && relChainBody.released === 1 && relChainBody.mappingsReleased === 1 && (await countRows(H)) === 0);
    const notFound = await historyDELETE(req('DELETE', '/api/user/history', { userId: H, body: { chainId: randomUUID() } }));
    check('history: releasing an unknown chain is still 404', notFound.status === 404);

    // ── journal whole-release integration ──────────────────────────────
    const J = await newUser('jour'); users.push(J);
    await mapping(J, await newChain(J), 'my teacher', 'the Wise Owl');
    await mapping(J, await newChain(J), 'my friend', 'the Messenger');
    const jr = await journalDELETE(req('DELETE', '/api/journal', { userId: J }));
    const jrBody = await json(jr);
    check('journal: whole release deletes every pairing', jr.status === 200 && jrBody.released.mappings === 2 && (await countRows(J)) === 0);
    check('journal: ...and the visits', (await sql`SELECT count(*)::int n FROM visit_record WHERE user_id = ${J}`)[0].n === 0);
    check('journal release did not touch another user', (await countRows(B)) === 1);
  } finally {
    for (const id of users) {
      try { await sql`DELETE FROM rate_limit_bucket WHERE key = ${'figmap:' + id}`; } catch { /* best-effort */ }
      try { await sql`DELETE FROM elder_user WHERE id = ${id}`; } catch { /* best-effort cleanup */ }
    }
  }

  if (failures > 0) {
    console.error(`\n${failures} check(s) failed.`);
    process.exit(1);
  }
  console.log('\nfigureMapping routes integration: all passed');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
