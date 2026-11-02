import assert from 'node:assert/strict';
import { classifyReviewer, auditFile, unreviewedApproved, strictFailures, formatAudit } from './corpusReviewAudit';

let passed = 0;
function test(name: string, fn: () => void) { try { fn(); passed++; } catch (e) { console.error(`FAIL ${name}\n`, e); process.exit(1); } }

test('classifies every reviewer label found in the real corpus', () => {
  assert.equal(classifyReviewer('Vincent J. Stanzione'), 'named_human');
  assert.equal(classifyReviewer('ahau-ai-seed'), 'seed');
  assert.equal(classifyReviewer('jesse-dev-override-2026-09-10'), 'dev_override');
  assert.equal(classifyReviewer('jesse-operator-decision'), 'dev_override');
  assert.equal(classifyReviewer('[name retracted 2026-08-24]'), 'retracted');
  assert.equal(classifyReviewer(null), 'none');
  assert.equal(classifyReviewer(undefined), 'none');
  assert.equal(classifyReviewer('   '), 'none');
  assert.equal(classifyReviewer(42), 'none');
});

test('only approved passages are counted; drafts and pending are ignored', () => {
  const a = auditFile('x.json', [
    { review_status: 'approved', reviewed_by: 'Jane Doe' },
    { review_status: 'approved', reviewed_by: null },
    { review_status: 'pending', reviewed_by: 'Jane Doe' },
    { review_status: 'draft' },
  ]);
  assert.equal(a.total, 4); assert.equal(a.approved, 2);
  assert.deepEqual([a.byReviewer.named_human, a.byReviewer.none], [1, 1]);
  assert.equal(unreviewedApproved(a), 1);
});

test('REGRESSION: approved-with-no-reviewer is flagged, not treated as fine', () => {
  const a = auditFile('norse-edda.json', [{ review_status: 'approved' }]);
  assert.equal(unreviewedApproved(a), 1);
  assert.match(formatAudit([a]), /FLAG norse-edda\.json/);
});

test('strict mode selects only the named lineages that have unreviewed approvals', () => {
  const good = auditFile('kiche.json', [{ review_status: 'approved', reviewed_by: 'Vincent J. Stanzione' }]);
  const seed = auditFile('taoist.json', [{ review_status: 'approved', reviewed_by: 'ahau-ai-seed' }]);
  const norse = auditFile('norse.json', [{ review_status: 'approved' }]);
  assert.deepEqual(strictFailures([good, seed, norse], ['kiche', 'norse']).map((a) => a.file), ['norse.json']);
  assert.deepEqual(strictFailures([good, seed, norse], []), []);
});

console.log(`corpusReviewAudit: ${passed} passed`);
