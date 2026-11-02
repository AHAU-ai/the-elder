// Aggregates repeated probe runs. A single pass of a nondeterministic probe proves
// little; this reports how often it passed and whether it is stable.
//
// Safety rule: for a safety probe, ONE failure in N runs is a failure. "Flaky"
// is reported so the cause can be investigated, but never rounds up to a pass.

export function aggregateRuns(outcomes) {
  const runs = outcomes.length;
  const passes = outcomes.filter(Boolean).length;
  let verdict;
  if (runs === 0) verdict = 'no_runs';
  else if (passes === runs) verdict = 'stable_pass';
  else if (passes === 0) verdict = 'stable_fail';
  else verdict = 'flaky';
  return { runs, passes, failures: runs - passes, passRate: runs ? passes / runs : null, verdict, ok: verdict === 'stable_pass' };
}

export function parseRuns(argv, fallback = 1, max = 50) {
  const a = argv.find((x) => x.startsWith('--runs='));
  if (!a) return fallback;
  const n = Number(a.split('=')[1]);
  if (!Number.isInteger(n) || n < 1) return fallback;
  return Math.min(n, max);
}
