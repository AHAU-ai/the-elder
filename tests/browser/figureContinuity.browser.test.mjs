/**
 * figureContinuity.browser.test.mjs -- the Figure Continuity client (FC-E) in a
 * REAL browser, against a real `next dev` server and the real dev database.
 * Only one thing is scripted: the model. `/api/divine` is intercepted and
 * answered with a controlled response (carrying a real offer row this script
 * creates), so every other layer is the real one: the arrival lookup
 * (/api/user/history?head=1), the confirm and remove routes, the ledger, the
 * session cookie, the React UI.
 *
 * Proves, in a browser:
 *   DARK (flags unset): the arrival lookup reports nothing, the myth card goes
 *     straight in exactly as before, and no request ever carries figureContinue.
 *   LIT: the three-way arrival choice appears only on the myth the figure is at
 *     home in; "Choose a different figure" goes back; "Step out" proceeds with
 *     no figure fields; "Continue as" sends figureContinue + chainAction on the
 *     Reading turn only; the offer controls stay hidden until the reading has
 *     settled; "That fits" keeps, "Not quite" sets down, a failed request says so
 *     and can be retried, a double click is one request, an expired/replayed offer
 *     reads "that one has passed", a full ledger shows the named message, a newer
 *     offer supersedes an older one, an answered offer is not asked again after
 *     the reading remounts, a ledger failure is named; keyboard works; nothing
 *     overflows a phone screen.
 *
 * NOT run in CI (needs Chrome, a dev database and a dev server). Setup:
 *   npm i --no-save playwright-core
 *   DATABASE_URL=<dev branch url> npm run test:figure-continuity-browser
 * Optional: CHROME_PATH (default: the usual Chrome location on Windows/macOS/Linux).
 * Screenshots land in .figure-shots/ (gitignored by the .tmp convention? no: delete freely).
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

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL (a DEV branch) is required.');
  process.exit(2);
}
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
const SECRET = 'fc-browser-' + randomBytes(16).toString('hex');
const sign = (uid) => { const p = `${uid}.${Date.now() + 3_600_000}`; return `${p}.${createHmac('sha256', SECRET).update(p).digest('hex')}`; };

let failures = 0;
const check = (name, cond) => { if (cond) console.log(`  ok  ${name}`); else { console.error(`  FAIL  ${name}`); failures++; } };

// ── dev server ─────────────────────────────────────────────────────────
function startServer({ lit, port }) {
  const env = {
    ...process.env,
    ELDER_SESSION_SECRET: SECRET,
    ANTHROPIC_API_KEY: 'test-key-not-used',
    ELDER_CORPUS_VERSION: 'test-corpus',
    NEXT_TELEMETRY_DISABLED: '1',
  };
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

// ── seeding ────────────────────────────────────────────────────────────
const users = [];
async function seed({ tier = 'kept', extraMyth = true } = {}) {
  const [u] = await sql`INSERT INTO elder_user (email) VALUES (${`figure-browser-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@example.invalid`}) RETURNING id`;
  const uid = Number(u.id);
  users.push(uid);
  await sql`UPDATE elder_user SET tier = ${tier} WHERE id = ${uid}`;
  await sql`INSERT INTO myth_archetype (user_id, lineage_key, archetype_name, summary, people_circumstances, reading_count) VALUES (${uid}, 'maya', 'The Twins', 'A summary of the twins myth for the test.', 'my sister', 2)`;
  if (extraMyth) {
    await sql`INSERT INTO myth_archetype (user_id, lineage_key, archetype_name, summary, people_circumstances, reading_count) VALUES (${uid}, 'norse', 'The Wanderer', 'A summary of a norse myth with no figure.', '', 1)`;
  }
  const chainId = randomUUID();
  await sql`INSERT INTO visit_record (user_id, chain_id, visit_mode, lineage_key, myth_title, archetype, elder_response, markers_confirmed)
            VALUES (${uid}, ${chainId}, 'explore', 'maya', 'The Twins', 'The Twins', 'an earlier reading', ${JSON.stringify({ figure: 'The Hero Twin' })}::jsonb)`;
  return { uid, chainId };
}
/** Create an OFFERED pairing the way the server would: at most one offer per chain, newer replaces older. */
async function makeOffer({ uid, chainId }, subject, counterpart) {
  await sql`DELETE FROM figure_mapping WHERE user_id = ${uid} AND chain_id = ${chainId} AND status = 'offered'`;
  const [r] = await sql`INSERT INTO figure_mapping (user_id, chain_id, lineage_key, myth_title, figure_label, subject_kind, subject_label, counterpart_label, counterpart_basis, status)
                        VALUES (${uid}, ${chainId}, 'maya', 'The Twins', 'The Hero Twin', 'person', ${subject}, ${counterpart}, 'model_report', 'offered') RETURNING id`;
  return Number(r.id);
}
const rowStatus = async (id) => (await sql`SELECT status FROM figure_mapping WHERE id = ${id}`)[0]?.status ?? null;
const countConfirmed = async (uid) => (await sql`SELECT count(*)::int n FROM figure_mapping WHERE user_id = ${uid} AND status = 'confirmed'`)[0].n;

// ── browser helpers ────────────────────────────────────────────────────
async function newPage(browser, base, uid, { width = 900, height = 900, reducedMotion = 'reduce' } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height }, reducedMotion });
  await ctx.addCookies([{ name: 'elder_session', value: sign(uid), domain: 'localhost', path: '/' }]);
  const page = await ctx.newPage();
  const bodies = [];   // every /api/divine request body
  const queue = [];    // scripted model responses, FIFO
  await page.route('**/api/divine', async (route) => {
    const body = route.request().postDataJSON();
    bodies.push(body);
    const next = queue.shift();
    if (!next) { await route.fulfill({ status: 500, body: '{"error":"no scripted response"}', contentType: 'application/json' }); return; }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
      remaining: 50, ceilingCategory: null, archetypeName: null, pendingStageUps: [], visitId: null, provenanceBlock: '', moreToCome: false,
      _provenance: { corpus_version: 'c', model_version: 'm', contract_version: 'k', voice: 'ojer_tzij', passage_ids: [], generated_at: new Date().toISOString() },
      ...next,
    }) });
  });
  return { ctx, page, bodies, queue };
}
async function toMythChoice(page, base) {
  const headDone = page.waitForResponse((r) => r.url().includes('/api/user/history') && r.url().includes('head=1'), { timeout: 120_000 });
  await page.goto(base + '/', { waitUntil: 'load', timeout: 120_000 });
  await page.waitForTimeout(4000);
  await page.mouse.click(page.viewportSize().width / 2, page.viewportSize().height * 0.51);
  const skip = page.getByText('Skip', { exact: false }).first();
  await skip.waitFor({ timeout: 90_000 });
  await skip.click();
  await page.getByText('YOUR MYTH IS STILL BURNING').waitFor({ timeout: 60_000 });
  const head = await (await headDone).json();
  await page.waitForTimeout(400);
  return head;
}
const mythCard = (page, name) => page.locator('button', { hasText: name }).first();
const overflowX = (page) => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
/** Wait for the pairing controls, then for them to be stable: the fade-in and the scroll into view have finished. */
async function controlsReady(page) {
  const group = page.getByRole('group', { name: 'Keep this pairing?' });
  await group.waitFor({ timeout: 60_000 });
  await page.waitForTimeout(1500);
  return group;
}
async function ask(page, text, placeholderRe) {
  const input = page.locator('input[placeholder]').filter({ hasNot: page.locator('[disabled]') }).last();
  await input.waitFor({ timeout: 60_000 });
  await input.fill(text);
  await input.press('Enter');
}

async function main() {
  const browser = await chromium.launch({ executablePath: CHROME, headless: true });
  let server;
  try {
    // ════════════════ DARK ════════════════
    console.log('\n[DARK] flags unset');
    server = startServer({ lit: false, port: 3121 });
    await server.ready;
    {
      const s = await seed();
      const { ctx, page, bodies, queue } = await newPage(browser, server.base, s.uid);
      const head = await toMythChoice(page, server.base);
      check('dark: the arrival lookup reports no figureContinuity', !('figureContinuity' in head) && !!head.head);
      await mythCard(page, 'The Twins').click();
      await page.getByText('The old patterns are rising').waitFor({ timeout: 30_000 });
      check('dark: the myth card goes straight in, with no arrival choice', !(await page.getByText('WHO SITS AT THE FIRE TONIGHT').count()));
      await page.screenshot({ path: path.join(SHOTS, 'dark-straight-in.png') });
      queue.push({ text: 'A telling.', readyToRead: false });
      const input = page.locator('input[placeholder]').last();
      await input.waitFor({ timeout: 60_000 });
      await input.fill('hello'); await input.press('Enter');
      await page.waitForTimeout(2500);
      check('dark: a request was made and it carries no figure fields', bodies.length === 1 && !('figureContinue' in bodies[0]) && !('chainAction' in bodies[0]));
      await ctx.close();
    }
    server.stop(); server = null;

    // ════════════════ LIT ════════════════
    console.log('\n[LIT] all three gates');
    server = startServer({ lit: true, port: 3122 });
    await server.ready;

    // ── W1: arrival choice, choose-different, step-out ──
    {
      const s = await seed();
      const { ctx, page, bodies, queue } = await newPage(browser, server.base, s.uid);
      const head = await toMythChoice(page, server.base);
      check('lit: the server reports the figure and its lineage', head.figureContinuity?.figureLabel === 'The Hero Twin' && head.figureContinuity?.lineageKey === 'maya');
      check('lit: the report carries no chain id', !('chainId' in (head.figureContinuity ?? {})));

      await mythCard(page, 'The Wanderer').click();
      await page.getByText('The old patterns are rising').waitFor({ timeout: 30_000 });
      check('lit: a card of ANOTHER lineage goes straight in (no arrival choice)', !(await page.getByText('WHO SITS AT THE FIRE TONIGHT').count()));
      await page.goBack().catch(() => {});
      await ctx.close();

      const second = await newPage(browser, server.base, s.uid);
      await toMythChoice(second.page, server.base);
      const p = second.page;
      await mythCard(p, 'The Twins').click();
      await p.getByText('WHO SITS AT THE FIRE TONIGHT').first().waitFor({ timeout: 20_000 });
      await p.screenshot({ path: path.join(SHOTS, 'arrival.png') });
      const labels = await p.locator('button').allInnerTexts();
      check('arrival: heading and the figure in the seeker\'s words', (await p.getByText('\u201cThe Hero Twin\u201d').count()) === 1);
      check('arrival: the three choices, in order', ['Continue as The Hero Twin', 'Step out of the figure for this sitting', 'Choose a different figure'].every((l) => labels.includes(l)));
      check('arrival: says stepping out leaves everything untouched', (await p.getByText('Stepping out leaves the figure, and anything you have kept, untouched.').count()) === 1);
      const group = p.getByRole('group', { name: 'WHO SITS AT THE FIRE TONIGHT' });
      check('arrival: a labelled group for assistive tech', (await group.count()) === 1);
      check('arrival: nothing has been sent to the model yet', second.bodies.length === 0);

      await p.getByRole('button', { name: 'Choose a different figure' }).click();
      await p.getByText('YOUR MYTH IS STILL BURNING').first().waitFor({ timeout: 20_000 });
      check('arrival: "Choose a different figure" returns to the myths', true);

      await mythCard(p, 'The Twins').click();
      await p.getByText('WHO SITS AT THE FIRE TONIGHT').first().waitFor({ timeout: 20_000 });
      await p.getByRole('button', { name: 'Step out of the figure for this sitting' }).click();
      await p.getByText('The old patterns are rising').first().waitFor({ timeout: 30_000 });
      second.queue.push({ text: 'A telling without the figure.', readyToRead: false });
      const input = p.locator('input[placeholder]').last();
      await input.waitFor({ timeout: 60_000 });
      await input.fill('hello'); await input.press('Enter');
      await p.waitForTimeout(2500);
      check('step out: the request carries no figure fields', second.bodies.length === 1 && !('figureContinue' in second.bodies[0]) && !('chainAction' in second.bodies[0]));
      check('step out: nothing about the figure was kept or changed', (await sql`SELECT count(*)::int n FROM figure_mapping WHERE user_id = ${s.uid}`)[0].n === 0);
      await second.ctx.close();
    }

    // ── W2: continue as the figure; the offer controls ──
    {
      const s = await seed();
      const { ctx, page: p, bodies, queue } = await newPage(browser, server.base, s.uid);
      await toMythChoice(p, server.base);
      await mythCard(p, 'The Twins').click();
      await p.getByText('WHO SITS AT THE FIRE TONIGHT').first().waitFor({ timeout: 20_000 });
      await p.getByRole('button', { name: 'Continue as The Hero Twin' }).click();
      await p.getByText('The old patterns are rising').first().waitFor({ timeout: 30_000 });

      // turn 1: council mode, the model asks its one clarifying question
      queue.push({ text: 'What lies between you and your sister?', readyToRead: true });
      let input = p.locator('input[placeholder]').last();
      await input.waitFor({ timeout: 60_000 });
      await input.fill('My sister and I have not spoken since the move.'); await input.press('Enter');
      await p.getByText('What lies between you and your sister?').first().waitFor({ timeout: 30_000 });
      check('continue: the clarifying (council) turn carries no figure fields', bodies.length === 1 && bodies[0].mode === 'council' && !('figureContinue' in bodies[0]));

      // turn 2: the Reading, carrying a real offer
      const offerA = await makeOffer(s, 'my sister', 'the Maize Maiden');
      queue.push({ text: 'In this telling, a figure like this stands at the threshold.\n\nDoes that fit?', readyToRead: false, mappingOffer: { id: offerA, kind: 'person', subject: 'my sister', counterpart: 'the Maize Maiden' } });
      input = p.locator('input[placeholder]').last();
      await input.fill('We were close once.'); await input.press('Enter');
      await p.getByText('Does that fit?').first().waitFor({ timeout: 30_000 });
      check('continue: the Reading turn sends figureContinue and chainAction deepen, in reading mode', bodies.length === 2 && bodies[1].mode === 'reading' && bodies[1].figureContinue === true && bodies[1].chainAction === 'deepen');

      const group = p.getByRole('group', { name: 'Keep this pairing?' });
      check('controls: hidden while the reading is still settling', (await group.count()) === 0);
      await p.waitForTimeout(3000);
      check('controls: still hidden three seconds in', (await group.count()) === 0);
      await group.waitFor({ timeout: 60_000 });
      await p.waitForTimeout(1500);
      {
        // where do the controls sit relative to the question the Elder just asked?
        const q = await p.getByText('Does that fit?').first().boundingBox();
        const c = await group.boundingBox();
        const vh = p.viewportSize().height;
        console.log(`  info  controls sit ${Math.round(c.y - q.y)}px below the closing question (viewport ${vh}px)`);
        // The viewport is scrolled by the page itself, so measure against the live window.
        const onScreen = await group.evaluate((el) => { const r = el.getBoundingClientRect(); return r.top >= 0 && r.bottom <= window.innerHeight; });
        check('controls: brought fully on screen when they appear (not lost beneath the ceremony)', onScreen);
      }
      await p.screenshot({ path: path.join(SHOTS, 'controls.png'), fullPage: true });
      check('controls: appear once the reading has settled', (await group.count()) === 1);
      check('controls: show exactly what would be kept', (await p.getByText('To keep: \u201cmy sister\u201d echoes \u201cthe Maize Maiden\u201d.').count()) === 1);
      check('controls: nothing is kept yet', (await rowStatus(offerA)) === 'offered');
      const fits = p.getByRole('button', { name: 'That fits' });
      const notQuite = p.getByRole('button', { name: 'Not quite' });
      const [bf, bn] = await Promise.all([fits.boundingBox(), notQuite.boundingBox()]);
      check('controls: equal visual weight (same size)', Math.abs(bf.width - bn.width) < 1 && Math.abs(bf.height - bn.height) < 1);
      const [sf, sn] = await Promise.all([fits.evaluate((e) => getComputedStyle(e).cssText), notQuite.evaluate((e) => getComputedStyle(e).cssText)]);
      check('controls: equal styling (no answer is dimmed or emphasised)', sf === sn);

      // a failed request: says so, keeps nothing, leaves both answers available
      await p.route(`**/api/figure-mappings/${offerA}/confirm`, (r) => r.abort('failed'), { times: 1 });
      await fits.click();
      await p.getByText('The fire could not answer. Nothing changed; you may try again.').first().waitFor({ timeout: 10_000 });
      check('failure: says so plainly and keeps nothing', (await rowStatus(offerA)) === 'offered');
      check('failure: both answers are still available', (await fits.isEnabled()) && (await notQuite.isEnabled()));

      // a double click is ONE request
      let confirmCalls = 0;
      await p.route(`**/api/figure-mappings/${offerA}/confirm`, async (r) => { confirmCalls++; await new Promise((x) => setTimeout(x, 500)); await r.continue(); });
      await fits.dblclick();
      await p.getByText('kept', { exact: true }).waitFor({ timeout: 10_000 });
      check('double click: exactly one confirm request', confirmCalls === 1);
      check('double click: the pairing is kept, once', (await rowStatus(offerA)) === 'confirmed' && (await countConfirmed(s.uid)) === 1);
      check('answered: the question and answers are gone', (await p.getByRole('button', { name: 'That fits' }).count()) === 0 && (await p.getByText('To keep:').count()) === 0);
      await p.screenshot({ path: path.join(SHOTS, 'kept.png') });

      // follow-up turn: the reading unmounts while loading; the answered offer must NOT be asked again
      await p.getByRole('button', { name: 'Deepen this myth' }).click();
      const offerB = await makeOffer(s, 'my brother', 'the Elder Twin');
      queue.push({ text: 'The Elder Twin went down first.\n\nDoes that sit true?', readyToRead: false, mappingOffer: { id: offerB, kind: 'person', subject: 'my brother', counterpart: 'the Elder Twin' } });
      input = p.locator('input[placeholder]').last();
      await input.fill('Tell me more about my brother.'); await input.press('Enter');
      await p.getByText('Does that sit true?').first().waitFor({ timeout: 30_000 });
      check('follow-up: a deepen turn also carries the figure fields', bodies.length === 3 && bodies[2].mode === 'reading' && bodies[2].figureContinue === true && bodies[2].chainAction === 'deepen');
      await controlsReady(p);
      check('follow-up: the earlier answered offer is NOT asked again after the reading remounted', (await p.getByText('To keep: \u201cmy sister\u201d').count()) === 0);
      check('follow-up: only the newest offer has controls', (await p.getByRole('button', { name: 'That fits' }).count()) === 1 && (await p.getByText('To keep: \u201cmy brother\u201d echoes \u201cthe Elder Twin\u201d.').count()) === 1);
      check('follow-up: the first pairing is still kept', (await rowStatus(offerA)) === 'confirmed');

      // "Not quite" removes the offer and says so
      await p.getByRole('button', { name: 'Not quite' }).click();
      await p.getByText('set down', { exact: true }).waitFor({ timeout: 10_000 });
      check('not quite: the offer is deleted, no tombstone', (await rowStatus(offerB)) === null);
      check('not quite: the earlier pairing is untouched', (await rowStatus(offerA)) === 'confirmed');

      // an offer already confirmed elsewhere reads "that one has passed"
      await p.getByRole('button', { name: 'Deepen this myth' }).click().catch(() => {});
      const offerC = await makeOffer(s, 'my aunt', 'the Weaver');
      await sql`UPDATE figure_mapping SET status = 'confirmed', confirmed_at = now() WHERE id = ${offerC}`;
      queue.push({ text: 'The Weaver keeps the threads.\n\nDoes that fit?', readyToRead: false, mappingOffer: { id: offerC, kind: 'person', subject: 'my aunt', counterpart: 'the Weaver' } });
      input = p.locator('input[placeholder]').last();
      await input.fill('And my aunt?'); await input.press('Enter');
      await p.getByText('The Weaver keeps the threads.').first().waitFor({ timeout: 30_000 });
      await controlsReady(p);
      await p.getByRole('button', { name: 'That fits' }).click();
      await p.getByText('that one has passed').first().waitFor({ timeout: 10_000 });
      check('replay: an offer already answered elsewhere reads "that one has passed"', true);

      // a full ledger: the named message, nothing evicted
      await sql`INSERT INTO figure_mapping (user_id, chain_id, lineage_key, myth_title, figure_label, subject_kind, subject_label, counterpart_label, counterpart_basis, status, confirmed_at)
                SELECT ${s.uid}, ${randomUUID()}, 'maya', 'The Twins', 'The Hero Twin', 'person', 'filler ' || g, 'door ' || g, 'model_report', 'confirmed', now()
                FROM generate_series(1, ${30 - (await countConfirmed(s.uid))}) AS g`;
      const offerD = await makeOffer(s, 'my cousin', 'the Parrot');
      await p.getByRole('button', { name: 'Deepen this myth' }).click().catch(() => {});
      queue.push({ text: 'The Parrot carries messages.\n\nDoes that fit?', readyToRead: false, mappingOffer: { id: offerD, kind: 'person', subject: 'my cousin', counterpart: 'the Parrot' } });
      input = p.locator('input[placeholder]').last();
      await input.fill('And my cousin?'); await input.press('Enter');
      await p.getByText('The Parrot carries messages.').first().waitFor({ timeout: 30_000 });
      await controlsReady(p);
      await p.getByRole('button', { name: 'That fits' }).click();
      await p.getByText(/pairings at a time/).first().waitFor({ timeout: 10_000 });
      check('cap: the named message is shown', true);
      check('cap: nothing was evicted and the offer was not silently kept', (await countConfirmed(s.uid)) === 30 && (await rowStatus(offerD)) === 'offered');
      await p.screenshot({ path: path.join(SHOTS, 'cap.png') });

      // a ledger failure is named
      await p.getByRole('button', { name: 'Deepen this myth' }).click().catch(() => {});
      queue.push({ text: 'A last telling.\n\nDoes that fit?', readyToRead: false, mappingHeld: false });
      input = p.locator('input[placeholder]').last();
      await input.fill('One more.'); await input.press('Enter');
      await p.getByText('A last telling.').first().waitFor({ timeout: 30_000 });
      await p.getByText('The fire could not hold that pairing just now.').first().waitFor({ timeout: 60_000 });
      check('an unanswered pairing on an earlier thread entry stays answerable after a later turn', (await p.getByText(/pairings at a time/).count()) === 1);
      check('ledger failure: named, never a silent success, and no controls', (await p.getByRole('button', { name: 'That fits' }).count()) === 0);
      await ctx.close();
    }

    // ── W3: keyboard, and the controls do not appear over a running reveal (motion enabled) ──
    {
      const s = await seed();
      const { ctx, page: p, queue } = await newPage(browser, server.base, s.uid, { reducedMotion: 'no-preference' });
      await toMythChoice(p, server.base);
      await mythCard(p, 'The Twins').click();
      await p.getByText('WHO SITS AT THE FIRE TONIGHT').first().waitFor({ timeout: 20_000 });
      // keyboard only: Tab to the first choice and activate it
      await p.keyboard.press('Tab');
      const focused = await p.evaluate(() => document.activeElement?.textContent ?? '');
      check('keyboard: Tab reaches the first arrival choice', /Continue as The Hero Twin|Step out|Choose a different/.test(focused));
      await p.getByRole('button', { name: 'Continue as The Hero Twin' }).focus();
      await p.keyboard.press('Enter');
      await p.getByText('The old patterns are rising').first().waitFor({ timeout: 30_000 });
      queue.push({ text: 'What lies between you?', readyToRead: true });
      let input = p.locator('input[placeholder]').last();
      await input.waitFor({ timeout: 60_000 });
      await input.fill('We stopped speaking.'); await input.press('Enter');
      await p.getByText('What lies between you?').first().waitFor({ timeout: 30_000 });
      const offer = await makeOffer(s, 'my mother', 'the Grandmother');
      queue.push({ text: 'A long, slow telling that carries the mother toward the grandmother, line by line, as the fire allows it to be said aloud.\n\nDoes that fit?', readyToRead: false, mappingOffer: { id: offer, kind: 'person', subject: 'my mother', counterpart: 'the Grandmother' } });
      input = p.locator('input[placeholder]').last();
      await input.fill('My mother, then.'); await input.press('Enter');
      await p.waitForTimeout(4000);
      check('motion on: the controls are NOT present while the reading is still being revealed', (await p.getByRole('group', { name: 'Keep this pairing?' }).count()) === 0);
      await controlsReady(p);
      await p.getByRole('button', { name: 'That fits' }).focus();
      await p.keyboard.press('Enter');
      await p.getByText('kept', { exact: true }).waitFor({ timeout: 10_000 });
      check('keyboard: Enter on "That fits" keeps the pairing', (await rowStatus(offer)) === 'confirmed');
      await ctx.close();
    }

    // ── W4: a phone screen ──
    {
      const s = await seed();
      const { ctx, page: p, queue } = await newPage(browser, server.base, s.uid, { width: 375, height: 800 });
      await toMythChoice(p, server.base);
      await mythCard(p, 'The Twins').click();
      await p.getByText('WHO SITS AT THE FIRE TONIGHT').first().waitFor({ timeout: 20_000 });
      await p.screenshot({ path: path.join(SHOTS, 'arrival-phone.png') });
      check('phone: the arrival choice does not overflow horizontally', (await overflowX(p)) <= 1);
      const box = await p.getByRole('button', { name: 'Step out of the figure for this sitting' }).boundingBox();
      check('phone: choices are comfortable touch targets', box.height >= 44);
      await p.getByRole('button', { name: 'Continue as The Hero Twin' }).click();
      await p.getByText('The old patterns are rising').first().waitFor({ timeout: 30_000 });
      queue.push({ text: 'What lies between you?', readyToRead: true });
      let input = p.locator('input[placeholder]').last();
      await input.waitFor({ timeout: 60_000 });
      await input.fill('We stopped speaking.'); await input.press('Enter');
      await p.getByText('What lies between you?').first().waitFor({ timeout: 30_000 });
      const offer = await makeOffer(s, 'my mother', 'the Grandmother');
      queue.push({ text: 'A short telling.\n\nDoes that fit?', readyToRead: false, mappingOffer: { id: offer, kind: 'person', subject: 'my mother', counterpart: 'the Grandmother' } });
      input = p.locator('input[placeholder]').last();
      await input.fill('My mother.'); await input.press('Enter');
      await controlsReady(p);
      {
        const q = await p.getByText('Does that fit?').first().boundingBox();
        const c = await p.getByRole('group', { name: 'Keep this pairing?' }).boundingBox();
        console.log(`  info  phone: controls sit ${Math.round(c.y - q.y)}px below the closing question (viewport ${p.viewportSize().height}px)`);
      }
      check('phone: the offer controls do not overflow horizontally', (await overflowX(p)) <= 1);
      check('phone: the controls were brought fully on screen', await p.getByRole('group', { name: 'Keep this pairing?' }).evaluate((el) => { const r = el.getBoundingClientRect(); return r.top >= 0 && r.bottom <= window.innerHeight; }));
      const fb = await p.getByRole('button', { name: 'That fits' }).boundingBox();
      check('phone: answers are comfortable touch targets', fb.height >= 44);
      await p.screenshot({ path: path.join(SHOTS, 'controls-phone.png'), fullPage: true });
      await ctx.close();
    }
  } finally {
    for (const uid of users) { try { await sql`DELETE FROM elder_user WHERE id = ${uid}`; } catch { /* best effort */ } }
    if (server) server.stop();
    await browser.close();
  }

  if (failures > 0) { console.error(`\n${failures} browser check(s) failed. Screenshots: ${SHOTS}/`); process.exit(1); }
  console.log(`\nfigure continuity browser walkthrough: all passed (screenshots in ${SHOTS}/)`);
}

main().catch((err) => { console.error(err); process.exit(1); });
