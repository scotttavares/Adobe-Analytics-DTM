/**
 * Drives the marketing site in real Chromium: confirms it dogfoods the library
 * (the real banner renders on load), the CTAs re-launch it, the install tabs
 * switch, and nothing errors. Serves site/ over a throwaway static server.
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

check('page title is set', (await page.title()).includes('adobe-consent'));

// Dogfooding: the real banner should be on the page from load.
const dialog = page.locator('#adobe-consent-root [role="dialog"]');
check('the site renders its own consent banner on load', await dialog.isVisible().catch(() => false));
check('banner uses the site-configured heading',
  (await dialog.locator('h2.title').textContent().catch(() => '')) === 'Your privacy, your call');
check('all four categories present in the banner',
  (await dialog.locator('input[type="checkbox"]').count()) === 4);

// Accept, then prove it dismissed and left a decision.
await dialog.locator('button.action', { hasText: 'Accept all' }).click();
await page.waitForTimeout(400);
check('banner dismisses after a choice', !(await dialog.isVisible().catch(() => true)));
const decided = await page.evaluate(() => window.AdobeConsent.instance.state?.method);
check('decision recorded as accept_all', decided === 'accept_all', String(decided));

// "Launch the banner" hero CTA resets and re-shows it.
await page.locator('#launchBanner').click();
await page.waitForTimeout(400);
check('hero CTA re-launches the banner', await dialog.isVisible().catch(() => false));
await dialog.locator('button.action', { hasText: 'Reject all' }).click();
await page.waitForTimeout(300);

// Footer "Privacy choices" opens the preference center.
await page.locator('#footerPrefs').click();
await page.waitForTimeout(300);
check('footer link opens the preference center', await dialog.isVisible().catch(() => false));
await page.keyboard.press('Escape');
await page.waitForTimeout(200);

// Install tabs switch panels.
await page.locator('.install-tabs button', { hasText: 'npm' }).click();
await page.waitForTimeout(150);
check('install tab switches to the npm panel', await page.locator('#p-npm.active').count() === 1);

// Anchor nav present.
check('section anchors present', await page.locator('#why, #adobe, #install, #compare').count() >= 4);

// No horizontal overflow at desktop width.
const overflow = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
check('no horizontal page overflow', overflow);

// Mobile pass.
await page.setViewportSize({ width: 390, height: 844 });
await page.waitForTimeout(200);
const mobileOverflow = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
check('no horizontal overflow on mobile', mobileOverflow);
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
