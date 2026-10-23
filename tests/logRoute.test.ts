/**
 * /api/log must never accept anomaly records from the public.
 *
 * Anomaly records are the "what surprised us" signal. They are written by the
 * server itself, in-process (lib/recordAnomaly.ts). The public /api/log route
 * used to accept them too, with a self-declared `_source`, so anyone could
 * forge one (V2 spec F6 / AR-05, reproduced 2026-10-10). This test pins the
 * closed door: a forged anomaly leaves no trace, while the two legitimate
 * client beacons (session summary, portal funnel) still work.
 *
 * No database is needed: the route's only observable effects here are the
 * webhook forward (a spied global fetch) and console output.
 */
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';

delete process.env.DATABASE_URL;
process.env.ELDER_LOG_WEBHOOK = 'http://hook.invalid/elder';

const forwarded: Array<Record<string, unknown>> = [];
const realFetch = globalThis.fetch;
globalThis.fetch = (async (_url: unknown, init?: { body?: string }) => {
  forwarded.push(JSON.parse(String(init?.body ?? '{}')));
  return new Response('ok');
}) as typeof fetch;

const logged: string[] = [];
const realError = console.error;
console.error = (...args: unknown[]) => { logged.push(args.map(String).join(' ')); };

async function post(body: unknown, ip: string) {
  const { POST } = await import('../app/api/log/route');
  const req = new NextRequest('http://localhost/api/log', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': ip },
    body: JSON.stringify(body),
  });
  const res = await POST(req);
  assert.equal(res.status, 200, 'telemetry always answers 200');
  assert.deepEqual(await res.json(), { ok: true });
}

(async () => {
  // 1. A forged anomaly, claiming to come from the server, is dropped whole.
  await post({ kind: 'near_miss', voice: 'mekubal', note: 'FORGED', _source: 'divine_route' }, '203.0.113.1');
  assert.equal(forwarded.length, 0, 'a forged anomaly is not forwarded to the webhook');
  assert.equal(logged.filter(l => l.includes('OBSERVATORY') || l.includes('anomaly_record')).length, 0,
    'a forged anomaly is not recorded or logged as an anomaly');

  // 2. Every kind the table accepts is refused, whatever the claimed source.
  for (const kind of ['silence', 'near_miss', 'jailbreak_shape', 'out_of_distribution']) {
    await post({ kind, _source: 'divine_route', note: 'x' }, '203.0.113.2');
  }
  assert.equal(forwarded.length, 0, 'no anomaly kind is accepted from the public');

  // 3. The legitimate beacons still work (positive control).
  await post({ sessionId: 's1', lineage: 'Shamanism', exchangeCount: 3, readingTriggered: true, readingCompleted: true, durationSeconds: 90, crisisFlag: false }, '203.0.113.3');
  assert.equal(forwarded.length, 1, 'a session summary is still forwarded');
  assert.equal(forwarded[0].sessionId, 's1');
  assert.equal('kind' in forwarded[0], false, 'a session summary carries no anomaly kind');

  await post({ portal: 'crossed', extra: 'dropped' }, '203.0.113.4');
  assert.equal(forwarded.length, 2, 'a portal beacon is still forwarded');
  assert.deepEqual(forwarded[1], { portal: 'crossed' }, 'only the closed-set field survives');

  // 4. A body that is a session summary AND claims a kind is treated as an anomaly claim and dropped.
  await post({ sessionId: 's2', kind: 'near_miss' }, '203.0.113.5');
  assert.equal(forwarded.length, 2, 'a summary that also claims an anomaly kind is dropped');

  console.error = realError;
  globalThis.fetch = realFetch;
  console.log('logRoute: ok');
})().catch(err => {
  console.error = realError;
  console.error(err);
  process.exit(1);
});
