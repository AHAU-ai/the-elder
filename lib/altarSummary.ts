/**
 * altarSummary.ts
 *
 * The operator's view of the post-Reading signal. Pure: rows in, summary out —
 * no database, no I/O — so the arithmetic is testable and the same summary
 * backs both the admin route and the CLI.
 *
 * WHY THE STATISTICS ARE CAUTIOUS
 * A named-cohort beta produces tens of signals, not thousands. "3 of 4 landed"
 * is 75% and means almost nothing. Every rate here therefore carries a Wilson
 * 95% interval and a `reliable` flag, and the version-drift check only speaks
 * when two intervals genuinely fail to overlap. The aim is to stop the founder
 * steering the instrument by noise — in either direction.
 *
 * WHAT IS NOT HERE
 * No user id, no seeker text, no IP. The summary is built from the anonymous
 * columns of altar_record only; the query that feeds it never selects user_id.
 *
 * "sitting" ("I need to sit with this") is reported but is NOT in the land
 * rate's denominator: a Reading someone is still receiving has neither landed
 * nor missed.
 */

export interface SignalRow {
  lineage: string;
  signal: string;
  nahual?: string | null;
  corpus_version?: string | null;
  model_version?: string | null;
  contract_version?: string | null;
  created_at: string | Date;
}

export interface Tally {
  landed: number;
  sitting: number;
  didNotLand: number;
  /** landed + sitting + didNotLand. Unknown signal values are not counted. */
  total: number;
  /** landed + didNotLand — the denominator of the land rate. */
  decisive: number;
  /** landed / decisive, or null when nothing decisive has been said. */
  landRate: number | null;
  /** Wilson 95% interval for landRate, or null. */
  ci: [number, number] | null;
  /** True only when `decisive` reaches RELIABLE_MIN_DECISIVE. */
  reliable: boolean;
}

/** Below this many decisive signals a rate is shown but must not be acted on. */
export const RELIABLE_MIN_DECISIVE = 10;

/** Wilson score interval. Well-behaved at small n and at 0% / 100%. */
export function wilson(k: number, n: number, z = 1.96): [number, number] | null {
  if (n <= 0 || k < 0 || k > n) return null;
  const p = k / n;
  const z2 = z * z;
  const denom = 1 + z2 / n;
  const center = (p + z2 / (2 * n)) / denom;
  const half = (z * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n))) / denom;
  return [Math.max(0, center - half), Math.min(1, center + half)];
}

export function tally(rows: ReadonlyArray<Pick<SignalRow, 'signal'>>): Tally {
  let landed = 0;
  let sitting = 0;
  let didNotLand = 0;
  for (const r of rows) {
    if (r.signal === 'landed') landed++;
    else if (r.signal === 'sitting') sitting++;
    else if (r.signal === 'did_not_land') didNotLand++;
  }
  const decisive = landed + didNotLand;
  return {
    landed,
    sitting,
    didNotLand,
    total: landed + sitting + didNotLand,
    decisive,
    landRate: decisive > 0 ? landed / decisive : null,
    ci: wilson(landed, decisive),
    reliable: decisive >= RELIABLE_MIN_DECISIVE,
  };
}

export interface VersionGroup {
  /** Human-readable triple; "unattributed" where provenance was never recorded. */
  key: string;
  firstSeen: string;
  tally: Tally;
}

export type ShiftVerdict = 'worse' | 'better' | 'no_clear_change' | 'insufficient_data';

export interface VersionShift {
  from: string;
  to: string;
  verdict: ShiftVerdict;
}

export interface WeekGroup {
  /** ISO date (UTC) of the Monday that starts the week. */
  weekStart: string;
  tally: Tally;
}

export interface AltarSummary {
  overall: Tally;
  byLineage: Record<string, Tally>;
  byVersion: VersionGroup[];
  shifts: VersionShift[];
  byWeek: WeekGroup[];
}

const iso = (d: string | Date) => (d instanceof Date ? d : new Date(d));

/** Monday 00:00 UTC of the week containing `d`, as YYYY-MM-DD. */
export function weekStart(d: string | Date): string {
  const t = iso(d);
  const day = (t.getUTCDay() + 6) % 7; // Monday = 0
  const monday = Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate() - day);
  return new Date(monday).toISOString().slice(0, 10);
}

export function versionKey(r: Pick<SignalRow, 'contract_version' | 'model_version' | 'corpus_version'>): string {
  if (!r.contract_version && !r.model_version && !r.corpus_version) return 'unattributed';
  return `contract=${r.contract_version ?? '?'} model=${r.model_version ?? '?'} corpus=${r.corpus_version ?? '?'}`;
}

/**
 * Compare consecutive versions (oldest first). Only a clear separation of the
 * two intervals counts as a change — overlap is "no clear change", and too
 * little data on either side is "insufficient_data", never a guess.
 */
export function versionShifts(groups: ReadonlyArray<VersionGroup>): VersionShift[] {
  const attributed = groups.filter((g) => g.key !== 'unattributed');
  const out: VersionShift[] = [];
  for (let i = 1; i < attributed.length; i++) {
    const a = attributed[i - 1];
    const b = attributed[i];
    let verdict: ShiftVerdict;
    if (!a.tally.reliable || !b.tally.reliable || !a.tally.ci || !b.tally.ci) {
      verdict = 'insufficient_data';
    } else if (b.tally.ci[1] < a.tally.ci[0]) {
      verdict = 'worse';
    } else if (b.tally.ci[0] > a.tally.ci[1]) {
      verdict = 'better';
    } else {
      verdict = 'no_clear_change';
    }
    out.push({ from: a.key, to: b.key, verdict });
  }
  return out;
}

export function summarize(rows: ReadonlyArray<SignalRow>): AltarSummary {
  const lineageRows = new Map<string, SignalRow[]>();
  const versionRows = new Map<string, SignalRow[]>();
  const weekRows = new Map<string, SignalRow[]>();

  for (const r of rows) {
    (lineageRows.get(r.lineage) ?? lineageRows.set(r.lineage, []).get(r.lineage)!).push(r);
    const vk = versionKey(r);
    (versionRows.get(vk) ?? versionRows.set(vk, []).get(vk)!).push(r);
    const wk = weekStart(r.created_at);
    (weekRows.get(wk) ?? weekRows.set(wk, []).get(wk)!).push(r);
  }

  const byLineage: Record<string, Tally> = {};
  for (const [k, v] of [...lineageRows].sort(([a], [b]) => a.localeCompare(b))) byLineage[k] = tally(v);

  const byVersion: VersionGroup[] = [...versionRows]
    .map(([key, v]) => ({
      key,
      firstSeen: new Date(Math.min(...v.map((r) => iso(r.created_at).getTime()))).toISOString(),
      tally: tally(v),
    }))
    .sort((a, b) => a.firstSeen.localeCompare(b.firstSeen));

  const byWeek: WeekGroup[] = [...weekRows]
    .map(([ws, v]) => ({ weekStart: ws, tally: tally(v) }))
    .sort((a, b) => a.weekStart.localeCompare(b.weekStart));

  return { overall: tally(rows), byLineage, byVersion, shifts: versionShifts(byVersion), byWeek };
}

const pct = (x: number) => `${Math.round(x * 100)}%`;
function rate(t: Tally): string {
  if (t.landRate === null || !t.ci) return 'no decisive answers yet';
  const flag = t.reliable ? '' : '  (too few to act on)';
  return `${pct(t.landRate)} landed  [${pct(t.ci[0])}–${pct(t.ci[1])}]  of ${t.decisive}${flag}`;
}
const counts = (t: Tally) => `landed ${t.landed} · sitting ${t.sitting} · passed ${t.didNotLand}`;

/** Plain-text rendering for the CLI and `?format=text`. */
export function formatSummary(s: AltarSummary): string {
  const lines: string[] = [];
  lines.push('ALTAR — what seekers said back');
  lines.push('');
  lines.push(`Overall   ${counts(s.overall)}`);
  lines.push(`          ${rate(s.overall)}`);
  lines.push('          ("sitting" is not counted as a miss)');
  lines.push('');
  lines.push('By lineage');
  for (const [k, t] of Object.entries(s.byLineage)) {
    lines.push(`  ${k.padEnd(10)} ${counts(t)}`);
    lines.push(`  ${''.padEnd(10)} ${rate(t)}`);
  }
  lines.push('');
  lines.push('By version (oldest first)');
  for (const g of s.byVersion) {
    lines.push(`  ${g.key}`);
    lines.push(`    first seen ${g.firstSeen.slice(0, 10)} · ${counts(g.tally)}`);
    lines.push(`    ${rate(g.tally)}`);
  }
  if (s.shifts.length) {
    lines.push('');
    lines.push('Version shifts');
    for (const sh of s.shifts) lines.push(`  ${sh.verdict.toUpperCase().padEnd(17)} ${sh.from}  ->  ${sh.to}`);
  }
  lines.push('');
  lines.push('By week');
  for (const w of s.byWeek) lines.push(`  ${w.weekStart}  ${counts(w.tally)}`);
  return lines.join('\n');
}
