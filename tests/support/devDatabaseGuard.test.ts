/**
 * devDatabaseGuard.test.ts -- hermetic tests for the production-refusal guard
 * (tests/support/devDatabaseGuard.ts). It runs in `npm run test:unit`, in CI,
 * with no database: a guard that protects production must itself be tested
 * where nobody can lose data if it is wrong.
 *
 * Run: npx tsx tests/support/devDatabaseGuard.test.ts
 */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { checkDevDatabase, normalizedHost, KNOWN_PRODUCTION_HOSTS } from './devDatabaseGuard';

const url = (host: string) => `postgresql://user:pw@${host}/neondb?sslmode=require`;
const DEV = 'ep-frosty-mode-aijgrxmb';
const PROD = KNOWN_PRODUCTION_HOSTS[0];
const REGION = 'c-4.us-east-1.aws.neon.tech';

// ── host parsing ──
assert.equal(normalizedHost(url(`${DEV}-pooler.${REGION}`)), `${DEV}.${REGION}`, 'the pooler suffix is ignored');
assert.equal(normalizedHost(url(`${DEV}.${REGION}`)), `${DEV}.${REGION}`);
assert.equal(normalizedHost(url(`${DEV.toUpperCase()}.${REGION}`)), `${DEV}.${REGION}`, 'case-insensitive');
for (const bad of [undefined, '', 'not a url', 'postgres://', '://x']) assert.equal(normalizedHost(bad as string), null, `unparseable: ${String(bad)}`);

// ── production is always refused, locally and in CI, pooled or not ──
for (const ci of [{}, { CI: 'true', FIGURE_TEST_DB_HOST: `${PROD}.${REGION}` }]) {
  for (const host of [`${PROD}.${REGION}`, `${PROD}-pooler.${REGION}`, `${PROD.toUpperCase()}.${REGION}`]) {
    const r = checkDevDatabase(url(host), ci as Record<string, string | undefined>);
    assert.equal(r.ok, false, `production refused: ${host} ${JSON.stringify(ci)}`);
    assert.ok(/production deny list/.test(r.reason ?? ''), 'and says why');
  }
}
assert.equal(checkDevDatabase(url(`evil-${PROD}.example.com`), {}).ok, false, 'a host that merely contains the production name is refused (over-blocking is the safe direction)');

// ── extra denials from the environment ──
assert.equal(checkDevDatabase(url(`ep-other.${REGION}`), { FIGURE_TEST_DB_DENY_HOSTS: 'ep-other, ep-another' }).ok, false);
assert.equal(checkDevDatabase(url(`ep-another.${REGION}`), { FIGURE_TEST_DB_DENY_HOSTS: ' ep-other , ep-another ' }).ok, false, 'whitespace in the list is tolerated');
assert.equal(checkDevDatabase(url(`${DEV}.${REGION}`), { FIGURE_TEST_DB_DENY_HOSTS: ',,' }).ok, true, 'empty entries deny nothing');

// ── locally: a developer targets their own dev branch; no allow-list needed ──
{
  const r = checkDevDatabase(url(`${DEV}-pooler.${REGION}`), {});
  assert.equal(r.ok, true);
  assert.equal(r.host, `${DEV}.${REGION}`);
}

// ── in CI the owner must NAME the host, and it must match ──
const ci = (extra: Record<string, string> = {}): Record<string, string | undefined> => ({ CI: 'true', ...extra });
assert.equal(checkDevDatabase(url(`${DEV}.${REGION}`), ci()).ok, false, 'CI without FIGURE_TEST_DB_HOST: nothing runs');
assert.ok(/FIGURE_TEST_DB_HOST/.test(checkDevDatabase(url(`${DEV}.${REGION}`), ci()).reason ?? ''));
assert.equal(checkDevDatabase(url(`${DEV}.${REGION}`), ci({ FIGURE_TEST_DB_HOST: '   ' })).ok, false, 'a blank allow-list is no allow-list');
assert.equal(checkDevDatabase(url(`${DEV}.${REGION}`), ci({ FIGURE_TEST_DB_HOST: `ep-different.${REGION}` })).ok, false, 'a different host than the one named');
assert.equal(checkDevDatabase(url(`${DEV}.${REGION}`), ci({ FIGURE_TEST_DB_HOST: `${DEV}.${REGION}` })).ok, true, 'the named host passes');
assert.equal(checkDevDatabase(url(`${DEV}-pooler.${REGION}`), ci({ FIGURE_TEST_DB_HOST: `${DEV}.${REGION}` })).ok, true, 'pooled URL, unpooled allow-list');
assert.equal(checkDevDatabase(url(`${DEV}.${REGION}`), ci({ FIGURE_TEST_DB_HOST: `${DEV}-pooler.${REGION}` })).ok, true, 'unpooled URL, pooled allow-list');
assert.equal(checkDevDatabase(url(`${DEV}.${REGION}`), ci({ FIGURE_TEST_DB_HOST: ` ${DEV.toUpperCase()}.${REGION} ` })).ok, true, 'case and spaces in the allow-list');
assert.equal(checkDevDatabase(url(`${DEV}.${REGION}`), { CI: 'TRUE', FIGURE_TEST_DB_HOST: 'x' } as Record<string, string | undefined>).ok, true, 'only the exact string "true" means CI (GitHub sets exactly that)');

// ── nothing, or junk, never passes ──
for (const bad of [undefined, '', 'garbage', 'postgres://']) {
  assert.equal(checkDevDatabase(bad as string, {}).ok, false, `no usable URL: ${String(bad)}`);
}

// ── the CLI really stops with status 2 and writes nothing ──
{
  const script = path.join('tests', 'support', 'devDatabaseGuard.ts');
  const run = (env: Record<string, string>) =>
    spawnSync(process.execPath, [path.join('node_modules', 'tsx', 'dist', 'cli.mjs'), script, '--check'], {
      env: { PATH: process.env.PATH ?? '', ...env } as unknown as NodeJS.ProcessEnv, encoding: 'utf8',
    });
  const prod = run({ DATABASE_URL: url(`${PROD}-pooler.${REGION}`) });
  assert.equal(prod.status, 2, 'the CLI exits 2 (a safety stop) on production');
  assert.ok(/REFUSING TO RUN/.test(prod.stderr) && /not a test failure/.test(prod.stderr), 'and says it is not a verdict');
  const unset = run({ CI: 'true', DATABASE_URL: url(`${DEV}.${REGION}`) });
  assert.equal(unset.status, 2, 'CI with no named host: exit 2');
  const ok = run({ CI: 'true', FIGURE_TEST_DB_HOST: `${DEV}.${REGION}`, DATABASE_URL: url(`${DEV}-pooler.${REGION}`) });
  assert.equal(ok.status, 0, 'the named dev host: exit 0');
  assert.ok(ok.stdout.includes(`${DEV}.${REGION}`), 'and prints the host so the target is never silent');
}

console.log('devDatabaseGuard tests passed');
