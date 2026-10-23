/**
 * figureMappings.browser.test.mjs -- the seeker's own pairings view (FC-F) and
 * the link to it, in a REAL browser, against a real `next dev` server and the
 * real dev database. Nothing is scripted except the occasional injected network
 * failure: the capability report (/api/auth/me), the list, the remove and
 * release routes, the ledger and the session cookie are all real.
 *
 * Proves, in a browser:
 *   DARK: the signed-in row carries no link or disclosure; the page is still
 *     reachable by URL (releasing your own data is never withheld).
 *   LIT: the link and the one-line disclosure appear for a paid seeker, and for a
 *     seeker who has left the paid tier but still holds pairings (the freeze
 *     rule), and NOT for a free seeker with nothing; the page groups pairings by
 *     myth with the figure and myth named; a counterpart that is the Elder's own
 *     recollection says so; there is no export; Remove / release-a-myth /
 *     release-everything each ask first, in plain words, with equal-weight
 *     answers, and cancelling changes nothing; a double click is one request; a
 *     failed release says so and changes nothing, then can be retried; releases
 *     reach the database (including pending offers); an unreadable list is never
 *     shown as "nothing kept"; labels render as text; a signed-out visit shows
 *     nothing; keyboard focus never lands on a control that has disappeared; a
 *     phone screen has no horizontal overflow and comfortable touch targets.
 *
 * NOT run in CI (needs Chrome, a dev database and a dev server). Setup:
 *   npm i --no-save playwright-core
 *   DATABASE_URL=<dev branch url> npm run test:figure-mappings-browser
 */
import { spawn, execFileSync } from 'node:child_process';
import { createHmac, randomUUID, randomBytes } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

let chromium;
try {
  ({ chromium } = await import('playwright-core'));
} catch {
  console.error('playwright-core is not installed. Run: npm i --no-save playwright-core');
  process.exit(2);
}
const { neon } = await import('@neondatabase/serverless');
if (!process.env.DATABASE_URL) { console.error('DATABASE_URL (a DEV branch) is required.'); process.exit(2); }
const sql = neon(process.env.DATABASE_URL);

const CHROME = process.env.CHROME_PATH || [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
].find((p) => fs.existsSync(p));
if (!CHROME) { console.error('No Chrome found. Set CHROME_PATH.'); process.exit(2); }

const SHOTS = '.figure-shots';
fs.mkdirSync(SHOTS, { recursive: true });
const SECRET = 'fc-mappings-' + randomBytes(16).toString('hex');
const sign = (uid) => { const p = `${uid}.${Date.now() + 3_600_000}`; return `${p}.${createHmac('sha256', SECRET).update(p).digest('hex')}`; };

let failures = 0;
const check = (name, cond) => { if (cond) console.log(`  ok  ${name}`); else { console.error(`  FAIL  ${name}`); failures++; } };

function startServer({ lit, port }) {
  const env = { ...process.env, ELDER_SESSION_SECRET: SECRET, ANTHROPIC_API_KEY: 'test-key-not-used', ELDER_CORPUS_VERSION: 'test-corpus', NEXT_TELEMETRY_DISABLED: '1' };
  for (const k of ['FIGURE_CONTINUITY_ENABLED', 'MARKER_CONFIRMATION_READY', 'FIGURE_CONTINUITY_RELEASE_VERIFIED']) {
    if (lit) env[k] = 'true'; else delete env[k];
  }
  const child = spawn(process.execPath, [path.join('node_modules', 'next', 'dist', 'bin', 'next'), 'dev', '-p', String(port)], { env, stdio: ['ignore', 'pipe', 'pipe'] });
  let log = '';
  child.stdout.on('data', (d) => { log += d; });
  child.stderr.on('data', (d) => { log += d; });
  const ready = new Promise((resolve, reject) => {
    const t = setInterval(() => { if (/Ready in/.test(log)) { clearInterval(t); resolve(); } }, 300);
    setTimeout(() => { clearInterval(t); reject(new Error('dev server did not become ready:\n' + log.slice(-800))); }, 120_000);
  });
  const stop = () => {
    try {
      if (process.platform === 'win32') execFileSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
      else process.kill(-child.pid);
    } catch { /* already gone */ }
  };
  return { ready, stop, base: `http://localhost:${port}` };
}

const users = [];
async function newUser(tier) {
  const [u] = await sql`INSERT INTO elder_user (email) VALUES (${`figure-mappings-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@example.invalid`}) RETURNING id`;
  const uid = Number(u.id);
  users.push(uid);
  await sql`UPDATE elder_user SET tier = ${tier} WHERE id = ${uid}`;
  await sql`INSERT INTO myth_archetype (user_id, lineage_key, archetype_name, summary, people_circumstances, reading_count) VALUES (${uid}, 'maya', 'The Twins', 'A summary of the twins myth.', '', 1)`;
  return uid;
}
async function newChain(uid, { lineage = 'maya', title = 'The Twins', figure = 'The Hero Twin' } = {}) {
  const chainId = randomUUID();
  await sql`INSERT INTO visit_record (user_id, chain_id, visit_mode, lineage_key, myth_title, archetype, elder_response, markers_confirmed)
            VALUES (${uid}, ${chainId}, 'explore', ${lineage}, ${title}, ${title}, 'an earlier reading', ${JSON.stringify({ figure })}::jsonb)`;
  return { chainId, lineage, title, figure };
}
async function addPairing(uid, chain, subject, counterpart, { status = 'confirmed', basis = 'model_report', ageDays = 0 } = {}) {
  const [r] = status === 'confirmed'
    ? await sql`INSERT INTO figure_mapping (user_id, chain_id, lineage_key, myth_title, figure_label, subject_kind, subject_label, counterpart_label, counterpart_basis, status, confirmed_at)
                VALUES (${uid}, ${chain.chainId}, ${chain.lineage}, ${chain.title}, ${chain.figure}, 'person', ${subject}, ${counterpart}, ${basis}, 'confirmed', now() - make_interval(days => ${ageDays})) RETURNING id`
    : await sql`INSERT INTO figure_mapping (user_id, chain_id, lineage_key, myth_title, figure_label, subject_kind, subject_label, counterpart_label, counterpart_basis, status)
                VALUES (${uid}, ${chain.chainId}, ${chain.lineage}, ${chain.title}, ${chain.figure}, 'person', ${subject}, ${counterpart}, ${basis}, 'offered') RETURNING id`;
  return Number(r.id);
}
const countRows = async (uid) => (await sql`SELECT count(*)::int n FROM figure_mapping WHERE user_id = ${uid}`)[0].n;
const exists = async (id) => (await sql`SELECT 1 FROM figure_mapping WHERE id = ${id}`).length === 1;

async function open(browser, uid, { width = 900, height = 900 } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height }, reducedMotion: 'reduce' });
  if (uid) await ctx.addCookies([{ name: 'elder_session', value: sign(uid), domain: 'localhost', path: '/' }]);
  return { ctx, page: await ctx.newPage() };
}
/** Walk the real entry sequence to the signed-in row on the myth-choice screen. */
async function toMythChoice(page, base) {
  await page.goto(base + '/', { waitUntil: 'load', timeout: 120_000 });
  await page.waitForTimeout(4000);
  await page.mouse.click(page.viewportSize().width / 2, page.viewportSize().height * 0.51);
  const skip = page.getByText('Skip', { exact: false }).first();
  await skip.waitFor({ timeout: 90_000 });
  await skip.click();
  await page.getByText('YOUR MYTH IS STILL BURNING').waitFor({ timeout: 60_000 });
  await page.waitForTimeout(800);
}
/** The page's own load state: wait until it has finished loading (ready, error or signed out). */
const loaded = (page) => page.waitForSelector('[data-load]:not([data-load="loading"])', { timeout: 60_000 });
const overflowX = (page) => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
const NOTE = 'pairings you confirm are kept until you remove them';

async function main() {
  const browser = await chromium.launch({ executablePath: CHROME, headless: true });
  let server;
  try {
    // ════════════════ DARK ════════════════
    console.log('\n[DARK] flags unset');
    server = startServer({ lit: false, port: 3131 });
    await server.ready;
    {
      const uid = await newUser('kept');
      const chain = await newChain(uid);
      await addPairing(uid, chain, 'my sister', 'the Maize Maiden');
      const { ctx, page } = await open(browser, uid);
      const me = await page.request.get(server.base + '/api/auth/me', { headers: { cookie: `elder_session=${sign(uid)}` } }).then((r) => r.json());
      check('dark: /api/auth/me reports no figureContinuity (the response is what it was)', !('figureContinuity' in me) && !!me.email);
      await toMythChoice(page, server.base);
      check('dark: the signed-in row has no pairings link', (await page.getByText('your kept pairings').count()) === 0);
      check('dark: ...and no disclosure line', (await page.getByText(NOTE).count()) === 0);
      await page.goto(server.base + '/mappings', { waitUntil: 'load' });
      await page.getByText('KEPT PAIRINGS').waitFor({ timeout: 60_000 });
      await loaded(page);
      check('dark: the page is still reachable by URL, and shows what is held (releasing your own data is never withheld)', (await page.getByText('\u201cmy sister\u201d').count()) === 1);
      await ctx.close();
    }
    server.stop(); server = null;

    // ════════════════ LIT ════════════════
    console.log('\n[LIT] all three gates');
    server = startServer({ lit: true, port: 3132 });
    await server.ready;

    // ── the link and the disclosure ──
    {
      const paid = await newUser('kept');
      const { ctx, page } = await open(browser, paid);
      await toMythChoice(page, server.base);
      check('link: a paid seeker sees "your kept pairings"', (await page.getByRole('link', { name: 'your kept pairings' }).count()) === 1);
      check('link: and the one-line disclosure under the signed-in row', (await page.getByText(NOTE).count()) === 1);
      await page.screenshot({ path: path.join(SHOTS, 'row-with-link.png') });
      await page.getByRole('link', { name: 'your kept pairings' }).click();
      await page.getByText('KEPT PAIRINGS').waitFor({ timeout: 60_000 });
      await loaded(page);
      check('link: it leads to the pairings page', page.url().endsWith('/mappings'));
      check('link: a seeker with nothing kept sees the warm empty state', (await page.getByText('Nothing is kept here yet. A pairing is kept only when you say that it fits.').count()) === 1);
      check('link: and nothing to release', (await page.getByRole('button', { name: 'Release everything' }).count()) === 0);
      await ctx.close();

      const free = await newUser('seeker');
      const a = await open(browser, free);
      await toMythChoice(a.page, server.base);
      check('link: a FREE seeker with nothing kept sees no link', (await a.page.getByText('your kept pairings').count()) === 0);
      check('link: ...and no disclosure', (await a.page.getByText(NOTE).count()) === 0);
      await a.ctx.close();

      const lapsed = await newUser('seeker');
      const lc = await newChain(lapsed);
      await addPairing(lapsed, lc, 'my aunt', 'the Weaver');
      const b = await open(browser, lapsed);
      await toMythChoice(b.page, server.base);
      check('link: a seeker who LEFT the paid tier but still holds pairings keeps the link (the freeze rule)', (await b.page.getByRole('link', { name: 'your kept pairings' }).count()) === 1);
      await b.ctx.close();
    }

    // ── the page ──
    {
      const uid = await newUser('kept');
      const maya = await newChain(uid, { lineage: 'maya', title: 'The Twins', figure: 'The Hero Twin' });
      const norse = await newChain(uid, { lineage: 'norse', title: 'The Wanderer', figure: 'The Seeress' });
      const idSister = await addPairing(uid, maya, 'my sister', 'the Maize Maiden', { ageDays: 3 });
      const idBrother = await addPairing(uid, maya, 'my brother', 'the Elder Twin', { basis: 'corpus', ageDays: 2 });
      const idAunt = await addPairing(uid, norse, 'my aunt', 'the Norn', { ageDays: 1 });
      const idPending = await addPairing(uid, norse, 'a pending one', 'the Owl', { status: 'offered' });
      const { ctx, page: p } = await open(browser, uid);
      await p.goto(server.base + '/mappings', { waitUntil: 'load' });
      await p.getByText('KEPT PAIRINGS').waitFor({ timeout: 60_000 });
      await p.getByText('\u201cmy aunt\u201d').waitFor({ timeout: 20_000 });
      await p.screenshot({ path: path.join(SHOTS, 'pairings.png'), fullPage: true });

      check('page: one section per myth', (await p.locator('section').count()) === 2);
      check('page: the figure and the myth are named', (await p.getByText('As \u201cThe Hero Twin\u201d').count()) === 1 && (await p.getByText('The Wanderer').count()) === 1);
      check('page: the myth with the newest pairing is first', (await p.locator('section').first().innerText()).includes('my aunt'));
      check('page: every confirmed pairing is shown, in the seeker\'s words', (await p.getByText('\u201cmy sister\u201d').count()) === 1 && (await p.getByText('\u201cthe Elder Twin\u201d').count()) === 1 && (await p.getByText('\u201cthe Norn\u201d').count()) === 1);
      check('page: a pending (unanswered) offer is NOT shown as kept', (await p.getByText('a pending one').count()) === 0);
      check('page: a counterpart that is the Elder\'s own recollection says so, a corpus-backed one does not', (await p.getByText('not a cited passage').count()) === 2);
      check('page: there is no export, download, copy or share', (await p.locator('a[download], button:has-text("Download"), button:has-text("Export"), button:has-text("Copy"), button:has-text("Share")').count()) === 0);
      check('page: a way back to the fire', (await p.getByRole('link', { name: /back to the fire/ }).count()) === 1);

      // remove one: ask first; cancelling changes nothing
      await p.getByRole('button', { name: 'Remove: my sister echoes the Maize Maiden' }).click();
      await p.getByText('Remove this pairing?').first().waitFor({ timeout: 10_000 });
      const keepIt = p.getByRole('button', { name: 'Keep it' });
      check('remove: the safe answer takes focus (a stray Enter keeps)', await keepIt.evaluate((el) => document.activeElement === el));
      const [yes, no] = [p.getByRole('button', { name: 'Remove', exact: true }).last(), keepIt];
      const [by, bn] = await Promise.all([yes.boundingBox(), no.boundingBox()]);
      check('remove: the two answers carry equal weight (same size)', Math.abs(by.width - bn.width) < 1 && Math.abs(by.height - bn.height) < 1);
      check('remove: other release controls are disabled while one question waits', await p.getByRole('button', { name: 'Release everything' }).isDisabled());
      await keepIt.click();
      check('remove: "Keep it" changes nothing', (await exists(idSister)) && (await p.getByText('\u201cmy sister\u201d').count()) === 1);
      check('remove: focus returns to the control that asked', await p.getByRole('button', { name: 'Remove: my sister echoes the Maize Maiden' }).evaluate((el) => document.activeElement === el));

      // a double click on the confirm is ONE request
      let deletes = 0;
      await p.route(`**/api/figure-mappings/${idSister}`, async (r) => { if (r.request().method() === 'DELETE') { deletes++; await new Promise((x) => setTimeout(x, 500)); } await r.continue(); });
      await p.getByRole('button', { name: 'Remove: my sister echoes the Maize Maiden' }).click();
      await p.getByRole('button', { name: 'Remove', exact: true }).last().dblclick();
      await p.getByText('Removed.').waitFor({ timeout: 15_000 });
      check('remove: a double click on the confirm is exactly one request', deletes === 1);
      check('remove: the pairing is gone from the database and the page', !(await exists(idSister)) && (await p.getByText('\u201cmy sister\u201d').count()) === 0);
      check('remove: the others are untouched', (await exists(idBrother)) && (await exists(idAunt)));
      check('remove: focus is not lost to the page body (it goes to the heading)', await p.getByRole('heading', { name: 'KEPT PAIRINGS' }).evaluate((el) => document.activeElement === el));

      // a failed release says so and changes nothing, then works on retry
      await p.route('**/api/figure-mappings/release', (r) => r.abort('failed'), { times: 1 });
      await p.getByRole('button', { name: /^Release this myth/ }).first().click();
      await p.getByRole('button', { name: 'Release', exact: true }).click();
      await p.getByText('Nothing was released; you may try again.').waitFor({ timeout: 10_000 });
      check('failure: says so plainly and the database is unchanged', (await countRows(uid)) === 3);
      check('failure: the list is unchanged', (await p.getByText('\u201cmy aunt\u201d').count()) === 1 && (await p.getByText('\u201cthe Elder Twin\u201d').count()) === 1);

      // the question stays open after a failure, so the seeker can simply try again
      check('failure: the question stays open so the seeker can retry (and the other controls stay disabled)', (await p.getByText(/^Release (the pairing|all \d+ pairings) kept in this myth\?$/).count()) === 1 && (await p.getByRole('button', { name: 'Release everything' }).isDisabled()));
      // release one myth (the retry)
      await p.getByRole('button', { name: 'Release', exact: true }).click();
      await p.getByText(/Released \d+ pairings?\./).waitFor({ timeout: 15_000 });
      const left = await sql`SELECT id, status FROM figure_mapping WHERE user_id = ${uid} ORDER BY id`;
      check('myth: one myth\'s pairings are released (and its pending offer with them); the other myth is untouched', left.length === 1 && Number(left[0].id) === idBrother);
      check('myth: the page shows only what is still held', (await p.locator('section').count()) === 1 && (await p.getByText('\u201cthe Elder Twin\u201d').count()) === 1);

      // release everything
      await p.getByRole('button', { name: 'Release everything' }).click();
      check('everything: says it cannot be undone', (await p.getByText('Release every pairing the fire holds for you? This cannot be undone.').count()) === 1);
      await p.getByRole('button', { name: 'Release everything' }).last().click();
      await p.getByText('Nothing is kept here yet.').waitFor({ timeout: 15_000 });
      check('everything: nothing remains in the database', (await countRows(uid)) === 0);
      check('everything: the empty state is shown', (await p.getByRole('button', { name: 'Release everything' }).count()) === 0);
      await ctx.close();
    }

    // ── an unreadable list is never "nothing kept" ──
    {
      const uid = await newUser('kept');
      const chain = await newChain(uid);
      await addPairing(uid, chain, 'my sister', 'the Maize Maiden');
      for (const [name, fulfill] of [
        ['a server error', (r) => r.fulfill({ status: 500, contentType: 'application/json', body: '{"error":"unavailable"}' })],
        ['a malformed body', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"mappings":"nope"}' })],
        ['a dropped connection', (r) => r.abort('failed')],
      ]) {
        const { ctx, page } = await open(browser, uid);
        await page.route('**/api/figure-mappings', fulfill);
        await page.goto(server.base + '/mappings', { waitUntil: 'load' });
        await loaded(page); // (not getByRole('alert'): Next's own route announcer is an empty role=alert that is there at once)
        check(`unreadable (${name}): says nothing could be shown, and that this does not mean nothing is kept`, (await page.getByText('That does not mean nothing is kept.').count()) === 1);
        check(`unreadable (${name}): never shown as the empty state`, (await page.getByText('Nothing is kept here yet.').count()) === 0);
        await ctx.close();
      }
    }

    // ── signed out ──
    {
      const { ctx, page } = await open(browser, null);
      await page.goto(server.base + '/mappings', { waitUntil: 'load' });
      await page.getByText('Pairings are kept for a seeker who has signed in.').waitFor({ timeout: 60_000 });
      check('signed out: nothing is shown but the invitation to sign in', (await page.getByText('\u201c').count()) === 0);
      await ctx.close();
    }

    // ── hostile labels render as text ──
    {
      const uid = await newUser('kept');
      const chain = await newChain(uid, { title: '<i>myth</i>', figure: '<b>figure</b>' });
      await addPairing(uid, chain, '<img src=x onerror="window.__pwn=1">', '</li><script>window.__pwn=1</script>');
      const { ctx, page } = await open(browser, uid);
      await page.goto(server.base + '/mappings', { waitUntil: 'load' });
      await page.getByText('KEPT PAIRINGS').waitFor({ timeout: 60_000 });
      await page.waitForTimeout(1500);
      check('hostile: the markup is shown as text', (await page.getByText('<img src=x onerror="window.__pwn=1">', { exact: false }).count()) === 1);
      check('hostile: nothing was injected or executed', (await page.locator('main img, section img, section script, section i, section b').count()) === 0 && !(await page.evaluate(() => window.__pwn)));
      await ctx.close();
    }

    // ── keyboard ──
    {
      const uid = await newUser('kept');
      const chain = await newChain(uid);
      const id = await addPairing(uid, chain, 'my cousin', 'the Parrot');
      const { ctx, page } = await open(browser, uid);
      await page.goto(server.base + '/mappings', { waitUntil: 'load' });
      await page.getByText('\u201cmy cousin\u201d').waitFor({ timeout: 60_000 });
      await page.getByRole('button', { name: /^Remove: my cousin/ }).focus();
      await page.keyboard.press('Enter');
      await page.getByText('Remove this pairing?').first().waitFor({ timeout: 10_000 });
      check('keyboard: Enter opens the question and the safe answer already has focus', await page.getByRole('button', { name: 'Keep it' }).evaluate((el) => document.activeElement === el));
      await page.keyboard.press('Enter');
      check('keyboard: a stray Enter on the question keeps the pairing', (await exists(id)) && (await page.getByText('\u201cmy cousin\u201d').count()) === 1);
      await page.getByRole('button', { name: /^Remove: my cousin/ }).focus();
      await page.keyboard.press('Enter');
      await page.getByRole('button', { name: 'Remove', exact: true }).last().focus();
      await page.keyboard.press('Enter');
      await page.getByText('Removed.').waitFor({ timeout: 15_000 });
      check('keyboard: Tab, Enter, Tab, Enter removes it, deliberately', !(await exists(id)));
      await ctx.close();
    }

    // ── a phone ──
    {
      const uid = await newUser('kept');
      const chain = await newChain(uid, { title: 'The Twins of the Underworld and the Long Road Home', figure: 'The Hero Twin Who Went Down' });
      await addPairing(uid, chain, 'my older sister who moved away', 'the Maize Maiden of the second dawn');
      await addPairing(uid, chain, 'the move', 'the Descent');
      const { ctx, page } = await open(browser, uid, { width: 375, height: 800 });
      await page.goto(server.base + '/mappings', { waitUntil: 'load' });
      await page.getByText('\u201cthe move\u201d').waitFor({ timeout: 60_000 });
      check('phone: the page does not overflow horizontally', (await overflowX(page)) <= 1);
      const b = await page.getByRole('button', { name: 'Release everything' }).boundingBox();
      check('phone: controls are comfortable touch targets', b.height >= 44);
      await page.getByRole('button', { name: /^Remove: the move/ }).click();
      await page.getByText('Remove this pairing?').first().waitFor({ timeout: 10_000 });
      check('phone: the confirmation does not overflow either', (await overflowX(page)) <= 1);
      await page.screenshot({ path: path.join(SHOTS, 'pairings-phone.png'), fullPage: true });
      await ctx.close();
    }
  } finally {
    for (const uid of users) { try { await sql`DELETE FROM elder_user WHERE id = ${uid}`; } catch { /* best effort */ } }
    if (server) server.stop();
    await browser.close();
  }

  if (failures > 0) { console.error(`\n${failures} browser check(s) failed. Screenshots: ${SHOTS}/`); process.exit(1); }
  console.log(`\nfigure mappings browser walkthrough: all passed (screenshots in ${SHOTS}/)`);
}

main().catch((err) => { console.error(err); process.exit(1); });
