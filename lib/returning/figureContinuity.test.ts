/**
 * figureContinuity.test.ts -- hermetic tests for the Figure Continuity context
 * assembler (lib/returning/figureContinuity.ts): every gate, one at a time,
 * with injected stubs and no database. The assembler is the only place the
 * feature's gates are evaluated, so this is where "inert unless every gate
 * passes" is proved.
 *
 * Run: npx tsx lib/returning/figureContinuity.test.ts
 */
import assert from 'node:assert/strict';
import { assembleFigureContext, assessFigureArrival, type FigureContextInput, type FigureContextDeps } from './figureContinuity';
import { figureContinuityEnabled } from '../../config/returning-features';
import { MAX_MAPPINGS_IN_PROMPT } from '../figureContinuityClause';

const CHAIN = '11111111-2222-3333-4444-555555555555';

function stubs(over: Partial<FigureContextDeps> = {}) {
  const calls = { readChainFigure: 0, listConfirmed: 0, lastLimit: 0 };
  const deps: FigureContextDeps = {
    readChainFigure: async () => {
      calls.readChainFigure++;
      return { ok: true, lineageKey: 'ojer_tzij', mythTitle: 'The Twins', figureLabel: 'The Hero Twin' } as any;
    },
    listConfirmed: async (_u, _c, limit) => {
      calls.listConfirmed++;
      calls.lastLimit = limit;
      return [
        { id: 2, subjectLabel: 'my sister', counterpartLabel: 'the Maize Maiden', counterpartBasis: 'corpus' },
        { id: 1, subjectLabel: 'the move', counterpartLabel: 'the Descent', counterpartBasis: 'model_report' },
      ];
    },
    ...over,
  };
  return { deps, calls };
}

const good: FigureContextInput = {
  userId: 42,
  figureContinue: true,
  effectiveTier: 'kept',
  register: 'adult',
  welfare: { surfaceResources: false, allowPsychopompLayer: true },
  mode: 'reading',
  chainId: CHAIN,
  lineageKey: 'ojer_tzij',
  includeMappings: true,
};

const ENV = ['FIGURE_CONTINUITY_ENABLED', 'MARKER_CONFIRMATION_READY', 'FIGURE_CONTINUITY_RELEASE_VERIFIED'];
const saved: Record<string, string | undefined> = {};
for (const k of ENV) saved[k] = process.env[k];
const lightAll = () => { for (const k of ENV) process.env[k] = 'true'; };
const darken = () => { for (const k of ENV) delete process.env[k]; };

async function main() {
  // ── the flag: three gates, exact string "true" ──
  darken();
  assert.equal(figureContinuityEnabled(), false, 'dark by default');
  for (const lit of ENV) {
    darken();
    for (const k of ENV) if (k !== lit) process.env[k] = 'true';
    assert.equal(figureContinuityEnabled(), false, `missing ${lit}: dark`);
  }
  lightAll();
  assert.equal(figureContinuityEnabled(), true, 'all three: lit');
  for (const bad of ['1', 'TRUE', 'yes', '', 'true ']) {
    process.env.FIGURE_CONTINUITY_ENABLED = bad;
    assert.equal(figureContinuityEnabled(), false, `${JSON.stringify(bad)} does not light the flag`);
  }

  // ── flag dark: inert, and no I/O at all ──
  darken();
  {
    const { deps, calls } = stubs();
    assert.equal(await assembleFigureContext(good, deps), null, 'flag off: null');
    assert.equal(calls.readChainFigure + calls.listConfirmed, 0, 'flag off: touched nothing');
  }

  // ── all gates pass ──
  lightAll();
  {
    const { deps, calls } = stubs();
    const ctx = await assembleFigureContext(good, deps);
    assert.ok(ctx, 'every gate passes: assembled');
    assert.equal(ctx!.chainId, CHAIN);
    assert.equal(ctx!.lineageKey, 'ojer_tzij');
    assert.equal(ctx!.figureLabel, 'The Hero Twin');
    assert.equal(ctx!.mappingsIncluded, 2);
    assert.equal(ctx!.usesModelReport, true, 'a model_report pairing is flagged for provenance disclosure');
    assert.ok(ctx!.block.includes('FIGURE CONTINUITY.') && ctx!.block.includes('"my sister" echoes "the Maize Maiden"'));
    assert.equal(calls.lastLimit, MAX_MAPPINGS_IN_PROMPT, 'the ledger is asked for at most the prompt cap');
  }
  for (const tier of ['kept', 'council']) {
    assert.ok(await assembleFigureContext({ ...good, effectiveTier: tier }, stubs().deps), `${tier} tier is on`);
  }

  // ── each gate, failed alone, is inert and never reaches the model or ledger more than needed ──
  const failing: Array<[string, Partial<FigureContextInput>]> = [
    ['signed out (null)', { userId: null }],
    ['user id 0', { userId: 0 }],
    ['user id -1', { userId: -1 }],
    ['user id NaN', { userId: Number.NaN }],
    ['user id fractional', { userId: 1.5 }],
    ['seeker did not choose to continue', { figureContinue: false }],
    ['figureContinue is not literally true', { figureContinue: 'true' as unknown as boolean }],
    ['free Seeker tier (D3)', { effectiveTier: 'seeker' }],
    ['unknown tier', { effectiveTier: 'admin' }],
    ['empty tier', { effectiveTier: '' }],
    ['child register (G8)', { register: 'child' }],
    ['young_adult register (G8)', { register: 'young_adult' }],
    ['unresolved register', { register: null }],
    ['unknown register', { register: 'elder' }],
    ['crisis: resources surfaced (G2)', { welfare: { surfaceResources: true, allowPsychopompLayer: false } }],
    ['distress: layer suppressed (D8)', { welfare: { surfaceResources: false, allowPsychopompLayer: false } }],
    ['resources surfaced even if layer allowed', { welfare: { surfaceResources: true, allowPsychopompLayer: true } }],
    ['council mode', { mode: 'council' }],
    ['no mode', { mode: '' }],
    ['no chain to continue', { chainId: null }],
    ['empty chain id', { chainId: '' }],
  ];
  for (const [name, over] of failing) {
    const { deps, calls } = stubs();
    assert.equal(await assembleFigureContext({ ...good, ...over }, deps), null, `inert: ${name}`);
    assert.equal(calls.listConfirmed, 0, `no mappings read: ${name}`);
  }

  // ── gates that depend on the chain ──
  for (const reason of ['invalid', 'no_chain', 'no_figure', 'db_error']) {
    const { deps } = stubs({ readChainFigure: async () => ({ ok: false, reason } as any) });
    assert.equal(await assembleFigureContext(good, deps), null, `chain read says ${reason}: inert`);
  }
  {
    const { deps, calls } = stubs();
    assert.equal(await assembleFigureContext({ ...good, lineageKey: 'volva' }, deps), null, 'lineage lock (G3): chain is ojer_tzij, request is volva');
    assert.equal(calls.listConfirmed, 0, 'lineage mismatch reads no mappings');
  }
  {
    const { deps } = stubs({ readChainFigure: async () => { throw new Error('boom'); } });
    assert.equal(await assembleFigureContext(good, deps), null, 'a throwing dependency is inert, never an error in the reading path');
  }
  {
    const { deps } = stubs({ listConfirmed: async () => null });
    assert.equal(await assembleFigureContext(good, deps), null, 'could not read the seeker\'s pairings: inert (never speak without them)');
  }
  {
    const { deps } = stubs({ listConfirmed: async () => { throw new Error('boom'); } });
    assert.equal(await assembleFigureContext(good, deps), null, 'a throwing mappings read is inert');
  }

  // ── D6: first readings get the clause without the block ──
  {
    const { deps, calls } = stubs();
    const ctx = await assembleFigureContext({ ...good, includeMappings: false }, deps);
    assert.ok(ctx, 'first reading: assembled');
    assert.equal(calls.listConfirmed, 0, 'D6: no mappings are read on a first reading');
    assert.equal(ctx!.mappingsIncluded, 0);
    assert.equal(ctx!.usesModelReport, false);
    assert.ok(!ctx!.block.includes('Pairings the seeker has already confirmed'), 'D6: no pairings block');
    assert.ok(ctx!.block.includes('FIGURE CONTINUITY.'), 'D6: the clause itself is present');
  }
  {
    const { deps } = stubs({ listConfirmed: async () => [] });
    const ctx = await assembleFigureContext(good, deps);
    assert.ok(ctx && ctx.mappingsIncluded === 0 && ctx.usesModelReport === false, 'no confirmed pairings yet: clause only');
  }
  {
    const all = Array.from({ length: 20 }, (_, i) => ({ id: i, subjectLabel: `s${i} x`, counterpartLabel: `c${i} y`, counterpartBasis: 'corpus' as const }));
    const { deps } = stubs({ listConfirmed: async () => all });
    const ctx = await assembleFigureContext(good, deps);
    assert.equal(ctx!.mappingsIncluded, MAX_MAPPINGS_IN_PROMPT, 'a ledger returning too many is still capped');
    assert.equal(ctx!.usesModelReport, false, 'corpus-only pairings need no disclosure');
  }

  // ── G10: only the active chain's id is ever passed to the ledger ──
  {
    const seen: string[] = [];
    const { deps } = stubs({ listConfirmed: async (_u, c) => { seen.push(c); return []; } });
    await assembleFigureContext(good, deps);
    assert.deepEqual(seen, [CHAIN], 'mappings are requested for exactly the active chain');
  }

  // ── the arrival capability (FC-E): the server, not the client, decides whether to offer "continue as" ──
  {
    const arrivalIn = { userId: 42, effectiveTier: 'kept', register: 'adult', head: { chainId: CHAIN, lineageKey: 'ojer_tzij' } };
    const dep = (over: Partial<Pick<FigureContextDeps, 'readChainFigure'>> = {}) => ({ readChainFigure: stubs().deps.readChainFigure, ...over });

    lightAll();
    const ok = await assessFigureArrival(arrivalIn, dep());
    assert.deepEqual(ok, { figureLabel: 'The Hero Twin', lineageKey: 'ojer_tzij' }, 'all gates pass: the figure and lineage, nothing else');
    assert.ok(!('chainId' in (ok as object)), 'the chain id is never sent to the client');
    assert.ok(await assessFigureArrival({ ...arrivalIn, effectiveTier: 'council' }, dep()), 'council tier is on');

    const noArrival: Array<[string, Partial<typeof arrivalIn>]> = [
      ['signed out', { userId: null as unknown as number }],
      ['user id 0', { userId: 0 }],
      ['user id NaN', { userId: Number.NaN }],
      ['free Seeker tier', { effectiveTier: 'seeker' }],
      ['unknown tier', { effectiveTier: 'admin' }],
      ['child register', { register: 'child' }],
      ['young_adult register', { register: 'young_adult' }],
      ['unresolved register', { register: null as unknown as string }],
      ['no head chain', { head: null as unknown as typeof arrivalIn.head }],
      ['empty chain id', { head: { chainId: '', lineageKey: 'ojer_tzij' } }],
    ];
    for (const [name, over] of noArrival) {
      assert.equal(await assessFigureArrival({ ...arrivalIn, ...over }, dep()), null, `no arrival offer: ${name}`);
    }
    for (const reason of ['invalid', 'no_chain', 'no_figure', 'db_error']) {
      assert.equal(await assessFigureArrival(arrivalIn, dep({ readChainFigure: async () => ({ ok: false, reason } as any) })), null, `chain read says ${reason}: no offer`);
    }
    assert.equal(await assessFigureArrival({ ...arrivalIn, head: { chainId: CHAIN, lineageKey: 'volva' } }, dep()), null, 'the head chain must be in the lineage the figure is at home in');
    assert.equal(await assessFigureArrival(arrivalIn, dep({ readChainFigure: async () => { throw new Error('boom'); } })), null, 'a throwing read is no offer');
    let reads = 0;
    darken();
    assert.equal(await assessFigureArrival(arrivalIn, dep({ readChainFigure: async (u, c) => { reads++; return stubs().deps.readChainFigure(u, c); } })), null, 'flag dark: no offer');
    assert.equal(reads, 0, 'flag dark: nothing read');
    lightAll();
    for (const k of ENV) {
      darken();
      for (const other of ENV) if (other !== k) process.env[other] = 'true';
      assert.equal(await assessFigureArrival(arrivalIn, dep()), null, `missing ${k}: no offer`);
    }
    lightAll();
  }

  for (const k of ENV) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; }
  console.log('figureContinuity assembler tests passed');
}

main().catch(err => { console.error(err); process.exit(1); });
