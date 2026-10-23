/**
 * counterpartMatch.test.ts -- hermetic tests for the counterpart basis rule
 * (lib/returning/counterpartMatch.ts): normalization and matching only. The
 * database loader is exercised by tests/figureContinuityRoute.integration.test.ts.
 *
 * Run: npx tsx lib/returning/counterpartMatch.test.ts
 */
import assert from 'node:assert/strict';
import { normalizeTerm, matchCounterpart, type CandidatePassage } from './counterpartMatch';

const cp = (...n: number[]) => String.fromCodePoint(...n);

// ── normalization ──
assert.equal(normalizeTerm('The Maize Maiden'), 'maize maiden', 'case and a leading article');
assert.equal(normalizeTerm('  a   Weaver  '), 'weaver');
assert.equal(normalizeTerm('An Owl'), 'owl');
assert.equal(normalizeTerm('the'), 'the', 'a lone article is kept, not erased');
assert.equal(normalizeTerm('Ma' + cp(0xed) + 'z'), 'maiz', 'precomposed diacritics');
assert.equal(normalizeTerm('Mai' + cp(0x0301) + 'z'), 'maiz', 'combining diacritics');
assert.equal(normalizeTerm('Hun-Hunahpu, the Father!'), 'hun hunahpu the father', 'punctuation becomes space');
assert.equal(normalizeTerm("K'iche'"), 'k iche');
assert.equal(normalizeTerm(''), '');
assert.equal(normalizeTerm(undefined), '');
assert.equal(normalizeTerm(42), '');
assert.equal(normalizeTerm('...'), '');

const rows: CandidatePassage[] = [
  { passageId: 'pw-iv-012', section: 'Part IV - The Maize Maiden', themes: ['dawn', 'emergence'], nahuales: [] },
  { passageId: 'pw-ii-003', section: 'Part II - The Twins Descend', themes: ['descent', 'ballcourt'], nahuales: ["Junajpu", "Ixb'alamkej"] },
  { passageId: 'pw-iii-001', section: 'Part III', themes: ['Seven Macaw'], nahuales: [] },
];

// ── equality with themes and nahuales ──
assert.equal(matchCounterpart(rows, 'the Ballcourt'), 'pw-ii-003', 'theme, article dropped');
assert.equal(matchCounterpart(rows, 'DESCENT'), 'pw-ii-003', 'theme, case');
assert.equal(matchCounterpart(rows, 'Seven Macaw'), 'pw-iii-001', 'theme with a space');
assert.equal(matchCounterpart(rows, 'Junajpu'), 'pw-ii-003', 'nahual');
assert.equal(matchCounterpart(rows, "ixb'alamkej"), 'pw-ii-003', 'nahual with apostrophe and case');

// ── section: equality, or a whole-word phrase inside the title ──
assert.equal(matchCounterpart(rows, 'The Maize Maiden'), 'pw-iv-012', 'a character named in the section title');
assert.equal(matchCounterpart(rows, 'maize maiden'), 'pw-iv-012');
assert.equal(matchCounterpart(rows, 'Part IV - The Maize Maiden'), 'pw-iv-012', 'the whole title');
assert.equal(matchCounterpart(rows, 'Twins'), 'pw-ii-003', 'a whole word in a title');
assert.equal(matchCounterpart(rows, 'Part III'), 'pw-iii-001');

// ── no match: nothing is invented ──
for (const none of ['the Parrot', 'Maiz', 'maize maid', 'Twin', 'descen', 'Macaw', 'Odin', 'ab', '', '   ', '...']) {
  assert.equal(matchCounterpart(rows, none), null, `no match: ${JSON.stringify(none)}`);
}
assert.equal(matchCounterpart([], 'The Maize Maiden'), null, 'no approved passages: no corpus basis');
assert.equal(matchCounterpart(rows, 'x'.repeat(10000)), null);

// ── diacritics on either side ──
{
  const accented: CandidatePassage[] = [{ passageId: 'p-1', section: 'La Doncella del Ma' + cp(0xed) + 'z', themes: [], nahuales: [] }];
  assert.equal(matchCounterpart(accented, 'doncella del maiz'), 'p-1');
  assert.equal(matchCounterpart(accented, 'La Doncella del Ma' + cp(0xed) + 'z'), 'p-1');
}

// ── deterministic: lowest passage_id wins, regardless of input order ──
{
  const dup: CandidatePassage[] = [
    { passageId: 'z-9', section: 'Owl Council', themes: [], nahuales: [] },
    { passageId: 'a-1', section: 'The Owl', themes: [], nahuales: [] },
    { passageId: 'm-5', section: 'Owl', themes: ['owl'], nahuales: [] },
  ];
  assert.equal(matchCounterpart(dup, 'owl'), 'a-1');
  assert.equal(matchCounterpart([...dup].reverse(), 'owl'), 'a-1');
}

// ── malformed rows do not throw ──
assert.equal(matchCounterpart([{ passageId: 'p', section: undefined as unknown as string, themes: undefined as unknown as string[], nahuales: null as unknown as string[] }], 'owl'), null);

console.log('counterpartMatch tests passed');
