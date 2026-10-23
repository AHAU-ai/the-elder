/**
 * devDatabaseGuard.ts -- the one thing standing between a Figure Continuity
 * test run and a production database.
 *
 * The integration suites and the live probes CREATE and DELETE rows (throwaway
 * seekers, chains, pairings), so they must only ever run against a development
 * branch. This repo's other CI jobs run with a DATABASE_URL that reaches
 * PRODUCTION (drift-detect.yml says so in its own comments), and a developer's
 * .env.local defines more than one URL. A wrong target is not hypothetical here:
 * it has happened once before in this project (a dev-only ingest wrote to
 * production on 2026-09-10 because the connection variable was inferred from the
 * structure of an env file). So this guard does not infer; it refuses, and in CI
 * it requires the owner to NAME the one host that may be written to.
 *
 *   - Always refuses a host that is a known production endpoint.
 *   - Always refuses a host listed in FIGURE_TEST_DB_DENY_HOSTS (comma separated).
 *   - In CI (CI=true) it additionally requires FIGURE_TEST_DB_HOST to be set and
 *     to equal this URL's host (the "-pooler" suffix is ignored, so the pooled and
 *     unpooled URLs of one branch both match). Without that, nothing runs.
 *   - Locally it does not require an allow-list (a developer targets their own dev
 *     branch from .env.local), but it prints the host so the target is never silent.
 *
 * A refusal exits with status 2, which every caller treats as "infrastructure /
 * safety stop, nothing was judged", never as a test verdict.
 *
 * CLI (used by the CI preflight):  npx tsx tests/support/devDatabaseGuard.ts --check
 */

/** Production endpoints. Add a host here the moment one is identified. */
export const KNOWN_PRODUCTION_HOSTS = ['ep-odd-term-aitveb5q'];

/** The host of a Postgres URL, lower-cased, without the pooler suffix on its first label. */
export function normalizedHost(url: string | undefined): string | null {
  if (!url) return null;
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host ? host.replace(/-pooler(?=\.)/, '') : null;
  } catch {
    return null;
  }
}

export interface GuardResult {
  ok: boolean;
  host: string | null;
  reason?: string;
}

export function checkDevDatabase(
  url: string | undefined = process.env.DATABASE_URL,
  env: Record<string, string | undefined> = process.env
): GuardResult {
  const host = normalizedHost(url);
  if (!host) return { ok: false, host, reason: 'DATABASE_URL is missing or is not a valid URL' };

  const denied = [...KNOWN_PRODUCTION_HOSTS, ...(env.FIGURE_TEST_DB_DENY_HOSTS ?? '').split(',').map(s => s.trim()).filter(Boolean)]
    .map(h => h.toLowerCase());
  const hit = denied.find(h => host.includes(h));
  if (hit) return { ok: false, host, reason: `this host is on the production deny list (${hit}); these tests create and delete rows` };

  if (env.CI === 'true') {
    const allow = (env.FIGURE_TEST_DB_HOST ?? '').trim().toLowerCase().replace(/-pooler(?=\.)/, '');
    if (!allow) {
      return { ok: false, host, reason: 'CI requires FIGURE_TEST_DB_HOST (the one test-database host that may be written to) and it is not set' };
    }
    if (allow !== host) {
      return { ok: false, host, reason: 'the database host is not the one named in FIGURE_TEST_DB_HOST' };
    }
  }
  return { ok: true, host };
}

/** Exit 2 (a safety stop, not a verdict) unless DATABASE_URL is an acceptable test database. */
export function assertDevDatabase(url?: string): string {
  const result = checkDevDatabase(url ?? process.env.DATABASE_URL);
  if (!result.ok) {
    console.error(`REFUSING TO RUN: ${result.reason}.${result.host ? ` Host: ${result.host}.` : ''}`);
    console.error('This is a safety stop, not a test failure. Nothing was run and nothing was written.');
    process.exit(2);
  }
  console.log(`[devDatabaseGuard] test database host: ${result.host}`);
  return result.host as string;
}

// CLI: `--check` validates the environment and prints the host, for the CI preflight.
if (process.argv[1] && /devDatabaseGuard\.ts$/.test(process.argv[1].replace(/\\/g, '/')) && process.argv.includes('--check')) {
  assertDevDatabase();
}
