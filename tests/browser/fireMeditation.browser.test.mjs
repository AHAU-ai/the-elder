/**
 * fireMeditation.browser.test.mjs -- the Fire Meditation (/fire-meditation), the
 * wordless room beside the Fireside Chat, and the doors to it, in a REAL
 * browser against a real `next dev` server. No database is needed.
 *
 * Proves, in a browser:
 *   - the room shows no words at all (no letters in its visible text), no timer
 *     and no counter, and the language control steps aside there but is present
 *     on the front page;
 *   - the way out is a quiet glyph, named for assistive tech, and Escape does
 *     the same: both return to the front room (/);
 *   - the screen wake lock is requested, and is taken back after the browser
 *     releases it (a stubbed Wake Lock API, so it runs headless);
 *   - the wordless calm door reaches the room from the front room (the age
 *     beat that follows the reception), with no visible text of its own.
 *
 * NOT run in CI (needs Chrome and a dev server). Setup:
 *   npm i --no-save playwright-core
 *   npm run test:fire-meditation-browser
 */
import { spawn, execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

let chromium;
try {
  ({ chromium } = await import('playwright-core'));
} catch {
  console.error('playwright-core is not installed. Run: npm i --no-save playwright-core');
  process.exit(2);
}

const CHROME = process.env.CHROME_PATH || [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
].find((p) => fs.existsSync(p));
if (!CHROME) { console.error('No Chrome found. Set CHROME_PATH.'); process.exit(2); }

let failures = 0;
const check = (name, cond) => { if (cond) console.log(`  ok  ${name}`); else { console.error(`  FAIL  ${name}`); failures++; } };

function startServer(port) {
  const env = { ...process.env, ANTHROPIC_API_KEY: 'test-key-not-used', ELDER_SESSION_SECRET: 'fire-meditation-browser-test', ELDER_CORPUS_VERSION: 'test-corpus', NEXT_TELEMETRY_DISABLED: '1' };
  const child = spawn(process.execPath, [path.join('node_modules', 'next', 'dist', 'bin', 'next'), 'dev', '-p', String(port)], { env, stdio: ['ignore', 'pipe', 'pipe'], detached: process.platform !== 'win32' });
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

// A stand-in Wake Lock API that records requests and lets the test release a lock.
const WAKE_LOCK_STUB = () => {
  window.__wake = { requests: 0, sentinels: [] };
  Object.defineProperty(navigator, 'wakeLock', {
    configurable: true,
    value: {
      request: async () => {
        window.__wake.requests++;
        const listeners = [];
        const s = { released: false, release: async () => { s.released = true; }, addEventListener: (_t, l) => listeners.push(l), _fire: () => { s.released = true; listeners.forEach((l) => l()); } };
        window.__wake.sentinels.push(s);
        return s;
      },
    },
  });
};

const server = startServer(3197);
let browser;
try {
  await server.ready;
  browser = await chromium.launch({ executablePath: CHROME, headless: true });
  const ctx = await browser.newContext({ viewport: { width: 900, height: 900 }, reducedMotion: 'reduce' });
  await ctx.addInitScript(WAKE_LOCK_STUB);
  const page = await ctx.newPage();

  // ---- the room itself
  console.log('the room');
  await page.goto(server.base + '/fire-meditation', { waitUntil: 'load', timeout: 120_000 });
  await page.waitForTimeout(2500);
  const visible = await page.evaluate(() => document.body.innerText);
  check('no words in the visible text', !/\p{L}/u.test(visible));
  check('no digits (no timer, no counter)', !/\d/.test(visible));
  check('the language control steps aside', (await page.locator('.elder-lang').count()) === 0);
  const glyph = page.locator('main a[href="/"]');
  check('one quiet glyph is the way out', (await glyph.count()) === 1);
  check('the glyph is named for assistive tech', ((await glyph.getAttribute('aria-label')) || '').length > 0);

  // ---- the wake lock
  console.log('the wake lock');
  check('the screen wake lock is requested', (await page.evaluate(() => window.__wake.requests)) >= 1);
  const before = await page.evaluate(() => window.__wake.requests);
  await page.evaluate(() => window.__wake.sentinels[window.__wake.sentinels.length - 1]._fire());
  await page.waitForTimeout(300);
  check('a lock the browser releases is taken back', (await page.evaluate(() => window.__wake.requests)) === before + 1);

  // ---- the way out
  console.log('the way out');
  await glyph.click();
  await page.waitForURL(server.base + '/', { timeout: 30_000 });
  check('the glyph returns to the front room', true);
  await page.goto(server.base + '/fire-meditation', { waitUntil: 'load', timeout: 60_000 });
  await page.waitForTimeout(1500);
  await page.keyboard.press('Escape');
  await page.waitForURL(server.base + '/', { timeout: 30_000 });
  check('Escape returns to the front room', true);

  // ---- the language control is present elsewhere
  await page.waitForTimeout(2000);
  check('the language control is present on the front page', (await page.locator('.elder-lang').count()) === 1);

  // ---- the door from the front room
  console.log('the door from the front room');
  await page.goto(server.base + '/', { waitUntil: 'load', timeout: 120_000 });
  await page.waitForTimeout(4000);
  await page.mouse.click(900 / 2, 900 * 0.51);
  const skip = page.getByText('Skip', { exact: false }).first();
  await skip.waitFor({ timeout: 90_000 });
  await skip.click();
  const door = page.locator('a.ember-door');
  await door.waitFor({ timeout: 30_000 });
  check('a calm door is at the front room', (await door.count()) === 1);
  check('the door carries no visible text', ((await door.innerText()) || '').trim() === '');
  check('the door is named for assistive tech', ((await door.getAttribute('aria-label')) || '').length > 0);
  await door.click();
  await page.waitForURL(server.base + '/fire-meditation', { timeout: 30_000 });
  check('the door opens the Fire Meditation', true);
} catch (e) {
  console.error(e);
  failures++;
} finally {
  await browser?.close();
  server.stop();
}

if (failures) { console.error(`\n${failures} check(s) FAILED`); process.exit(1); }
console.log('\nfireMeditation browser: ok');
