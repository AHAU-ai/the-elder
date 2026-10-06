import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripCorpusMarker } from './corpusMarker';

const D = String.fromCharCode(0x29c1);
function ok(name: string, fn: () => void) { fn(); console.log(`  ok  ${name}`); }

ok('removes a marker on its own final line', () => {
  const out = stripCorpusMarker(`The seed went under.\n${D}CORPUS:xibalba_descent:ixkik_blood_woman${D}`).trimEnd();
  assert.equal(out, 'The seed went under.');
});
ok('removes every marker, not just the first', () => {
  const out = stripCorpusMarker(`a ${D}CORPUS:one:two${D} b ${D}CORPUS:three:four${D} c`);
  assert.equal(out, 'a  b  c');
});
ok('leaves text without a marker byte-identical', () => {
  const t = 'Nothing to strip here. What do you carry?';
  assert.equal(stripCorpusMarker(t), t);
});
ok('leaves other signals alone (they have their own strips)', () => {
  const t = `x ${D}CEILING:learning_tradition${D} y ${D}MYTH:The Twins${D}`;
  assert.equal(stripCorpusMarker(t), t);
});
ok('does not eat across an unterminated marker', () => {
  const t = `keep this ${D}CORPUS:never closed and more text`;
  assert.equal(stripCorpusMarker(t), t);
});
ok('does not swallow text between two different signals', () => {
  const out = stripCorpusMarker(`${D}CORPUS:a:b${D} middle ${D}MYTH:X${D}`);
  assert.equal(out, ` middle ${D}MYTH:X${D}`);
});

ok('the route strips the marker from the text the guardian and the seeker see', () => {
  const route = readFileSync('app/api/divine/route.ts', 'utf8');
  assert.ok(route.includes("from '@/lib/corpusMarker'"), 'the route imports stripCorpusMarker');
  assert.ok(/const stripped = stripCorpusMarker\(strippedSignals\);/.test(route), 'the route applies it to the cleaned text');
});

console.log('corpusMarker tests passed');
