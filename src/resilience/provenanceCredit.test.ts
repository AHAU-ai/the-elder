// The credit lines Vincent James Stanzione's permission letter (October 7, 2026, section 4) requires wherever his works are
// quoted, adapted or relied on. Every real source string in the repo's ojer_tzij corpus files is classified below, so a new
// corpus file whose source names him but is not covered here fails the corpus check at the bottom.
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import {
  renderProvenanceBlock,
  stanzioneCredits,
  STANZIONE_CREDIT_YEAR,
  STANZIONE_TRANSLATION_CREDIT,
  STANZIONE_WRITINGS_CREDIT,
  type RetrievedPassage,
  type ReadingProvenance,
} from './provenance';

function ok(name: string, fn: () => void) { fn(); console.log(`  ok  ${name}`); }
const passage = (source: string, id = 'p1'): RetrievedPassage => ({ passageId: id, section: 'Part IV', source });
const base = (passages: RetrievedPassage[]): ReadingProvenance => ({
  corpusVersion: 'v1', modelVersion: 'm1', contractVersion: 'c1', voiceKey: 'ojer_tzij', generatedAt: '2026-10-07T00:00:00Z', passages,
});

const TRANSLATION_SOURCES = [
  'Popol Wuj: Complete Translation & Interpretation, Vincent James Stanzione (MARCH 24 2026 master PDF)',
  'Popol Wuj: Introduction (Translation and Interpretation), Vincent James Stanzione, February 2024',
  'Popol Wuj: Layered Mythic Language (telegraphic rendering of the Stanzione translation)',
  'Popol Wuj, English translation by Vincent James Stanzione (2020-2025)',
  'Stanzione, Popol Wuj (Ximénez 1701–1703)',
];
const WRITINGS_SOURCES = [
  "Vinny's Teaching: The Soul's Movement Through Myth (Vincent Stanzione, Notion)",
  "Vinny's Ruminations (Vincent Stanzione, transcript summary, Notion)",
  'Popol Wuj: Teleportation Language of Myth, mechanism section (Vincent Stanzione teaching, Notion)',
];

ok("the credit lines are exactly the letter's wording, with the year in one constant", () => {
  assert.equal(
    STANZIONE_TRANSLATION_CREDIT,
    `Popol Wuj translation and interpretation by Vincent James Stanzione, © ${STANZIONE_CREDIT_YEAR} Vincent James Stanzione. Used with permission.`,
  );
  assert.equal(STANZIONE_WRITINGS_CREDIT, 'From the writings of Vincent James Stanzione. Used with permission.');
  assert.equal(STANZIONE_CREDIT_YEAR, '2026');
  assert.ok(!/[\[\]]/.test(STANZIONE_TRANSLATION_CREDIT), 'no placeholder bracket is ever shipped');
});
ok('every translation source earns the translation credit and only that', () => {
  for (const s of TRANSLATION_SOURCES) assert.deepEqual(stanzioneCredits([passage(s)]), [STANZIONE_TRANSLATION_CREDIT], s);
});
ok('every other-writings source earns the writings credit and only that', () => {
  for (const s of WRITINGS_SOURCES) assert.deepEqual(stanzioneCredits([passage(s)]), [STANZIONE_WRITINGS_CREDIT], s);
});
ok('a reading that drew on both owes both, once each, translation first', () => {
  const c = stanzioneCredits([passage(WRITINGS_SOURCES[0], 'a'), passage(TRANSLATION_SOURCES[0], 'b'), passage(TRANSLATION_SOURCES[1], 'c'), passage(WRITINGS_SOURCES[1], 'd')]);
  assert.deepEqual(c, [STANZIONE_TRANSLATION_CREDIT, STANZIONE_WRITINGS_CREDIT]);
});
ok("a source that does not name him owes nothing (other voices' passages are untouched)", () => {
  assert.deepEqual(stanzioneCredits([passage('The Book of the Dead (E.A. Wallis Budge translation, 1895)')]), []);
  assert.deepEqual(stanzioneCredits([]), []);
});
ok('the provenance block carries the credit when his text was drawn on, and not otherwise', () => {
  const withCredit = renderProvenanceBlock(base([passage(TRANSLATION_SOURCES[0])]));
  assert.ok(withCredit.includes(STANZIONE_TRANSLATION_CREDIT), withCredit);
  assert.ok(/instrument's own/.test(withCredit), 'the sourcing-not-sanction sentence is still there');
  const other = renderProvenanceBlock(base([passage('The Book of the Dead (E.A. Wallis Budge translation, 1895)')]));
  assert.ok(!/Stanzione/.test(other), other);
  const ungrounded = renderProvenanceBlock(base([]));
  assert.ok(!/Stanzione/.test(ungrounded) && /reflection only/.test(ungrounded), 'a reading that drew on nothing credits nothing');
});
ok('every corpus source that names him in the repo is classified by the rules above', () => {
  if (!existsSync('corpus')) return;
  const seen = new Set<string>();
  for (const f of readdirSync('corpus').filter(x => x.endsWith('.json'))) {
    let j: unknown;
    try { j = JSON.parse(readFileSync(`corpus/${f}`, 'utf8')); } catch { continue; }
    const arr = Array.isArray(j) ? j : ((j as { passages?: unknown[] }).passages ?? []);
    for (const p of arr as Array<{ source?: unknown }>) if (typeof p.source === 'string' && /stanzione/i.test(p.source)) seen.add(p.source);
  }
  for (const s of seen) {
    const c = stanzioneCredits([passage(s)]);
    assert.ok(c.length === 1, `a corpus source that names him earns exactly one credit line: ${s}`);
    assert.ok([...TRANSLATION_SOURCES, ...WRITINGS_SOURCES].includes(s), `this corpus source is not in the classified list; add it above so its credit is a decision, not an accident: ${s}`);
  }
});

console.log('provenanceCredit tests passed');
