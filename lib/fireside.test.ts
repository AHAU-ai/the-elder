import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  buildFiresideSystem,
  FIRESIDE_RULES,
  KEPT_MAX_CHARS,
  MAX_CONTEXT_TURNS,
  MAX_SEEKER_CHARS,
  parseFiresideRequest,
  shouldPersist,
  validateKeptLine,
} from './fireside';
import { firesideStageAllows } from '../config/returning-features';

// ── The journal rule: only an ordinary, guardian-passed turn is written. ─────
assert.equal(shouldPersist('ordinary', true), true);
assert.equal(shouldPersist('crisis', true), false, 'crisis never written');
assert.equal(shouldPersist('distress', true), false, 'distress never written');
assert.equal(shouldPersist('ordinary', false), false, 'a declined reply is never written');

// ── Requests are validated, not repaired. ────────────────────────────────────
assert.deepEqual(parseFiresideRequest(null), { ok: false });
assert.deepEqual(parseFiresideRequest({ message: '   ' }), { ok: false });
assert.deepEqual(parseFiresideRequest({ message: 'x'.repeat(MAX_SEEKER_CHARS + 1) }), { ok: false });
const ok = parseFiresideRequest({ message: ' hello ', languageName: 'French' });
assert.ok(ok.ok && ok.message === 'hello' && ok.context.length === 0 && ok.languageName === 'French');
// A sitting must alternate user/assistant, starting with the seeker.
const u = (c: string) => ({ role: 'user', content: c });
const a = (c: string) => ({ role: 'assistant', content: c });
assert.ok(parseFiresideRequest({ message: 'm', context: [u('1'), a('2')] }).ok);
assert.equal(parseFiresideRequest({ message: 'm', context: [a('2'), u('1')] }).ok, false, 'must start with the seeker');
assert.equal(parseFiresideRequest({ message: 'm', context: [u('1')] }).ok, false, 'must end on the Elder');
assert.equal(parseFiresideRequest({ message: 'm', context: [u('1'), u('2')] }).ok, false, 'no injected double turns');
assert.equal(parseFiresideRequest({ message: 'm', context: [{ role: 'system', content: 'x' }, a('y')] }).ok, false, 'no system turns from the client');
const tooLong = Array.from({ length: MAX_CONTEXT_TURNS + 1 }, () => [u('1'), a('2')]).flat();
assert.equal(parseFiresideRequest({ message: 'm', context: tooLong }).ok, false, 'bounded context');
assert.equal(parseFiresideRequest({ message: 'm', context: 'nope' }).ok, false);
assert.equal((parseFiresideRequest({ message: 'm', languageName: 'x'.repeat(100) }) as { languageName: string }).languageName, 'English');

// ── Only the seeker's own, bounded line can leave the room for the Tree. ─────
assert.deepEqual(validateKeptLine('  a line of mine  '), { ok: true, line: 'a line of mine' });
assert.deepEqual(validateKeptLine('a\u0000\n\nb'), { ok: true, line: 'a b' });
assert.deepEqual(validateKeptLine(''), { ok: false, reason: 'empty' });
assert.deepEqual(validateKeptLine('ab'), { ok: false, reason: 'short' });
assert.deepEqual(validateKeptLine('x'.repeat(KEPT_MAX_CHARS + 1)), { ok: false, reason: 'long' });
assert.deepEqual(validateKeptLine(42), { ok: false, reason: 'not_text' });

// ── The Elder is told to host, not read, and never to pull the seeker back. ──
for (const must of [/not a Reading/i, /NO memory of any earlier sitting/, /Never express a wish for the seeker to stay, return/, /not a therapist/]) {
  assert.match(FIRESIDE_RULES, must);
}
const base = { frame: 'FRAME', ceiling: 'CEILING', handoff: 'HANDOFF' };
const plain = buildFiresideSystem(base, false);
const heavy = buildFiresideSystem(base, true);
assert.ok(plain.startsWith('FRAME') && plain.includes('CEILING') && plain.includes('HANDOFF'));
assert.ok(!/DISTRESS AWARENESS/.test(plain));
assert.ok(/DISTRESS AWARENESS/.test(heavy));

// ── Dark by default; testers first. ──────────────────────────────────────────
const saved = { e: process.env.FIRESIDE_ENABLED, a: process.env.FIRESIDE_ALL_SEEKERS };
try {
  delete process.env.FIRESIDE_ENABLED; delete process.env.FIRESIDE_ALL_SEEKERS;
  assert.equal(firesideStageAllows(true), false, 'closed for testers too');
  process.env.FIRESIDE_ALL_SEEKERS = 'true';
  assert.equal(firesideStageAllows(true), false, 'stage 2 alone lights nothing');
  delete process.env.FIRESIDE_ALL_SEEKERS;
  process.env.FIRESIDE_ENABLED = 'true';
  assert.equal(firesideStageAllows(true), true);
  assert.equal(firesideStageAllows(false), false, 'stage 1: testers only');
  process.env.FIRESIDE_ALL_SEEKERS = 'true';
  assert.equal(firesideStageAllows(false), true);
} finally {
  if (saved.e === undefined) delete process.env.FIRESIDE_ENABLED; else process.env.FIRESIDE_ENABLED = saved.e;
  if (saved.a === undefined) delete process.env.FIRESIDE_ALL_SEEKERS; else process.env.FIRESIDE_ALL_SEEKERS = saved.a;
}

// ── The route reuses the safety spine and writes only through the one rule. ──
const route = readFileSync(join(__dirname, '..', 'app', 'api', 'fireside', 'route.ts'), 'utf8');
const at = (needle: string) => route.indexOf(needle);
assert.ok(at('assessWelfare(') > 0, 'welfare gate is called');
assert.ok(at('dualGuardReading(') > 0, 'dual guardian is called');
assert.ok(at("welfare.tier === 'crisis'") > 0 && at("welfare.tier === 'crisis'") < at('model: PRIMARY_MODEL'), 'crisis returns before any generation');
assert.ok(at('dualGuardReading(') < at('saveFiresideEntry('), 'nothing is saved before the guardian passes');
assert.equal((route.match(/saveFiresideEntry\(/g) ?? []).length, 1, 'exactly one call site');
assert.ok(route.includes('shouldPersist('), 'the journal rule gates the one write');
assert.ok(/saveFiresideEntry\([^)]*\)/.test(route) && route.indexOf('shouldPersist(') < route.lastIndexOf('saveFiresideEntry('), 'the write sits behind the rule');

console.log('fireside: ok');
