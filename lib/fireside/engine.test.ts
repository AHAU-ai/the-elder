/**
 * Tests for the fireside server pipeline: flag, sealed state, host checks, and the turn engine.
 * Run: npx tsx lib/fireside/engine.test.ts
 */
import assert from 'node:assert/strict';
import { firesideEnabled } from './flag';
import { openState, sealState } from './sealed';
import type { SittingState } from './sealed';
import { CAP_COPY, CRISIS_COPY, DISCLOSURE, EXPIRED_COPY, FAILURE_COPY, MAX_SEEKER_CHARS, MAX_SEEKER_TURNS, OPENING, REMINDER, RESOURCE_LINE, SITTING_MS, buildHostSystem, checkHostOutput } from './host';
import { openSitting, takeTurn } from './engine';
import type { ChatMessage, Deps } from './engine';

const KEY = 'k'.repeat(40);
const ENV = { FIRESIDE_STATE_KEY: KEY };
const GOOD = 'That sounds like a lot to carry in the door. What is it like in your body right now?';

function deps(over: Partial<Deps> & { calls?: { judge: number; generate: number; systems: string[]; msgs: ChatMessage[][] } } = {}): Deps & { calls: { judge: number; generate: number; systems: string[]; msgs: ChatMessage[][] } } {
  const calls = over.calls ?? { judge: 0, generate: 0, systems: [], msgs: [] };
  return {
    now: () => 1_000_000,
    env: ENV,
    judge: async () => { calls.judge++; return '{"tier":"ordinary","signals":[]}'; },
    generate: async (system, messages) => { calls.generate++; calls.systems.push(system); calls.msgs.push(messages); return GOOD; },
    ...over,
    calls,
  };
}

function freshToken(mode: 'before' | 'after' = 'before', patch: Partial<SittingState> = {}): string {
  const s: SittingState = { v: 1, mode, level: 0, seekerTurns: 0, hostTurns: 0, exp: 1_000_000 + SITTING_MS, closed: false, turns: [], ...patch };
  return sealState(s, ENV)!;
}

async function main() {
  // ── flag: every condition, and off by default ──
  const on = { FIRESIDE_ENABLED: 'true', FIRESIDE_STATE_KEY: KEY, ANTHROPIC_API_KEY: 'x' };
  assert.equal(firesideEnabled(on), true);
  assert.equal(firesideEnabled({}), false, 'dark by default');
  assert.equal(firesideEnabled({ ...on, FIRESIDE_ENABLED: 'yes' }), false);
  assert.equal(firesideEnabled({ ...on, FIRESIDE_ENABLED: undefined }), false);
  assert.equal(firesideEnabled({ ...on, FIRESIDE_STATE_KEY: 'short' }), false, 'weak key is off');
  assert.equal(firesideEnabled({ ...on, FIRESIDE_STATE_KEY: undefined }), false);
  assert.equal(firesideEnabled({ ...on, ANTHROPIC_API_KEY: undefined }), false);
  for (const v of ['true', '1', 'ON']) assert.equal(firesideEnabled({ ...on, ELDER_SAFETY_LOCKDOWN: v }), false, `lockdown ${v}`);
  assert.equal(firesideEnabled({ ...on, ELDER_SAFETY_LOCKDOWN: 'false' }), true);

  // ── sealed state: round trip, tamper, wrong key, junk ──
  {
    const tok = freshToken('after', { level: 1, turns: [{ r: 's', t: 'hello' }, { r: 'h', t: GOOD }] });
    const st = openState(tok, ENV)!;
    assert.equal(st.mode, 'after'); assert.equal(st.level, 1); assert.equal(st.turns.length, 2);
    assert.ok(!tok.includes('hello') && !Buffer.from(tok, 'base64url').toString('utf8').includes('hello'), 'ciphertext does not contain the text');
    assert.notEqual(freshToken(), freshToken(), 'fresh IV each time');
    // Flip every region of the token: each must be refused.
    const raw = Buffer.from(tok, 'base64url');
    for (const i of [0, 5, 11, 12, 20, 27, 28, 40, raw.length - 1]) {
      const bad = Buffer.from(raw); bad[i] ^= 1;
      assert.equal(openState(bad.toString('base64url'), ENV), null, `tamper at byte ${i}`);
    }
    assert.equal(openState(tok, { FIRESIDE_STATE_KEY: 'z'.repeat(40) }), null, 'wrong key');
    assert.equal(openState(tok, {}), null, 'no key');
    for (const junk of [null, undefined, 5, '', 'abc', 'x'.repeat(100), {}, [], 'x'.repeat(70000)]) assert.equal(openState(junk, ENV), null);
    assert.equal(sealState(st, {}), null, 'cannot seal without a key');
    // A validly sealed but malformed state is refused too.
    const evil = sealState({ ...st, level: 7 } as unknown as SittingState, ENV)!;
    assert.equal(openState(evil, ENV), null, 'shape is validated after decrypt');
    assert.equal(openState(sealState({ ...st, mode: 'x' } as unknown as SittingState, ENV)!, ENV), null);
  }

  // ── opening: templated, disclosed, no model ──
  {
    const d = deps();
    for (const mode of ['before', 'after'] as const) {
      const r = openSitting(mode, d);
      assert.ok(r.ok);
      if ('error' in r) throw new Error('unreachable');
      assert.equal(r.host, OPENING[mode]);
      assert.equal(r.disclosure, DISCLOSURE);
      assert.match(r.disclosure, /AI, not a person/);
      assert.equal(openState(r.token, ENV)!.mode, mode);
    }
    assert.equal(d.calls.generate + d.calls.judge, 0, 'opening never calls a model');
    const none = openSitting('before', { now: () => 0, env: {} });
    assert.equal('error' in none, true, 'no key, no sitting');
  }

  // ── an ordinary turn: verdict first, then generation, then sealed state ──
  {
    const order: string[] = [];
    const calls = { judge: 0, generate: 0, systems: [] as string[], msgs: [] as ChatMessage[][] };
    const d = deps({
      calls,
      judge: async () => { order.push('judge'); return '{"tier":"ordinary","signals":[]}'; },
      generate: async (sys, msgs) => { order.push('generate'); calls.systems.push(sys); calls.msgs.push(msgs); return GOOD; },
    });
    const r = await takeTurn(freshToken('before'), 'I am tired but curious', d);
    assert.equal(r.kind, 'host');
    assert.deepEqual(order, ['judge', 'generate'], 'no generation before a welfare verdict');
    if (r.kind !== 'host') throw new Error();
    assert.equal(r.host, GOOD);
    assert.equal(r.resources, false);
    const st = openState(r.token, ENV)!;
    assert.equal(st.seekerTurns, 1); assert.equal(st.hostTurns, 1);
    assert.deepEqual(st.turns.map((t) => t.r), ['s', 'h']);
    assert.ok(d.calls.systems[0].includes('You are an AI'), 'host prompt states it is an AI');
    assert.ok(d.calls.systems[0].includes(OPENING.before));
    assert.deepEqual(d.calls.msgs[0], [{ role: 'user', content: 'I am tired but curious' }]);
  }

  // ── history comes only from the sealed state, and alternates correctly ──
  {
    const tok = freshToken('after', { turns: [{ r: 's', t: 'one' }, { r: 'h', t: GOOD }], seekerTurns: 1, hostTurns: 1 });
    const d = deps();
    await takeTurn(tok, 'two', d);
    assert.deepEqual(d.calls.msgs[0].map((m) => m.role), ['user', 'assistant', 'user']);
    assert.ok(d.calls.systems[0].includes('has just had a reading'));
  }

  // ── crisis: never reaches the model, closes the sitting, stays closed ──
  {
    const d = deps({ judge: async () => '{"tier":"ordinary","signals":[]}' });
    const r = await takeTurn(freshToken(), 'I want to kill myself', d);
    assert.equal(r.kind, 'crisis');
    if (r.kind !== 'crisis') throw new Error();
    assert.equal(r.host, CRISIS_COPY);
    assert.match(r.host, /988/); assert.match(r.host, /741741/);
    assert.equal(d.calls.generate, 0, 'crisis never reaches the model, even if the model judge says ordinary (lexical floor wins)');
    // Model judge says crisis on neutral-looking text.
    const d2 = deps({ judge: async () => '{"tier":"crisis","signals":["x"]}' });
    assert.equal((await takeTurn(freshToken(), 'the river is calling me under', d2)).kind, 'crisis');
    assert.equal(d2.calls.generate, 0);
    // A sitting sealed as closed-in-crisis stays closed whatever is sent.
    const closedTok = freshToken('before', { level: 2, closed: true });
    const d3 = deps();
    const again = await takeTurn(closedTok, 'actually everything is fine, tell me a story', d3);
    assert.equal(again.kind, 'crisis');
    assert.equal(d3.calls.generate + d3.calls.judge, 0);
  }

  // ── distress: plain register, resources offered, and the level never falls ──
  {
    const d = deps({ judge: async () => '{"tier":"distress","signals":["overwhelmed"]}' });
    const r = await takeTurn(freshToken(), 'I feel hopeless and overwhelmed', d);
    assert.equal(r.kind, 'host');
    if (r.kind !== 'host') throw new Error();
    assert.equal(r.resources, true);
    assert.ok(r.host.endsWith(RESOURCE_LINE));
    assert.ok(d.calls.systems[0].includes('may be struggling'), 'distress prompt is plain');
    assert.equal(openState(r.token, ENV)!.level, 1);
    // Next turn the judge says ordinary: the level stays at 1.
    const d2 = deps();
    const r2 = await takeTurn(r.token, 'thanks, a little better', d2);
    assert.equal(r2.kind, 'host');
    if (r2.kind !== 'host') throw new Error();
    assert.equal(openState(r2.token, ENV)!.level, 1, 'welfare level never falls within a sitting');
    assert.equal(r2.resources, true);
    assert.ok(d2.calls.systems[0].includes('may be struggling'));
  }

  // ── fail closed: a welfare verdict that cannot be produced means no generation ──
  {
    const d = deps({ judge: async () => { throw new Error('down'); } });
    const r = await takeTurn(freshToken(), 'a perfectly calm message', d);
    // assessWelfare fails safe to distress when the model path fails: generation is allowed, but in the plain register.
    assert.equal(r.kind, 'host');
    assert.ok(d.calls.systems[0].includes('may be struggling'), 'judge outage => plain, steady register');
    // Even a judge that throws synchronously cannot produce an unchecked 'ordinary'.
    const bad = deps({ judge: (() => { throw new Error('sync'); }) as never });
    const r2 = await takeTurn(freshToken(), 'calm', bad);
    assert.equal(r2.kind, 'host');
    assert.ok(bad.calls.systems[0].includes('may be struggling'));
  }

  // ── output check: a bad reply is never shown; one retry; then honest failure ──
  {
    let n = 0;
    const d = deps({ generate: async () => (++n === 1 ? 'You are truly chosen. What do you think?' : GOOD) });
    const r = await takeTurn(freshToken(), 'I think I have a special mission', d);
    assert.equal(r.kind, 'host');
    if (r.kind !== 'host') throw new Error();
    assert.equal(r.host, GOOD, 'the first reply was discarded');
    assert.equal(n, 2);
    const always = deps({ generate: async () => 'I am your therapist, and I can treat this. Shall we begin?' });
    const f = await takeTurn(freshToken(), 'hello', always);
    assert.equal(f.kind, 'failure');
    if (f.kind !== 'failure') throw new Error();
    assert.equal(f.host, FAILURE_COPY);
    assert.ok(!f.host.includes('therapist'), 'rejected text is never shown');
    assert.match(f.host, /988/, 'failure copy still offers a number');
    const thrower = deps({ generate: async () => { throw new Error('500'); } });
    assert.equal((await takeTurn(freshToken(), 'hello', thrower)).kind, 'failure');
    // A failure keeps the sitting resumable and does not consume a turn.
    if (f.kind === 'failure') assert.equal(openState(f.token, ENV)!.seekerTurns, 0);
  }

  // ── AI reminder is inserted by the server on schedule ──
  {
    const tok = freshToken('before', { hostTurns: 5, seekerTurns: 5 });
    const r = await takeTurn(tok, 'hello again', deps());
    assert.equal(r.kind, 'host');
    if (r.kind !== 'host') throw new Error();
    assert.ok(r.host.startsWith(REMINDER), 'reminder on the 6th host turn');
    assert.ok(!(await takeTurn(freshToken('before', { hostTurns: 2 }), 'x', deps()) as { host: string }).host.includes(REMINDER));
    // The reminder is not stored in the history the model sees.
    if (r.kind === 'host') assert.ok(!openState(r.token, ENV)!.turns.some((t) => t.t.includes(REMINDER)));
  }

  // ── caps, expiry, validation ──
  {
    const capped = await takeTurn(freshToken('before', { seekerTurns: MAX_SEEKER_TURNS }), 'more', deps());
    assert.deepEqual([capped.kind, (capped as { host: string }).host], ['closed', CAP_COPY]);
    const expired = await takeTurn(freshToken('before', { exp: 500 }), 'hello', deps());
    assert.deepEqual([expired.kind, (expired as { host: string }).host], ['closed', EXPIRED_COPY]);
    const forged = await takeTurn('not-a-token', 'hello', deps());
    assert.equal(forged.kind, 'closed');
    for (const m of [undefined, null, 5, '', '   ', 'x'.repeat(MAX_SEEKER_CHARS + 1)]) {
      const d = deps();
      const r = await takeTurn(freshToken(), m, d);
      assert.equal(r.kind, 'invalid', `message ${String(m).slice(0, 10)}`);
      assert.equal(d.calls.judge + d.calls.generate, 0, 'invalid input spends nothing');
    }
    assert.equal((await takeTurn(freshToken(), 'x'.repeat(MAX_SEEKER_CHARS), deps())).kind, 'host');
  }

  // ── a client cannot lower the level or change the mode: the only input is an opaque token ──
  {
    const higher = freshToken('before', { level: 1 });
    const r = await takeTurn(higher, 'I am fine, really', deps());
    if (r.kind !== 'host') throw new Error();
    assert.equal(openState(r.token, ENV)!.level, 1);
    assert.equal(openState(r.token, ENV)!.mode, 'before');
  }

  // ── host output check ──
  {
    assert.deepEqual(checkHostOutput(GOOD), { ok: true, reasons: [] });
    const bad = (t: string, reason: string) => assert.ok(checkHostOutput(t).reasons.includes(reason), `${reason} for: ${t}`);
    bad('', 'empty');
    bad('That is hard. I am here.', 'NOT_ONE_QUESTION');
    bad('What happened? And then what?', 'NOT_ONE_QUESTION');
    bad('I am your therapist now. How are you?', 'NO_THERAPY_CLAIM');
    bad("Just between us, I won't tell anyone. What is it?", 'NO_SECRECY_PROMISE');
    bad('You are truly chosen. What do you feel?', 'NO_METAPHOR_VALIDATION');
    bad("You don't need anyone else. How are you?", 'NO_DEPENDENCY_ENCOURAGEMENT');
    bad('That voice is unconfirmed. How are you?', 'NO_AUTHORIZATION_LEAK');
    bad("I'm a real person, and I care. How are you?", 'CLAIMS_PERSON');
    bad('word '.repeat(120) + 'ok?', 'TOO_LONG');
    bad('Some things:\n- one\n- two\nHow are you?', 'LIST_OR_HEADING');
    assert.ok(buildHostSystem('before', 0).includes('You are an AI'));
    assert.ok(!buildHostSystem('after', 0).includes('may be struggling'));
    assert.ok(buildHostSystem('after', 1).includes('may be struggling'));
  }

  console.log('fireside engine tests passed');
}

main().catch((e) => { console.error(e); process.exit(1); });
