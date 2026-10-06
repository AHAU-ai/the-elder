// The D7 sign-off approves ONE exact clause text. If the clause changes, the approval no longer
// covers what ships: this fails until the clause is re-reviewed and a new sign-off records its hash.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { FIGURE_CONTINUITY_CLAUSE } from './figureContinuityClause';

const DIR = 'governance/signoffs';
const files = readdirSync(DIR).filter(f => /-figure-continuity-clause-.+\.md$/.test(f)).sort();
const actual = createHash('sha256').update(FIGURE_CONTINUITY_CLAUSE).digest('hex');

if (files.length === 0) {
  console.log('  ok  no D7 sign-off recorded yet (nothing to bind the clause to)');
} else {
  const latest = files[files.length - 1];
  const text = readFileSync(`${DIR}/${latest}`, 'utf8').replace(/\r\n/g, '\n');
  const m = text.match(/\*\*Content-hash \(SHA-256\):\*\* `([0-9a-f]{64})`/);
  assert.ok(m, `${latest} records no content hash`);
  assert.equal(
    actual,
    m![1],
    `The Figure Continuity clause no longer matches the text approved in ${latest}. Re-review it (D7) and record a new sign-off; do not edit the hash to make this pass.`,
  );
  console.log(`  ok  the clause matches the text approved in ${latest}`);
}
console.log('figureContinuityClause sign-off test passed');
