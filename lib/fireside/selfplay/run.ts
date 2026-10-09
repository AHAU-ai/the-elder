/**
 * lib/fireside/selfplay/run.ts
 *
 * The runner. Takes cases, plays them against a Target, judges every host reply
 * (lexical floor always, model judge when supplied), and reports.
 *
 * Safety properties, each covered in selfplay.test.ts:
 *  - Sensitive families are redacted in the report; their turns exist only in memory.
 *  - Model calls are refused before they are made once a budget cap is reached.
 *  - A case that could not be judged is `error`, never a pass; the gate treats it as a failure.
 *  - This module imports no database or network client; it only calls the adapters it is given.
 */
import { hashToInt, mulberry32, attackerExemplars } from './seeds';
import type { StoredProbe } from './seeds';
import { BudgetExceeded } from './budget';
import type { BudgetGuard } from './budget';
import { familyDef, lexicalJudge, mergeVerdict } from './rubric';
import { makeRecord } from './redact';
import type { Attacker, CaseResult, CaseSpec, Judge, Reply, RunReport, Target, Turn } from './types';

export interface RunOptions {
  cases: CaseSpec[];
  attacker: Attacker;
  target: Target;
  judge?: Judge;
  budget: BudgetGuard;
  rounds?: number;
  seed?: number;
  kind?: RunReport['kind'];
  now?: () => Date;
}

const EST_OUT = 200;

async function charged<T extends Reply | { usage?: { input: number; output: number } }>(usesModel: boolean, budget: BudgetGuard, call: () => Promise<T>): Promise<T> {
  if (!usesModel) return call();
  budget.assertCanSpend(EST_OUT);
  const r = await call();
  budget.record(r.usage);
  return r;
}

export async function playCase(spec: CaseSpec, o: Pick<RunOptions, 'attacker' | 'target' | 'judge' | 'budget' | 'seed' | 'rounds'>): Promise<CaseResult> {
  const def = familyDef(spec.family);
  const rounds = Math.max(1, o.rounds ?? 1);
  const rng = mulberry32(hashToInt(`${o.seed ?? 1}:${spec.caseId}`));
  const history: Turn[] = [];
  const synth: string[] = [];
  const failed = new Set<string>();
  let lastReply = '';
  let error: string | undefined;

  try {
    for (let round = 1; round <= rounds; round++) {
      let seekerText: string;
      if (round === 1 && spec.seedTurns.length) {
        for (const t of spec.seedTurns.slice(0, -1)) { history.push({ role: 'seeker', text: t }); synth.push(t); }
        seekerText = spec.seedTurns[spec.seedTurns.length - 1];
      } else {
        const r = await charged(o.attacker.usesModel, o.budget, () => o.attacker.nextTurn({ family: spec.family, brief: spec.brief, mode: spec.mode, history, round, rng }));
        seekerText = r.text;
        if (!seekerText) { error = 'attacker produced no turn'; break; }
      }
      history.push({ role: 'seeker', text: seekerText });
      synth.push(seekerText);

      const rep = await charged(o.target.usesModel, o.budget, () => o.target.reply({ mode: spec.mode, history }));
      lastReply = rep.text;
      history.push({ role: 'host', text: rep.text });

      const floor = lexicalJudge(spec.criteriaIds, rep.text);
      let modelResults = null;
      if (o.judge) {
        const m = await charged(o.judge.usesModel, o.budget, () => o.judge!.judge({ family: spec.family, history, reply: rep.text, criteriaIds: spec.criteriaIds }));
        modelResults = m.results;
      }
      const verdict = mergeVerdict(floor, modelResults);
      for (const r of verdict.results) if (!r.passed) failed.add(r.id);
    }
  } catch (e) {
    if (e instanceof BudgetExceeded) throw e;
    error = e instanceof Error ? e.message : String(e);
  }

  const passed = !error && failed.size === 0;
  return {
    caseId: spec.caseId,
    family: spec.family,
    sensitive: def.sensitive,
    origin: spec.origin,
    ref: spec.ref,
    mode: spec.mode,
    passed,
    failedCriteria: [...failed],
    record: makeRecord(def.sensitive, synth, lastReply),
    _synthTurns: synth,
    ...(error ? { error } : {}),
  };
}

export function summarize(results: CaseResult[]): RunReport['totals'] {
  const byFamily: RunReport['totals']['byFamily'] = {};
  let passed = 0, failed = 0, errored = 0;
  for (const r of results) {
    const f = (byFamily[r.family] ??= { cases: 0, failed: 0, errored: 0 });
    f.cases += 1;
    if (r.error) { errored += 1; f.errored += 1; }
    else if (!r.passed) { failed += 1; f.failed += 1; }
    else passed += 1;
  }
  return { cases: results.length, passed, failed, errored, byFamily };
}

export async function runCases(o: RunOptions): Promise<RunReport> {
  const now = (o.now ?? (() => new Date()))();
  const results: CaseResult[] = [];
  let aborted: string | undefined;
  for (const spec of o.cases) {
    try {
      results.push(await playCase(spec, o));
    } catch (e) {
      if (e instanceof BudgetExceeded) { aborted = `budget: ${e.message}`; break; }
      throw e;
    }
  }
  if (!o.cases.length) aborted = 'no cases to run';
  return {
    runId: `${o.kind ?? 'selfplay'}-${now.toISOString().replace(/[-:.]/g, '').slice(0, 15)}`,
    startedAt: now.toISOString(),
    kind: o.kind ?? 'selfplay',
    ...(aborted ? { aborted } : {}),
    totals: summarize(results),
    failures: results.filter((r) => !r.passed && !r.error),
    results,
    budget: o.budget.snapshot(),
  };
}

export interface GateOptions extends Omit<RunOptions, 'cases' | 'kind'> {
  probes: StoredProbe[];
  allowEmpty?: boolean;
}

/**
 * Release gate: every approved HELD-OUT probe must pass. Fails closed: no held-out
 * probes, any failure, any error, or an early abort all mean the gate is not passed.
 * Held-out probes are never given to the attacker as exemplars (see attackerExemplars).
 */
export async function runHeldOutGate(g: GateOptions): Promise<{ ok: boolean; reason: string; report: RunReport }> {
  const { casesFromProbes } = await import('./seeds');
  const cases = casesFromProbes(g.probes, { status: 'approved', split: 'heldout' });
  const report = await runCases({ ...g, cases, kind: 'gate' });
  if (!cases.length) {
    return { ok: !!g.allowEmpty, reason: g.allowEmpty ? 'no held-out probes (allowed by flag)' : 'no approved held-out probes; the gate cannot pass vacuously', report };
  }
  if (report.aborted) return { ok: false, reason: `gate aborted: ${report.aborted}`, report };
  if (report.totals.errored) return { ok: false, reason: `${report.totals.errored} case(s) could not be judged`, report };
  if (report.totals.failed) return { ok: false, reason: `${report.totals.failed} held-out probe(s) failed`, report };
  return { ok: true, reason: `${report.totals.passed} held-out probe(s) passed`, report };
}

export { attackerExemplars };
