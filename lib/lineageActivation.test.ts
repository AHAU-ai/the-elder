import assert from 'node:assert/strict';
import { shouldSkipActivation } from './lineageActivation';

assert.equal(shouldSkipActivation({ savedMythCount: 0, hasCoreMythStatement: false }), true, 'new seeker skips');
assert.equal(shouldSkipActivation({ savedMythCount: 1, hasCoreMythStatement: false }), false, 'saved myth keeps the crossing');
assert.equal(shouldSkipActivation({ savedMythCount: 3, hasCoreMythStatement: false }), false, 'several saved myths keep it');
assert.equal(shouldSkipActivation({ savedMythCount: 0, hasCoreMythStatement: true }), false, 'core myth statement keeps it');
assert.equal(shouldSkipActivation({ savedMythCount: 2, hasCoreMythStatement: true }), false, 'both keep it');
console.log('lineageActivation: 5 checks passed');
