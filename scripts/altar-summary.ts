/**
 * What seekers said back after their Readings, in aggregate.
 *
 *   DATABASE_URL=<url> npm run altar:summary
 *   DATABASE_URL=<url> npm run altar:summary -- --days 30
 *   DATABASE_URL=<url> npm run altar:summary -- --json
 *
 * Read-only. Prints land rate with a Wilson interval per lineage and per
 * contract/model/corpus version, and flags a version that is clearly better or
 * worse than the one before it. See lib/altarSummary.ts.
 */
import { neon } from '@neondatabase/serverless';
import { summarize, formatSummary } from '../lib/altarSummary';
import { fetchSignalRows, parseDays } from '../lib/altarSummaryQuery';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('ERROR: DATABASE_URL environment variable is required.');
  console.error('Usage: DATABASE_URL=<url> npm run altar:summary -- [--days N] [--json]');
  process.exit(1);
}

const args = process.argv.slice(2);
const di = args.indexOf('--days');
const days = parseDays(di >= 0 ? args[di + 1] : undefined);

fetchSignalRows(neon(url), days)
  .then((rows) => {
    const summary = summarize(rows);
    if (args.includes('--json')) console.log(JSON.stringify({ days, rows: rows.length, summary }, null, 2));
    else console.log(`Last ${days} days · ${rows.length} signals\n\n${formatSummary(summary)}`);
  })
  .catch((err) => {
    console.error('altar summary failed:', err instanceof Error ? err.message : err);
    process.exit(1);
  });
