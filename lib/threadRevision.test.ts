import assert from 'node:assert/strict';
import { cleanRevisedValue } from './threadRevision';

// Only the seeker's own plain words survive: bounded, cleaned, never invented.
assert.equal(cleanRevisedValue('  the letter I never sent  '), 'the letter I never sent');
assert.equal(cleanRevisedValue('a' + String.fromCharCode(0) + String.fromCharCode(10) + 'b c'), 'a b c');
assert.equal(cleanRevisedValue('ab'), null, 'too short');
assert.equal(cleanRevisedValue(''), null);
assert.equal(cleanRevisedValue('x'.repeat(121)), null, 'too long');
assert.equal(cleanRevisedValue('x'.repeat(120))?.length, 120);
assert.equal(cleanRevisedValue(42), null);
assert.equal(cleanRevisedValue(null), null);
console.log('threadRevision: ok');
