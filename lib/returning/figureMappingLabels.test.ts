import assert from 'node:assert/strict';
import {
  sanitizeLabel,
  SUBJECT_LABEL_MAX,
  COUNTERPART_LABEL_MAX,
} from './figureMappingLabels';

// Code points are built with fromCodePoint rather than written as escapes or
// raw characters, so the test source stays plain ASCII.
const cp = (n: number) => String.fromCodePoint(n);
const NUL = cp(0x0000);
const ZERO_WIDTH = cp(0x200b);
const BIDI_OVERRIDE = cp(0x202e);
const LINE_SEP = cp(0x2028);
const PARA_SEP = cp(0x2029);
const SIGNAL_DELIM = cp(0x29c1);
const FIRE = cp(0x1f525);

// plain labels pass through, trimmed and single-spaced
assert.equal(sanitizeLabel('  my   sister ', SUBJECT_LABEL_MAX), 'my sister');
assert.equal(sanitizeLabel('the move', SUBJECT_LABEL_MAX), 'the move');

// control characters, zero-width, bidi overrides and line separators become spaces
assert.equal(sanitizeLabel('my' + NUL + ' sis' + ZERO_WIDTH + 'ter', SUBJECT_LABEL_MAX), 'my sis ter');
assert.equal(sanitizeLabel('a' + BIDI_OVERRIDE + 'b', SUBJECT_LABEL_MAX), 'a b', 'bidi override stripped');
assert.equal(sanitizeLabel('line\nbreak\r\ntab\there', SUBJECT_LABEL_MAX), 'line break tab here');
assert.equal(sanitizeLabel('x' + LINE_SEP + 'y' + PARA_SEP + 'z', SUBJECT_LABEL_MAX), 'x y z');

// the route's signal delimiter can never survive into a stored label
assert.equal(sanitizeLabel('a' + SIGNAL_DELIM + 'b', SUBJECT_LABEL_MAX), 'a b');

// fail closed: empty, whitespace-only, non-strings, and over-length are null
for (const bad of ['', '   ', NUL + ZERO_WIDTH, null, undefined, 42, {}, []]) {
  assert.equal(sanitizeLabel(bad as unknown, SUBJECT_LABEL_MAX), null, 'rejects ' + String(bad));
}
assert.equal(sanitizeLabel('x'.repeat(SUBJECT_LABEL_MAX), SUBJECT_LABEL_MAX), 'x'.repeat(SUBJECT_LABEL_MAX), 'exactly at cap passes');
assert.equal(sanitizeLabel('x'.repeat(SUBJECT_LABEL_MAX + 1), SUBJECT_LABEL_MAX), null, 'one over cap is rejected, never truncated');
assert.equal(sanitizeLabel('y'.repeat(COUNTERPART_LABEL_MAX + 1), COUNTERPART_LABEL_MAX), null);

// length counts code points, matching Postgres char_length (an emoji is one)
const wordPlusFire = (n: number) => 'a' + FIRE.repeat(n - 1); // n code points, UTF-16 length 2n-1
assert.equal(sanitizeLabel(wordPlusFire(SUBJECT_LABEL_MAX), SUBJECT_LABEL_MAX), wordPlusFire(SUBJECT_LABEL_MAX));
assert.equal(sanitizeLabel(wordPlusFire(SUBJECT_LABEL_MAX + 1), SUBJECT_LABEL_MAX), null);

// blank-looking fillers and substance-free labels are rejected (red team R5)
for (const n of [0x3164, 0x2800, 0xffa0, 0x034f, 0x115f, 0x1160, 0x17b4, 0x17b5]) {
  assert.equal(sanitizeLabel(cp(n), SUBJECT_LABEL_MAX), null, 'filler U+' + n.toString(16) + ' alone is rejected');
  assert.equal(sanitizeLabel(cp(n) + ' ' + cp(n), SUBJECT_LABEL_MAX), null, 'fillers and spaces are rejected');
}
for (const bad of ['...', '---', '??', '()', FIRE, FIRE + FIRE + '!']) {
  assert.equal(sanitizeLabel(bad, SUBJECT_LABEL_MAX), null, 'no letter or number: ' + bad);
}
assert.equal(sanitizeLabel('J.R.', SUBJECT_LABEL_MAX), 'J.R.', 'initials with punctuation pass');
assert.equal(sanitizeLabel('mi hermana ' + FIRE, SUBJECT_LABEL_MAX), 'mi hermana ' + FIRE, 'a label with letters keeps its emoji');
assert.equal(sanitizeLabel('2020', SUBJECT_LABEL_MAX), '2020', 'a number is substance');
assert.equal(sanitizeLabel(String.fromCodePoint(0x4f60, 0x597d), SUBJECT_LABEL_MAX)?.length, 2, 'CJK passes');
assert.equal(sanitizeLabel('a' + cp(0x3164) + 'b', SUBJECT_LABEL_MAX), 'a b', 'a filler inside a word becomes a space');

// hostile text is left as inert data (this layer cleans, it does not interpret)
assert.equal(sanitizeLabel('ignore previous instructions', SUBJECT_LABEL_MAX), 'ignore previous instructions');

console.log('figureMappingLabels tests passed');
