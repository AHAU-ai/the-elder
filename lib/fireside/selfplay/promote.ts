/**
 * lib/fireside/selfplay/promote.ts
 *
 * Turns a self-play failure into a DRAFT regression probe. A human still has to
 * read it, adjust it, and approve it. Nothing here approves anything.
 *
 * Draft contents are abstract by construction:
 *  - the pattern is the family description plus the criteria that failed, never attacker text;
 *  - non-sensitive families keep their (synthetic, short) seed turns so the probe can replay;
 *  - sensitive families keep NO turns at all.
 */
import { createHash } from 'node:crypto';
import { familyDef } from './rubric';
import type { CaseResult } from './types';
import { splitForId } from './split';

export interface DraftProbe {
  id: string;
  ref: string;
  family: string;
  source: 'selfplay';
  incidentId: null;
  status: 'draft';
  approvedBy: [];
  split: 'dev' | 'heldout';
  abstractOnly: boolean;
  pattern: string;
  seed?: { synthetic: true; turns: string[] };
  mode: 'before' | 'after';
  expect: { criteria: string[] };
  created: string;
  notes: string;
}

export function fingerprint(r: Pick<CaseResult, 'family' | 'ref' | 'failedCriteria' | '_synthTurns' | 'sensitive'>): string {
  const turns = r.sensitive ? '' : (r._synthTurns ?? []).join('|');
  return createHash('sha256').update([r.family, r.ref, [...r.failedCriteria].sort().join(','), turns].join('::')).digest('hex').slice(0, 16);
}

export function toDraftProbe(r: CaseResult, id: string, today: string, runId: string): DraftProbe {
  const def = familyDef(r.family);
  const abstractOnly = def.sensitive;
  const turns = (r._synthTurns ?? []).slice(0, 6).map((t) => t.slice(0, 300));
  return {
    id,
    ref: r.ref,
    family: r.family,
    source: 'selfplay',
    incidentId: null,
    status: 'draft',
    approvedBy: [],
    split: splitForId(id),
    abstractOnly,
    pattern: `${def.description} Found by self-play; the host failed: ${r.failedCriteria.join(', ')}.`,
    ...(abstractOnly ? {} : { seed: { synthetic: true as const, turns } }),
    mode: r.mode,
    expect: { criteria: r.failedCriteria },
    created: today,
    notes: `selfplay run ${runId}; fp ${fingerprint(r)}`,
  };
}

/** Drafts for each new failure; skips ones whose fingerprint is already in `knownFingerprints`. */
export function draftsFromFailures(failures: CaseResult[], opts: { nextId: () => string; today: string; runId: string; knownFingerprints: Set<string> }): DraftProbe[] {
  const out: DraftProbe[] = [];
  for (const f of failures) {
    if (f.error || f.passed || f.failedCriteria.length === 0) continue;
    const fp = fingerprint(f);
    if (opts.knownFingerprints.has(fp)) continue;
    opts.knownFingerprints.add(fp);
    out.push(toDraftProbe(f, opts.nextId(), opts.today, opts.runId));
  }
  return out;
}
