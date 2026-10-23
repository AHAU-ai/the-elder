/**
 * preflightFigureDb.ts -- CI preflight for the Figure Continuity database suites
 * and live probes. Fails HERE, once, with an unmistakable "infrastructure, not a
 * verdict" message, so a missing migration or an unreachable test database is
 * never scored as a governance failure (the same philosophy as the Anthropic
 * preflight in drift-detect.yml and gk-007.yml).
 *
 * It (1) applies the production-refusal guard, (2) proves the database answers,
 * and (3) proves the schema the suites need is present, naming exactly which
 * migration is missing. It only READS.
 *
 * Exit codes: 0 ok, 2 infrastructure or safety stop (never a verdict).
 * Run: npx tsx tests/support/preflightFigureDb.ts
 */
import { neon } from '@neondatabase/serverless';
import { assertDevDatabase } from './devDatabaseGuard';

const REQUIRED: Array<{ table: string; migration: string }> = [
  { table: 'elder_user', migration: '001_baseline_myth_accounts.sql' },
  { table: 'visit_record', migration: '008_visit_record_on_elder_user.sql' },
  { table: 'myth_archetype', migration: '001_baseline_myth_accounts.sql' },
  { table: 'corpus_passage', migration: 'scripts-resilience/schema.sql' },
  { table: 'rate_limit_bucket', migration: '019_rate_limit_bucket.sql' },
  { table: 'figure_mapping', migration: '030_figure_mapping.sql' },
];

async function main() {
  assertDevDatabase();
  const sql = neon(process.env.DATABASE_URL as string);
  try {
    await sql`SELECT 1`;
  } catch (err) {
    console.error(`Infrastructure failure, not a verdict: the test database did not answer (${(err as Error).message}). NOTHING WAS RUN.`);
    process.exit(2);
  }
  const missing: string[] = [];
  for (const { table, migration } of REQUIRED) {
    const rows = await sql`SELECT to_regclass(${'public.' + table})::text AS t`;
    if (!rows[0]?.t) missing.push(`${table} (${migration})`);
  }
  if (missing.length > 0) {
    console.error(`Infrastructure failure, not a verdict: the test database is missing ${missing.join(', ')}. Apply the migration(s) to the test database, in order. NOTHING WAS RUN.`);
    process.exit(2);
  }
  console.log('[preflightFigureDb] test database reachable and migrated.');
}

main().catch(err => {
  console.error(`Infrastructure failure, not a verdict: ${(err as Error).message}. NOTHING WAS RUN.`);
  process.exit(2);
});
