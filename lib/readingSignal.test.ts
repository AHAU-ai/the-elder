// lib/readingSignal.test.ts
//
// Each test is a way the post-Reading signal silently failed to reach the
// ledger. The first version of this loop shipped with all of them.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { isValidProvenance, provenanceFromMetadata, type SignalProvenance } from './readingSignal';
import { SIGNAL_VALUES } from './altar-types';

const ROOT = join(__dirname, '..');
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8');

let passed = 0;
function test(name: string, fn: () => void) {
  try { fn(); passed++; } catch (e) { console.error(`FAIL ${name}\n`, e); process.exit(1); }
}

// The exact shape /api/divine returns (provenanceMetadata() in src/resilience/provenance.ts).
const FROM_SERVER = {
  corpus_version: '2026.06.10-pre-markup',
  model_version: 'claude-sonnet-4-6',
  contract_version: 'v1',
  voice: 'kiche',
  passage_ids: [],
  generated_at: '2026-11-01T00:00:00Z',
};

test('server metadata (snake_case) maps to the signal layer (camelCase) and validates', () => {
  const p = provenanceFromMetadata(FROM_SERVER);
  assert.deepEqual(p, {
    corpusVersion: '2026.06.10-pre-markup',
    modelVersion: 'claude-sonnet-4-6',
    contractVersion: 'v1',
  });
  assert.equal(isValidProvenance(p), true);
});

test('REGRESSION: the raw snake_case object, passed straight through, is NOT valid', () => {
  // This is what CouncilTabs used to hand ReadingSignal (nothing at all, and
  // had it passed the raw object it would have failed here). It is why every
  // tap was discarded before reaching the server.
  assert.equal(isValidProvenance(FROM_SERVER as unknown as SignalProvenance), false);
});

test('missing, empty and "unset" provenance are all invalid', () => {
  assert.equal(provenanceFromMetadata(null), undefined);
  assert.equal(provenanceFromMetadata(undefined), undefined);
  assert.equal(isValidProvenance(undefined), false);
  assert.equal(isValidProvenance({}), false);
  assert.equal(isValidProvenance({ corpusVersion: 'c', modelVersion: 'm', contractVersion: '' }), false);
  assert.equal(isValidProvenance({ corpusVersion: 'c', modelVersion: 'unset', contractVersion: 'k' }), false);
  // Non-string values in the metadata are dropped, not coerced.
  assert.equal(
    isValidProvenance(provenanceFromMetadata({ corpus_version: 1, model_version: 'm', contract_version: 'k' })),
    false,
  );
});

test('REGRESSION: /api/altar derives its valid signals from the shared type, not a private copy', () => {
  const route = read('app/api/altar/route.ts');
  assert.match(route, /new Set<string>\(SIGNAL_VALUES\)/);
  // A hand-written list is how "sitting" would be accepted by the client and silently dropped here.
  assert.doesNotMatch(route, /new Set\(\[\s*"landed"/);
  for (const v of SIGNAL_VALUES) assert.ok(SIGNAL_VALUES.includes(v));
  assert.ok(SIGNAL_VALUES.includes('sitting'));
});

test('REGRESSION: the live mount hands ReadingSignal a provenance, a stable id, and waits for the Reading to settle', () => {
  const tabs = read('app/components/CouncilTabs.tsx');
  const mount = tabs.match(/<ReadingSignal[\s\S]*?\/>/);
  assert.ok(mount, 'ReadingSignal is rendered in CouncilTabs');
  assert.match(mount![0], /provenance=\{provenanceFromMetadata\(firstReadingProvenance\)\}/);
  // An inline randomUUID() in the JSX mints a new id on every render.
  assert.doesNotMatch(mount![0], /randomUUID/);
  assert.match(mount![0], /sessionId=\{signalSessionId\}/);
  // The closing must not appear mid-Reading.
  assert.match(tabs, /settled\['first'\] && \(\s*<ReadingSignal/);
});

test('the component sends to the server on the tap and uses the tested calendar engine', () => {
  const comp = read('app/components/ReadingSignal.tsx');
  assert.match(comp, /sendSignal\(entry\)/);
  assert.match(comp, /todaysDaySign\(\)/);
  // The UTC-midnight re-derivation that turned the day-sign over at 7pm Eastern.
  assert.doesNotMatch(comp, /ANCHOR_MS|ANCHOR_NAHUAL/);
});

test('migration 033 only ever removes a constraint; it never touches data', () => {
  const sql = read('migrations/033_altar_signal_sitting.sql').replace(/--.*$/gm, '');
  assert.match(sql, /DROP CONSTRAINT IF EXISTS altar_record_signal_check/);
  assert.doesNotMatch(sql, /\b(DELETE|UPDATE|INSERT|TRUNCATE|DROP TABLE|ADD COLUMN)\b/i);
});

console.log(`readingSignal: ${passed} passed`);
