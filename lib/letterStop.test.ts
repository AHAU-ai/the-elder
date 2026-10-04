import assert from 'node:assert/strict';
import { createHmac } from 'crypto';
import { signStopToken, verifyStopToken, letterStopKey, STOP_TOKEN_TTL_DAYS } from './letterStop';

const KEY = 'test-key-aaaaaaaaaaaaaaaaaaaaaaaa';
const NOW = Date.UTC(2026, 9, 3, 12);
const DAY = 24 * 60 * 60 * 1000;

const t = signStopToken(42, KEY, NOW);
assert.equal(verifyStopToken(t, KEY, NOW), 42, 'round-trips');
assert.equal(verifyStopToken(t, KEY, NOW + (STOP_TOKEN_TTL_DAYS - 1) * DAY), 42, 'valid just inside the ttl');
assert.equal(verifyStopToken(t, KEY, NOW + (STOP_TOKEN_TTL_DAYS + 1) * DAY), null, 'expires');
assert.equal(verifyStopToken(t, 'other-key', NOW), null, 'wrong key rejected');

// tampering with the user id or expiry invalidates the signature
const [id, exp, sig] = t.split('.');
assert.equal(verifyStopToken(`43.${exp}.${sig}`, KEY, NOW), null, 'user id tamper');
assert.equal(verifyStopToken(`${id}.${Number(exp) + DAY}.${sig}`, KEY, NOW), null, 'expiry tamper');
assert.equal(verifyStopToken(`${id}.${exp}.${sig.slice(0, -1)}0`, KEY, NOW), null, 'signature tamper');

// malformed input never throws
for (const bad of ['', 'a', 'a.b', 'a.b.c.d', '..', null, undefined]) {
  assert.equal(verifyStopToken(bad as string, KEY, NOW), null, `rejects ${String(bad)}`);
}
assert.equal(verifyStopToken(t, '', NOW), null, 'empty key rejected');

// purpose separation: a session-cookie-shaped MAC (no purpose prefix) is not a stop token
const payload = `42.${NOW + DAY}`;
const sessionLike = `${payload}.${createHmac('sha256', KEY).update(payload).digest('hex')}`;
assert.equal(verifyStopToken(sessionLike, KEY, NOW), null, 'a session cookie cannot be replayed as a stop token');

// key selection: the dedicated secret wins, so rotating the session secret
// does not invalidate stop links already emailed
assert.equal(letterStopKey({ ELDER_LETTER_STOP_SECRET: 'stop', ELDER_SESSION_SECRET: 'sess' }), 'stop');
assert.equal(letterStopKey({ ELDER_SESSION_SECRET: 'sess' }), 'sess', 'falls back to the session secret');
assert.equal(letterStopKey({}), null, 'no secret: no stop link');
const old = signStopToken(7, 'stop', NOW);
assert.equal(verifyStopToken(old, letterStopKey({ ELDER_LETTER_STOP_SECRET: 'stop', ELDER_SESSION_SECRET: 'rotated' })!, NOW), 7, 'survives a session-secret rotation');

console.log('letterStop tests passed');
