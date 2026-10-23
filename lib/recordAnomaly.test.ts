import assert from 'node:assert/strict';
import { sanitizeAnomaly, recordAnomaly, scheduleAnomaly, ANOMALY_KINDS } from './recordAnomaly';

// Well-formed records pass; `source` is whatever trusted server code supplies.
const ok = sanitizeAnomaly({ kind: 'near_miss', voice: 'mekubal', at: '2026-10-10T01:02:03Z', note: 'n' }, 'divine_route');
assert.deepEqual(ok, { kind: 'near_miss', voice: 'mekubal', at: '2026-10-10T01:02:03.000Z', note: 'n', source: 'divine_route' });

// Every table kind is accepted; anything else is not.
for (const kind of ANOMALY_KINDS) assert.ok(sanitizeAnomaly({ kind }, 's'), `accepts ${kind}`);
for (const bad of [null, undefined, 'x', 42, [], {}, { kind: 'portal' }, { kind: 'DROP TABLE' }, { kind: 7 }]) {
  assert.equal(sanitizeAnomaly(bad, 's'), null, `rejects ${JSON.stringify(bad)}`);
}

// A client-style `_source` in the record is ignored; the server's `source` argument wins.
const forged = sanitizeAnomaly({ kind: 'silence', _source: 'divine_route', source: 'divine_route' }, 'trusted');
assert.equal(forged?.source, 'trusted', 'record-supplied source is never used');

// Bounds: note 200, voice 64, source 100; bad dates fall back to now.
const long = sanitizeAnomaly({ kind: 'silence', note: 'x'.repeat(5000), voice: 'v'.repeat(500), at: 'not a date' }, 's'.repeat(500));
assert.equal(long?.note?.length, 200);
assert.equal(long?.voice?.length, 64);
assert.equal(long?.source.length, 100);
assert.ok(Number.isFinite(Date.parse(long!.at)), 'invalid date replaced with a valid one');
assert.equal(sanitizeAnomaly({ kind: 'silence', note: 7, voice: {} }, 's')?.note, null, 'non-string note becomes null');

// recordAnomaly and scheduleAnomaly never throw, with or without a database or a request scope.
delete process.env.DATABASE_URL;
delete process.env.ELDER_LOG_WEBHOOK;
const realError = console.error;
const lines: string[] = [];
console.error = (...a: unknown[]) => { lines.push(a.map(String).join(' ')); };

(async () => {
  await recordAnomaly({ kind: 'silence', note: 'no db' }, 'divine_route');
  await recordAnomaly('garbage', 'divine_route');
  scheduleAnomaly({ kind: 'jailbreak_shape' }, 'divine_route'); // outside a request scope: falls back, does not throw
  await new Promise(r => setTimeout(r, 20));
  console.error = realError;
  assert.ok(lines.some(l => l.includes('OBSERVATORY') && l.includes('no db')), 'without a database it logs to stderr');
  assert.equal(lines.filter(l => l.includes('garbage')).length, 0, 'garbage is dropped silently');
  console.log('recordAnomaly: ok');
})().catch(e => { console.error = realError; console.error(e); process.exit(1); });
