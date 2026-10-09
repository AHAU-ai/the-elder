/**
 * lib/fireside/selfplay/budget.ts
 *
 * Hard spend limits for the harness: per run and per ISO week. A model call is
 * refused BEFORE it is made if it would cross a cap. The ledger is a small JSON
 * file (default .cache/fireside-selfplay-ledger.json, gitignored), injectable for tests.
 */
export interface BudgetLimits {
  maxCallsPerRun: number;
  maxCallsPerWeek: number;
  maxOutputTokensPerWeek: number;
}
export const DEFAULT_LIMITS: BudgetLimits = { maxCallsPerRun: 400, maxCallsPerWeek: 2000, maxOutputTokensPerWeek: 400_000 };

export interface Ledger { week: string; calls: number; outputTokens: number }
export interface LedgerStore { read(): Ledger | null; write(l: Ledger): void }

export class BudgetExceeded extends Error {
  constructor(public readonly scope: 'run' | 'week', message: string) { super(message); this.name = 'BudgetExceeded'; }
}

/** ISO-8601 week key, e.g. 2026-W41, in UTC. */
export function isoWeek(d: Date): string {
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((t.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${t.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

export class BudgetGuard {
  runCalls = 0;
  inputTokens = 0;
  outputTokens = 0;
  private ledger: Ledger;

  constructor(private limits: BudgetLimits, private store: LedgerStore, private now: () => Date = () => new Date()) {
    const week = isoWeek(this.now());
    const stored = store.read();
    this.ledger = stored && stored.week === week ? stored : { week, calls: 0, outputTokens: 0 };
  }

  /** Call before every model request. Throws BudgetExceeded instead of spending. */
  assertCanSpend(estimatedOutputTokens: number): void {
    if (this.runCalls + 1 > this.limits.maxCallsPerRun) throw new BudgetExceeded('run', `run call cap ${this.limits.maxCallsPerRun} reached`);
    if (this.ledger.calls + 1 > this.limits.maxCallsPerWeek) throw new BudgetExceeded('week', `weekly call cap ${this.limits.maxCallsPerWeek} reached for ${this.ledger.week}`);
    if (this.ledger.outputTokens + estimatedOutputTokens > this.limits.maxOutputTokensPerWeek) throw new BudgetExceeded('week', `weekly output-token cap ${this.limits.maxOutputTokensPerWeek} would be crossed for ${this.ledger.week}`);
  }

  record(usage?: { input: number; output: number }): void {
    this.runCalls += 1;
    this.ledger.calls += 1;
    if (usage) {
      this.inputTokens += usage.input;
      this.outputTokens += usage.output;
      this.ledger.outputTokens += usage.output;
    }
    this.store.write(this.ledger);
  }

  snapshot() { return { calls: this.runCalls, inputTokens: this.inputTokens, outputTokens: this.outputTokens }; }
  weekly(): Ledger { return { ...this.ledger }; }
}

export function memoryStore(initial: Ledger | null = null): LedgerStore & { value: Ledger | null } {
  const s = { value: initial, read() { return s.value; }, write(l: Ledger) { s.value = { ...l }; } };
  return s;
}
