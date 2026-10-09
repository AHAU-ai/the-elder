// scripts/fireside-selfplay.ts
//
// Adversarial self-play for the fireside guardrails (L3 part 1).
//
//   npx tsx scripts/fireside-selfplay.ts --mock                    # offline plumbing check, free
//   npx tsx scripts/fireside-selfplay.ts --mock --flaw no_disclosure   # prove the floor catches a flaw
//   npx tsx scripts/fireside-selfplay.ts --target ./path/to/target.ts  # live: attacker + judge on the separate key
//   npx tsx scripts/fireside-selfplay.ts --target ./t.ts --gate        # release gate: approved held-out probes only
//
// Options: --families a,b  --per-family N  --rounds N  --seed N  --probes (also replay approved dev probes)
//          --out-dir DIR (default .cache/fireside-selfplay)  --promote (write drafts into governance/fireside/probes)
//          --allow-empty-gate
//
// A --target module must export `createTarget(): Target | Promise<Target>` (see lib/fireside/selfplay/types.ts).
// The fireside host is not built yet, so there is no default live target.
//
// Safety: SYNTHETIC cases only. The attacker and model judge use FIRESIDE_SELFPLAY_API_KEY, which must
// differ from ANTHROPIC_API_KEY. DATABASE_URL is removed from this process on start. Sensitive families are
// written as digests, never text. Budget caps are enforced before each model call.
//
// Exit codes: 0 clean, 1 a guardrail failed (a verdict), 3 infrastructure or judging problem (NOT a verdict), 2 usage.

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { BudgetGuard, DEFAULT_LIMITS, memoryStore } from '../lib/fireside/selfplay/budget';
import type { LedgerStore } from '../lib/fireside/selfplay/budget';
import { createAnthropicAttacker, createAnthropicJudge, createMockTarget, mockAttacker, selfPlayClient, SelfPlayKeyError } from '../lib/fireside/selfplay/adapters';
import type { MockFlaw } from '../lib/fireside/selfplay/adapters';
import { draftsFromFailures } from '../lib/fireside/selfplay/promote';
import { forSerialization } from '../lib/fireside/selfplay/redact';
import { attackerExemplars, casesFromProbes, generateCases } from '../lib/fireside/selfplay/seeds';
import type { StoredProbe } from '../lib/fireside/selfplay/seeds';
import { runCases, runHeldOutGate } from '../lib/fireside/selfplay/run';
import type { FamilyId, RunReport, Target } from '../lib/fireside/selfplay/types';
// @ts-ignore plain .mjs shared with the CI validators
import { PROBE_DIR, FS_DIR, loadJson, loadProbes, buildContext, validateProbe, nextProbeId } from './fireside/probe-lib.mjs';

delete process.env.DATABASE_URL; // the harness never touches a database

const args = process.argv.slice(2);
const flag = (n: string) => args.includes(n);
const val = (n: string) => { const i = args.indexOf(n); return i > -1 ? args[i + 1] : undefined; };
const num = (n: string, d: number) => { const v = val(n); return v === undefined ? d : Number(v); };

const MOCK = flag('--mock');
const GATE = flag('--gate');
const outDir = resolve(val('--out-dir') ?? '.cache/fireside-selfplay');

function fileStore(path: string): LedgerStore {
  return {
    read() { try { return JSON.parse(readFileSync(path, 'utf8')); } catch { return null; } },
    write(l) { mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, JSON.stringify(l)); },
  };
}

async function main(): Promise<number> {
  const limits = {
    maxCallsPerRun: num('--max-calls-run', Number(process.env.FIRESIDE_SELFPLAY_MAX_CALLS_RUN ?? DEFAULT_LIMITS.maxCallsPerRun)),
    maxCallsPerWeek: Number(process.env.FIRESIDE_SELFPLAY_MAX_CALLS_WEEK ?? DEFAULT_LIMITS.maxCallsPerWeek),
    maxOutputTokensPerWeek: Number(process.env.FIRESIDE_SELFPLAY_MAX_OUT_TOKENS_WEEK ?? DEFAULT_LIMITS.maxOutputTokensPerWeek),
  };
  const budget = new BudgetGuard(limits, MOCK ? memoryStore() : fileStore(join(outDir, '..', 'fireside-selfplay-ledger.json')));

  const stored: StoredProbe[] = loadProbes().map((x: { probe: StoredProbe }) => x.probe);
  const rounds = num('--rounds', 1);
  const seed = num('--seed', 1);

  let attacker = mockAttacker as import('../lib/fireside/selfplay/types').Attacker;
  let judge: import('../lib/fireside/selfplay/types').Judge | undefined;
  let target: Target;

  if (MOCK) {
    target = createMockTarget(val('--flaw') as MockFlaw | undefined);
  } else {
    const targetPath = val('--target');
    if (!targetPath) { console.error('live runs need --target <module exporting createTarget()>. The fireside host is not built yet; use --mock to check the plumbing.'); return 2; }
    let client;
    try { client = selfPlayClient(); } catch (e) {
      if (e instanceof SelfPlayKeyError) { console.error(`✗ infrastructure, not a verdict: ${e.message}`); return 3; }
      throw e;
    }
    attacker = createAnthropicAttacker(client, attackerExemplars(stored));
    judge = createAnthropicJudge(client);
    const mod = await import(pathToFileURL(resolve(targetPath)).href);
    if (typeof mod.createTarget !== 'function') { console.error('--target module must export createTarget()'); return 2; }
    target = await mod.createTarget();
  }

  let report: RunReport;
  let gateReason = '';
  let ok = true;
  if (GATE) {
    const g = await runHeldOutGate({ probes: stored, attacker, target, judge, budget, rounds, seed, allowEmpty: flag('--allow-empty-gate') });
    report = g.report; ok = g.ok; gateReason = g.reason;
  } else {
    const families = val('--families')?.split(',') as FamilyId[] | undefined;
    let cases = generateCases({ families, perFamily: num('--per-family', 2), seed });
    if (flag('--probes')) cases = cases.concat(casesFromProbes(stored, { status: 'approved', split: 'dev' }));
    report = await runCases({ cases, attacker, target, judge, budget, rounds, seed });
  }

  mkdirSync(outDir, { recursive: true });
  const serial = { ...report, results: report.results.map((r) => forSerialization(r)), failures: report.failures.map((r) => forSerialization(r)) };
  writeFileSync(join(outDir, `${report.runId}.json`), JSON.stringify(serial, null, 2));

  const t = report.totals;
  console.log(`${report.kind} ${report.runId}: ${t.cases} cases, ${t.passed} passed, ${t.failed} failed, ${t.errored} errored${report.aborted ? `, ABORTED (${report.aborted})` : ''}`);
  for (const [fam, s] of Object.entries(t.byFamily)) if (s.failed || s.errored) console.log(`  ${fam}: ${s.failed} failed, ${s.errored} errored of ${s.cases}`);
  for (const f of report.failures) console.log(`  FAIL ${f.caseId} [${f.family}] ${f.failedCriteria.join(', ')}${f.sensitive ? ' (redacted)' : ''}`);
  console.log(`budget: ${report.budget.calls} model calls, ${report.budget.outputTokens} output tokens`);

  // Failures become drafts. A human approves; nothing here does.
  if (report.failures.length && !GATE) {
    const ctx = buildContext({ rules: loadJson(join(FS_DIR, 'rules.json')), rubric: loadJson(join(FS_DIR, 'rubric.json')), incidents: loadJson(join(FS_DIR, 'incidents.json')) });
    const known = new Set<string>(stored.map((p) => /fp ([0-9a-f]{16})/.exec((p as unknown as { notes?: string }).notes ?? '')?.[1]).filter(Boolean) as string[]);
    const ids: string[] = stored.map((p) => p.id);
    const today = report.startedAt.slice(0, 10);
    const drafts = draftsFromFailures(report.failures, { nextId: () => { const id = nextProbeId(ids); ids.push(id); return id; }, today, runId: report.runId, knownFingerprints: known });
    const dest = flag('--promote') ? PROBE_DIR : join(outDir, 'drafts');
    mkdirSync(dest, { recursive: true });
    for (const d of drafts) {
      const errs = validateProbe(d, ctx);
      if (errs.length) { console.error(`  draft ${d.id} rejected by the validator:\n    ${errs.join('\n    ')}`); continue; }
      writeFileSync(join(dest, `${d.id}.json`), JSON.stringify(d, null, 2) + '\n');
      console.log(`  draft probe ${d.id} -> ${dest}`);
    }
  }

  if (GATE) console.log(`gate: ${ok ? 'PASS' : 'FAIL'} - ${gateReason}`);
  if (report.aborted || t.errored) return GATE ? (ok ? 0 : 1) : 3;
  if (GATE) return ok ? 0 : 1;
  return t.failed ? 1 : 0;
}

main().then((c) => process.exit(c), (e) => { console.error(e); process.exit(3); });
