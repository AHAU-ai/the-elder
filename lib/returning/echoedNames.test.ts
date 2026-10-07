import assert from 'node:assert/strict';
import { nameCandidates, scrubEchoedNames } from './echoedNames';

function ok(name: string, fn: () => void) { fn(); console.log(`  ok  ${name}`); }

const P12 = "My sister Maria Gonzalez Lopez and I have not spoken since our mother's funeral. Maria will not return my calls. Which character in the story is Maria Gonzalez Lopez?";

ok('finds the name the seeker tied to a role, across particles and several words', () => {
  const c = nameCandidates([P12]);
  assert.deepEqual(c.map(x => x.full), ['Maria Gonzalez Lopez']);
  assert.equal(c[0].role, 'your sister');
});
ok('finds "named" and "called" introductions with a neutral role', () => {
  const c = nameCandidates(['There is a man named Carlos Vega at work, and a woman called Dana.']);
  assert.deepEqual(c.map(x => x.full).sort(), ['Carlos Vega', 'Dana']);
  assert.ok(c.every(x => x.role === 'this person'));
});
ok('handles particles inside a name and drops a dangling one', () => {
  assert.deepEqual(nameCandidates(['my boss Ana de la Cruz said no']).map(x => x.full), ['Ana de la Cruz']);
  assert.deepEqual(nameCandidates(['my friend Ana de said']).map(x => x.full), ['Ana']);
});
ok('does not treat ordinary capitalized words as names', () => {
  assert.deepEqual(nameCandidates(['I went to the Popol Vuh reading with the Hero Twin on Monday']), []);
  assert.deepEqual(nameCandidates(['My sister is unwell and I told Maria off']), []);
});

ok('scrubs the full name, a part of it, and a possessive (the P12 failure)', () => {
  const model = "I will not name Maria Gonzalez Lopez as a character. Maria's silence is her own; Gonzalez is a name I do not use.";
  const r = scrubEchoedNames(model, [P12]);
  assert.ok(!/Maria|Gonzalez|Lopez/.test(r.text), r.text);
  assert.ok(r.text.includes('your sister'), r.text);
  assert.ok(r.text.includes("Your sister's silence"), 'a sentence-start replacement is capitalized, the possessive survives: ' + r.text);
  assert.ok(r.replaced >= 3);
});
ok('leaves a response with no name untouched, byte for byte', () => {
  const t = 'In this telling, a figure like the Weaver stands at the threshold. Does that fit?';
  const r = scrubEchoedNames(t, [P12]);
  assert.equal(r.text, t);
  assert.equal(r.replaced, 0);
});
ok('matching is case-sensitive: a name "Mark" never scrubs the word "mark"', () => {
  const r = scrubEchoedNames('Mark the moment the seed goes under; Mark would not say.', ['my brother Mark called me']);
  assert.equal(r.text, 'Your brother the moment the seed goes under; your brother would not say.'.replace('Your brother the moment', 'Your brother the moment'));
  // the sentence-initial "Mark" is the name as the seeker wrote it, so it is scrubbed; lowercase "mark" elsewhere is not
  const r2 = scrubEchoedNames('Leave a mark on the story.', ['my brother Mark called me']);
  assert.equal(r2.text, 'Leave a mark on the story.');
});
ok('protects words that belong to the figure or the myth', () => {
  const r = scrubEchoedNames('The Hero Twin stands at the threshold.', ['my friend Hero Twin said so'], ['The Hero Twin']);
  assert.equal(r.text, 'The Hero Twin stands at the threshold.');
});
ok('does not split inside longer words', () => {
  const r = scrubEchoedNames('Mariana crossed the water.', [P12]);
  assert.equal(r.text, 'Mariana crossed the water.');
});
ok('special characters in a name are matched literally', () => {
  const r = scrubEchoedNames("O'Brien-Smith left. Then O'Brien-Smith returned.", ["my boss O'Brien-Smith left"]);
  assert.ok(!r.text.includes("O'Brien"), r.text);
});
ok('is idempotent and safe on empty input', () => {
  const once = scrubEchoedNames('Maria Gonzalez Lopez is not a character.', [P12]);
  const twice = scrubEchoedNames(once.text, [P12]);
  assert.equal(twice.text, once.text);
  assert.equal(scrubEchoedNames('', [P12]).text, '');
  assert.equal(scrubEchoedNames('anything', []).text, 'anything');
});
ok('uses names from earlier messages of the conversation', () => {
  const r = scrubEchoedNames('And Priya, what did she carry?', ['my colleague Priya took the credit', 'what does that mean?']);
  assert.ok(!r.text.includes('Priya'), r.text);
});

console.log('echoedNames tests passed');
