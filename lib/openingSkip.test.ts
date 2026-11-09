import assert from 'node:assert/strict';
import { openingRecentlySeen, markOpeningSeen, OPENING_SKIP_WINDOW_MS, OPENING_SEEN_KEY } from './openingSkip';

const mem = () => { const m = new Map<string, string>(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, v); } }; };
const t0 = 1_700_000_000_000;

assert.equal(openingRecentlySeen(mem(), t0), false, 'nothing stored: door shows');
assert.equal(openingRecentlySeen(null, t0), false, 'no storage: door shows');
const s = mem(); markOpeningSeen(s, t0);
assert.equal(openingRecentlySeen(s, t0 + 1000), true, 'just crossed');
assert.equal(openingRecentlySeen(s, t0 + OPENING_SKIP_WINDOW_MS - 1), true, 'inside window');
assert.equal(openingRecentlySeen(s, t0 + OPENING_SKIP_WINDOW_MS), false, 'window lapsed: door shows again');
assert.equal(openingRecentlySeen(s, t0 - 5000), false, 'clock set backwards: door shows');
const bad = mem(); bad.setItem(OPENING_SEEN_KEY, 'garbage');
assert.equal(openingRecentlySeen(bad, t0), false, 'garbage value: door shows');
const throwing = { getItem: () => { throw new Error('denied'); }, setItem: () => { throw new Error('denied'); } };
assert.equal(openingRecentlySeen(throwing, t0), false, 'storage throws: door shows');
markOpeningSeen(throwing, t0); // must not throw
console.log('openingSkip: 8 checks passed');
