/**
 * Drives the marketing site in real Chromium: confirms it dogfoods the library
 * (the real banner renders on load), the inline Adobe-call inspector reflects
 * real calls, the region resolver computes payloads from the real engine, the
 * CTAs work, and nothing errors. Serves site/ over a throwaway static server.
 */
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { extname, join, normalize, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'site');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8' };

const server = createServer(async (req, res) => {
  const url = new URL(req.url || '/', 'http://localhost');
  const pathname = url.pathname === '/' ? '/index.html' : decodeURIComponent(url.pathname);
  const target = join(root, normalize(pathname).replace(/^(\.\.[/\\])+/, ''));
  const info = await stat(target).catch(() => null);
  if (!info?.isFile()) { res.writeHead(404).end('not found'); return; }
  res.writeHead(200, { 'Content-Type': TYPES[extname(target)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
  res.end(await readFile(target));
});
await new Promise((r) => server.listen(0, r));
const base = `http://localhost:${server.address().port}/`;

const results = [];
const check = (name, pass, detail = '') => { results.push({ name, pass, detail }); console.log(`${pass ? '  PASS' : '  FAIL'}  ${name}${detail ? '  — ' + detail : ''}`); };

const pinned = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium';
const browser = await chromium.launch(existsSync(pinned) ? { executablePath: pinned } : {});
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

await page.goto(base, { waitUntil: 'networkidle' });
await page.waitForTimeout(700);

check('page title is set', (await page.title()).includes('ClearConsent'));

// --- dogfooding: the real banner is on the page ---
const dialog = page.locator('#clearconsent-root [role="dialog"]');
check('the site renders its own consent banner on load', await dialog.isVisible().catch(() => false));
check('banner uses the site-configured heading',
  (await dialog.locator('h2.title').textContent().catch(() => '')) === 'Your privacy, your call');

// --- live inspector: driving consent via the inline buttons logs Adobe calls ---
await page.locator('#acAccept').click();
await page.waitForTimeout(400);

const decided = await page.evaluate(() => window.ClearConsent.instance.state?.method);
check('inspector "Accept all" records accept_all', decided === 'accept_all', String(decided));

const chipsOn = await page.locator('#liveChips .chip.on').count();
check('consent chips reflect all-granted', chipsOn === 4, chipsOn + ' on');

const logText = await page.locator('#callLog').innerText();
check('inspector logged a setConsent call', /setConsent/.test(logText));
check('inspector logged the ECID Opt-In complete', /adobe\.optIn/.test(logText) && /approved/.test(logText));
check('inspector logged a data layer push', /adobeDataLayer/.test(logText));
check('inspector logged a _satellite direct call', /_satellite/.test(logText));
check('setConsent shows collect granted after accept', /collect:y/.test(logText), logText.match(/setConsent[^\n]*/)?.[0] || '');

// --- reject via inspector flips it back ---
await page.locator('#acReject').click();
await page.waitForTimeout(400);
const logText2 = await page.locator('#callLog').innerText();
check('reject re-asserts collect denied to alloy', /collect:n/.test(logText2));
check('reject aborts AppMeasurement', /s\.abort = true/.test(logText2));

// --- region resolver: real engine computes per-region payloads ---
check('region resolver defaults to opt-in for Germany',
  /Opt-in/.test(await page.locator('#rrModel').innerText()));
const dePayload = await page.locator('#rrPayload').innerText();
check('Germany resolves to collect:n before any choice', /collect[^\n]*"n"/.test(dePayload), dePayload.split('\n').find((l) => /collect/.test(l)) || '');

await page.locator('#regionSwitch button[data-region="US-CA"]').click();
await page.waitForTimeout(250);
const caModel = await page.locator('#rrModel').innerText();
check('California resolves to opt-out', /Opt-out/.test(caModel), caModel);
const caPayload = await page.locator('#rrPayload').innerText();
check('California grants collect by default (opt-out)', /collect[^\n]*"y"/.test(caPayload), caPayload.split('\n').find((l) => /collect/.test(l)) || '');

const caChipsOn = await page.locator('#rrChips .chip.on').count();
check('California pre-grants categories (opt-out defaults)', caChipsOn >= 2, caChipsOn + ' on');

// --- load-chain race animates when scrolled into view ---
await page.locator('#onetrust').scrollIntoViewIfNeeded();
await page.waitForTimeout(2600);
const raced = await page.evaluate(() => {
  const fills = document.querySelectorAll('#race .lane.ours .bar .fill');
  return fills.length ? getComputedStyle(fills[0]).width : '0px';
});
check('OneTrust race animation ran (ours fills to full width)', parseFloat(raced) > 200, raced);

// --- footer preference center + tabs ---
await page.locator('#footerPrefs').click();
await page.waitForTimeout(300);
check('footer link opens the preference center', await dialog.isVisible().catch(() => false));
await page.keyboard.press('Escape');
await page.waitForTimeout(200);

await page.locator('.install-tabs button', { hasText: 'npm' }).click();
await page.waitForTimeout(150);
check('install tab switches to the npm panel', (await page.locator('#p-npm.active').count()) === 1);

// --- layout integrity ---
check('no horizontal page overflow',
  await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
await page.setViewportSize({ width: 390, height: 844 });
await page.waitForTimeout(200);
check('no horizontal overflow on mobile',
  await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
await page.setViewportSize({ width: 1280, height: 900 });

await page.evaluate(() => window.scrollTo(0, 0));
await page.waitForTimeout(200);
await page.screenshot({ path: 'site/screenshot-hero.png' });
await page.screenshot({ path: 'site/screenshot-full.png', fullPage: true });

const realErrors = errors.filter((e) => !/favicon/i.test(e) && !/404/.test(e));
check('no uncaught errors', realErrors.length === 0, realErrors.slice(0, 3).join(' | '));

await browser.close();
server.close();

const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} site checks passed`);
if (failed.length) process.exit(1);
