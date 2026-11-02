/**
 * corpusReviewAudit.ts
 *
 * The corpus build gate checks that a passage's review_status is "approved".
 * It does not check WHO approved it. This classifies the `reviewed_by` field so
 * an operator can see how much of the approved corpus rests on a named human
 * reviewer versus a seed label, a developer override, a retracted name, or nothing.
 *
 * Report-only: it never changes a status. Whether a tradition needs a
 * tradition-bearer reviewer is a governance decision (see --strict-lineages).
 */

export type ReviewerClass =
  | 'named_human'     // a person's name
  | 'seed'            // ahau-ai-seed: loaded by the project, not reviewed by a bearer
  | 'dev_override'    // *-dev-override-*, *-operator-decision: an operator bypass
  | 'retracted'       // "[name retracted ...]"
  | 'none';           // null / empty

export function classifyReviewer(reviewedBy: unknown): ReviewerClass {
  if (typeof reviewedBy !== 'string' || reviewedBy.trim() === '') return 'none';
  const v = reviewedBy.trim().toLowerCase();
  if (v.startsWith('[') && v.includes('retracted')) return 'retracted';
  if (v === 'ahau-ai-seed') return 'seed';
  if (v.includes('dev-override') || v.includes('operator-decision')) return 'dev_override';
  return 'named_human';
}

export interface PassageLike { review_status?: unknown; reviewed_by?: unknown }

export interface FileAudit {
  file: string;
  total: number;
  approved: number;
  byReviewer: Record<ReviewerClass, number>; // counts among APPROVED passages only
  reviewers: string[];                       // distinct reviewed_by values among approved
}

const EMPTY = (): Record<ReviewerClass, number> =>
  ({ named_human: 0, seed: 0, dev_override: 0, retracted: 0, none: 0 });

export function auditFile(file: string, passages: PassageLike[]): FileAudit {
  const byReviewer = EMPTY();
  const reviewers = new Set<string>();
  let approved = 0;
  for (const p of passages) {
    if (p.review_status !== 'approved') continue;
    approved++;
    byReviewer[classifyReviewer(p.reviewed_by)]++;
    if (typeof p.reviewed_by === 'string' && p.reviewed_by) reviewers.add(p.reviewed_by);
  }
  return { file, total: passages.length, approved, byReviewer, reviewers: [...reviewers].sort() };
}

/** Approved passages not backed by a named human reviewer. */
export function unreviewedApproved(a: FileAudit): number {
  return a.approved - a.byReviewer.named_human;
}

export function formatAudit(audits: FileAudit[]): string {
  const lines: string[] = [];
  let approved = 0, human = 0;
  for (const a of audits) {
    approved += a.approved; human += a.byReviewer.named_human;
    if (a.approved === 0) continue;
    const bad = unreviewedApproved(a);
    const parts = (Object.entries(a.byReviewer) as [ReviewerClass, number][])
      .filter(([, n]) => n > 0).map(([k, n]) => `${k} ${n}`).join(' · ');
    lines.push(`${bad === 0 ? 'ok  ' : 'FLAG'} ${a.file}: ${a.approved} approved — ${parts}`);
  }
  lines.push('', `${human} of ${approved} approved passages carry a named human reviewer; ${approved - human} do not.`);
  return lines.join('\n');
}

/** Passages that would fail a strict gate for the given lineages (matched on file name). */
export function strictFailures(audits: FileAudit[], needles: string[]): FileAudit[] {
  const ns = needles.map((n) => n.toLowerCase()).filter(Boolean);
  return audits.filter((a) => ns.some((n) => a.file.toLowerCase().includes(n)) && unreviewedApproved(a) > 0);
}
