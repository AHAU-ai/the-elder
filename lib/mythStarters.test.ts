// lib/mythStarters.test.ts
//
// The tradition-voiced starters (lib/mythStarters.ts) are unreviewed copy for
// several voices, so the one thing we can check mechanically is that none of
// them speaks a term its own voice's guardian would reject, and that they only
// attach to real, deployed voices. Run: tsx lib/mythStarters.test.ts

import assert from 'node:assert/strict';
import { MYTH_STARTERS_EN, MYTH_STARTERS_REVIEW, mythStartersFor } from './mythStarters';
import { TRADITION_MAP } from './traditions';
import { LINEAGES } from './lineages';

// Lineage keys that name a differently-keyed voice in lib/traditions.ts.
const VOICE_FOR_LINEAGE: Record<string, string> = { maya: 'kiche' };

function escapeRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

let passed = 0;
function test(name: string, fn: () => void) {
  try {
    fn();
    passed++;
    console.log('  ok  ' + name);
  } catch (e) {
    console.error('FAIL ' + name + '\n', e);
    process.exit(1);
  }
}

const map = TRADITION_MAP as Record<string, { forbidden: readonly string[]; governanceStatus: string }>;

test('starters are marked pending bearer review until a named person signs off', () => {
  assert.equal(MYTH_STARTERS_REVIEW.status, 'pending-bearer-review');
  assert.equal(MYTH_STARTERS_REVIEW.reviewedBy, null);
});

for (const [lineage, starters] of Object.entries(MYTH_STARTERS_EN)) {
  const voiceKey = VOICE_FOR_LINEAGE[lineage] ?? lineage;

  test(`${lineage}: is a real lineage and a deployed voice`, () => {
    assert.ok(lineage in LINEAGES, `${lineage} is not a lineage`);
    assert.ok(voiceKey in map, `${voiceKey} is not in TRADITION_MAP`);
    assert.equal(map[voiceKey].governanceStatus, 'active');
  });

  test(`${lineage}: three non-empty starters, each a question`, () => {
    assert.equal(starters!.length, 3);
    for (const s of starters!) {
      assert.ok(s.trim().length > 0);
      assert.ok(s.trim().endsWith('?'), `not a question: ${s}`);
    }
  });

  test(`${lineage}: no starter speaks a term its own voice forbids`, () => {
    // Skip prose-style forbidden entries (they carry "(" or ":"); the single
    // terms are the ones a seeker-facing string could actually contain.
    const terms = map[voiceKey].forbidden.filter((t) => !/[():]/.test(t));
    for (const s of starters!) {
      for (const term of terms) {
        const re = new RegExp(`(^|[^\\p{L}])${escapeRe(term)}($|[^\\p{L}])`, 'iu');
        assert.ok(!re.test(s), `"${s}" contains forbidden term "${term}"`);
      }
    }
  });
}

test('starters appear only in English, and only for lineages that have them', () => {
  assert.equal(mythStartersFor('norse', 'en').length, 3);
  assert.equal(mythStartersFor('norse', 'fr').length, 0);
  assert.equal(mythStartersFor('norse', 'ki').length, 0);
  assert.equal(mythStartersFor('dreamtime', 'en').length, 0);
  assert.equal(mythStartersFor('buddhist', 'en').length, 0);
  assert.equal(mythStartersFor('default', 'en').length, 0);
});

console.log(`mythStarters tests passed (${passed})`);
