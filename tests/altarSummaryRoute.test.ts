/**
 * /api/admin/altar-summary is operator-only. It reads what seekers said back,
 * so the door must fail closed: no secret configured means no access, a wrong
 * or missing header means no access, and no error body may leak detail.
 *
 * No database is needed: every path asserted here returns before the query.
 */
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { parseDays, DEFAULT_DAYS, MAX_DAYS } from '../lib/altarSummaryQuery';

delete process.env.DATABASE_URL;

async function get(headers: Record<string, string> = {}, qs = '') {
  const { GET } = await import('../app/api/admin/altar-summary/route');
  return GET(new NextRequest(`http://localhost/api/admin/altar-summary${qs}`, { headers }));
}

let passed = 0;
async function test(name: string, fn: () => Promise<void> | void) {
  try { await fn(); passed++; } catch (e) { console.error(`FAIL ${name}\n`, e); process.exit(1); }
}

(async () => {
  await test('REGRESSION: with ADMIN_SECRET unset the route is closed — even to "Bearer undefined"', async () => {
    delete process.env.ADMIN_SECRET;
    for (const h of [{}, { authorization: 'Bearer undefined' }, { authorization: 'Bearer ' }, { authorization: 'Bearer' }]) {
      assert.equal((await get(h)).status, 401);
    }
  });

  await test('a missing, wrong, or near-miss secret is refused', async () => {
    process.env.ADMIN_SECRET = 'correct-horse';
    assert.equal((await get()).status, 401);
    assert.equal((await get({ authorization: 'Bearer wrong' })).status, 401);
    assert.equal((await get({ authorization: 'Bearer correct-hors' })).status, 401);   // prefix
    assert.equal((await get({ authorization: 'Bearer correct-horsee' })).status, 401); // superset
    assert.equal((await get({ authorization: 'correct-horse' })).status, 401);         // no scheme
  });

  await test('refusals are not cacheable and carry no detail', async () => {
    process.env.ADMIN_SECRET = 'correct-horse';
    const res = await get({ authorization: 'Bearer nope' });
    assert.equal(res.headers.get('cache-control'), 'no-store');
    assert.deepEqual(await res.json(), { error: 'unauthorized' });
  });

  await test('the right secret passes auth and then fails closed without a database', async () => {
    process.env.ADMIN_SECRET = 'correct-horse';
    const res = await get({ authorization: 'Bearer correct-horse' });
    assert.equal(res.status, 503);
    assert.deepEqual(await res.json(), { error: 'no DATABASE_URL' });
  });

  await test('`days` is a whole number, clamped, with a safe default', () => {
    assert.equal(parseDays(null), DEFAULT_DAYS);
    assert.equal(parseDays(''), DEFAULT_DAYS);
    assert.equal(parseDays('abc'), DEFAULT_DAYS);
    assert.equal(parseDays('Infinity'), DEFAULT_DAYS);
    assert.equal(parseDays('30'), 30);
    assert.equal(parseDays('7.9'), 7);
    assert.equal(parseDays('0'), 1);
    assert.equal(parseDays('-5'), 1);
    assert.equal(parseDays('999999'), MAX_DAYS);
  });

  await test('REGRESSION: the shared query never selects user_id', async () => {
    const { readFileSync } = await import('node:fs');
    const { join } = await import('node:path');
    const src = readFileSync(join(__dirname, '..', 'lib', 'altarSummaryQuery.ts'), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    assert.doesNotMatch(src, /user_id/);
  });

  console.log(`altarSummaryRoute: ${passed} passed`);
})();
