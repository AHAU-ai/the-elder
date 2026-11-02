/**
 * Who approved the approved corpus?
 *
 *   npm run corpus:audit
 *   npm run corpus:audit -- --strict-lineages=kiche,norse     (exit 1 if those have unreviewed approvals)
 *   npm run corpus:audit -- --json
 *
 * Report-only by default. See lib/corpusReviewAudit.ts.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { auditFile, formatAudit, strictFailures, type PassageLike } from '../lib/corpusReviewAudit';

const dir = join(__dirname, '..', 'corpus');
const args = process.argv.slice(2);
const strict = (args.find((a) => a.startsWith('--strict-lineages=')) ?? '').split('=')[1]?.split(',') ?? [];

const audits = readdirSync(dir).filter((f) => f.endsWith('.json')).sort().flatMap((f) => {
  let d: unknown;
  try { d = JSON.parse(readFileSync(join(dir, f), 'utf8')); } catch { return []; }
  const items = Array.isArray(d) ? d : (d as { passages?: unknown; items?: unknown })?.passages ?? (d as { items?: unknown })?.items;
  return Array.isArray(items) ? [auditFile(f, items as PassageLike[])] : [];
});

if (args.includes('--json')) console.log(JSON.stringify(audits, null, 2));
else console.log(formatAudit(audits));

const bad = strictFailures(audits, strict);
if (bad.length) {
  console.error(`\nSTRICT: ${bad.map((a) => a.file).join(', ')} have approved passages without a named human reviewer.`);
  process.exit(1);
}
