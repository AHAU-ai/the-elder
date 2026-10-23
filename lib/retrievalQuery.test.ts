import assert from 'node:assert/strict';
import { applyRerank, buildDiagnosisQuery, cruzTerms, diagnosisQuery, parseDiagnosis, retrievalV2Enabled } from './retrievalQuery';
import { computeCruzMaya } from './chol-qij';

// Off by default.
delete process.env.CORPUS_RETRIEVAL_V2;
assert.equal(retrievalV2Enabled(), false);

// Parsing keeps only the five markers, bounded; junk is null.
assert.deepEqual(parseDiagnosis('{"wound":"a lost brother","extra":"x","threshold":" "}'), { wound: 'a lost brother' });
assert.equal(parseDiagnosis('not json'), null);
assert.equal(parseDiagnosis('{}'), null);
assert.equal(parseDiagnosis('{"wound":"' + 'w'.repeat(500) + '"}')!.wound!.length, 160);

// No diagnosis: literal words, exactly as today.
assert.equal(buildDiagnosisQuery('  my father died  ', null), 'my father died');

// A diagnosis leads, the seeker's words follow, and the Cruz position rides along.
const cruz = computeCruzMaya(new Date(1990, 5, 15));
const q = buildDiagnosisQuery('my father died and I cannot cross', { wound: 'grief for a father', threshold: 'a crossing' }, cruz);
assert.ok(q.startsWith('wound: grief for a father. threshold: a crossing.'));
assert.ok(q.includes('nahual: ' + cruzTerms(cruz)));
assert.ok(q.endsWith('my father died and I cannot cross'));
assert.ok(q.length <= 700);
assert.equal(cruzTerms(null), '');

// Long input stays bounded.
assert.ok(buildDiagnosisQuery('x'.repeat(5000), { wound: 'w' }, cruz).length <= 700);

// Rerank: best score first, malformed input keeps the order, duplicates and bad indices are ignored.
const items = ['a', 'b', 'c', 'd'];
assert.deepEqual(applyRerank(items, { data: [{ index: 2, relevance_score: 0.9 }, { index: 0, relevance_score: 0.4 }, { index: 3, relevance_score: 0.1 }] }, 2), ['c', 'a']);
assert.deepEqual(applyRerank(items, { data: [{ index: 9, relevance_score: 1 }, { index: 1, relevance_score: 0.2 }, { index: 1, relevance_score: 0.1 }] }, 3), ['b']);
assert.deepEqual(applyRerank(items, null, 2), ['a', 'b']);
assert.deepEqual(applyRerank(items, { data: [] }, 2), ['a', 'b']);

async function main() {
  // A failing judge returns the literal text.
  assert.equal(await diagnosisQuery('hello', async () => { throw new Error('down'); }), 'hello');
  assert.equal(await diagnosisQuery('hello', async () => 'garbage'), 'hello');
  assert.equal(await diagnosisQuery('   ', async () => '{"wound":"x"}'), '   ');
  assert.ok((await diagnosisQuery('hello', async () => '{"wound":"loneliness"}')).startsWith('wound: loneliness.'));
  console.log('retrievalQuery: ok');
}
main().catch((e) => { console.error(e); process.exit(1); });
