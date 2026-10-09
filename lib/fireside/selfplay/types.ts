/**
 * lib/fireside/selfplay/types.ts
 *
 * Shared types for the fireside adversarial self-play harness (L3 part 1).
 * Everything the harness handles is SYNTHETIC. It never reads a real sitting.
 */

export type FamilyId =
  | 'mythic_mask' | 'grandiosity' | 'injection' | 'lineage_leakage' | 'dependency'
  | 'metaphor_validation' | 'missing_disclosure' | 'third_party_diagnosis'
  | 'therapy_claims' | 'secrecy_promises';

export type Mode = 'before' | 'after';

export interface Turn {
  role: 'seeker' | 'host';
  text: string;
}

export interface Usage {
  input: number;
  output: number;
}

export interface Reply {
  text: string;
  usage?: Usage;
}

/** A synthetic attacker. It sees an abstract brief, never a real transcript. */
export interface Attacker {
  readonly usesModel: boolean;
  nextTurn(input: { family: FamilyId; brief: string; mode: Mode; history: Turn[]; round: number; rng: () => number }): Promise<Reply>;
}

/** The system under test. The fireside host reply path, wired in by the caller. */
export interface Target {
  readonly usesModel: boolean;
  reply(input: { mode: Mode; history: Turn[] }): Promise<Reply>;
}

export interface CriterionResult {
  id: string;
  passed: boolean;
  by: 'lexical' | 'model';
  note?: string;
}

export interface Verdict {
  passed: boolean;
  results: CriterionResult[];
}

export interface Judge {
  readonly usesModel: boolean;
  /** Model-based second opinion. The lexical floor always runs regardless. */
  judge(input: { family: FamilyId; history: Turn[]; reply: string; criteriaIds: string[] }): Promise<{ results: CriterionResult[]; usage?: Usage }>;
}

export interface CaseSpec {
  caseId: string;
  family: FamilyId;
  mode: Mode;
  /** Where the case came from: a generated attack or a stored probe. */
  origin: { kind: 'generated' } | { kind: 'probe'; probeId: string };
  /** Abstract description given to the attacker. Never a transcript. */
  brief: string;
  /** Synthetic opening turns. Empty for abstract-only probes: the attacker writes them. */
  seedTurns: string[];
  criteriaIds: string[];
  ref: string;
}

export interface CaseResult {
  caseId: string;
  family: FamilyId;
  sensitive: boolean;
  origin: CaseSpec['origin'];
  ref: string;
  mode: Mode;
  passed: boolean;
  failedCriteria: string[];
  /** Redacted for sensitive families: hashes and lengths only. */
  record: Redacted | Plain;
  /** Kept in memory only so a failure can become a draft probe. Never serialized for sensitive families. */
  _synthTurns?: string[];
  /** Set when the case could not be judged (attacker or judge failed). Not a pass, not a verdict. */
  error?: string;
}

export interface Redacted { redacted: true; turnDigests: string[]; replyDigest: string; replyLength: number }
export interface Plain { redacted: false; turns: string[]; reply: string }

export interface RunReport {
  runId: string;
  startedAt: string;
  kind: 'selfplay' | 'gate';
  /** Set when the run stopped early (budget cap, nothing to run). */
  aborted?: string;
  totals: { cases: number; passed: number; failed: number; errored: number; byFamily: Record<string, { cases: number; failed: number; errored: number }> };
  failures: CaseResult[];
  results: CaseResult[];
  budget: { calls: number; inputTokens: number; outputTokens: number };
}
