/**
 * Drives the demo page in a real browser and asserts the things jsdom cannot:
 * that the banner paints, that the Adobe SDK calls actually fire, that blocked
 * scripts really execute on grant, and that the page does not shift.
 *
 * Run with: node scripts/verify-demo.mjs
 */
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
};

const server = createServer(async (req, res) => {
  const url = new URL(req.url || '/', 'http://localhost');
  const pathname = url.pathname === '/' ? '/demo/index.html' : decodeURIComponent(url.pathname);
  const target = join(root, normalize(pathname).replace(/^(\.\.[/\\])+/, ''));
  const info = await stat(target).catch(() => null);
  if (!info?.isFile()) {
    res.writeHead(404).end('not found');
    return;
  }
  res.writeHead(200, {
    'Content-Type': TYPES[extname(target)] || 'application/octet-stream',
    'Cache-Control': 'no-store',
  });
  res.end(await readFile(target));
});

await new Promise((r) => server.listen(0, r));
const port = server.address().port;
const base = `http://localhost:${port}/demo/index.html`;

const results = [];
const check = (name, pass, detail = '') => {
  results.push({ name, pass, detail });
  console.log(`${pass ? '  PASS' : '  FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
};

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await context.newPage();

const consoleErrors = [];
const failedRequests = [];
page.on('pageerror', (e) => consoleErrors.push(String(e)));
page.on('console', (m) => {
  if (m.type() === 'error') consoleErrors.push(m.text());
});
page.on('requestfailed', (r) => failedRequests.push(r.url()));
page.on('response', (r) => {
  if (r.status() >= 400) failedRequests.push(`${r.status()} ${r.url()}`);
});

// Count how many network requests the consent layer itself costs.
const requests = [];
page.on('request', (r) => requests.push(r.url()));

await page.goto(base, { waitUntil: 'networkidle' });

// --- the dialog renders --------------------------------------------------
const dialog = page.locator('#adobe-consent-root').locator('[role="dialog"]');
await dialog.waitFor({ state: 'visible', timeout: 5000 });
check('consent dialog renders', await dialog.isVisible());

const title = await dialog.locator('h2.title').textContent();
check('dialog shows the configured heading', title === 'Your privacy, your altitude', title ?? '');

const boxes = dialog.locator('input[type="checkbox"]');
check('all four categories are on the first layer', (await boxes.count()) === 4);

const checkedBefore = await dialog
  .locator('input[type="checkbox"]:checked')
  .count();
check('only the required category is pre-ticked (Planet49)', checkedBefore === 1, `${checkedBefore} ticked`);

// --- equal prominence ----------------------------------------------------
const accept = dialog.locator('button.action', { hasText: 'Accept all' });
const reject = dialog.locator('button.action', { hasText: 'Reject all' });
const acceptBox = await accept.boundingBox();
const rejectBox = await reject.boundingBox();
const sameHeight = Math.abs(acceptBox.height - rejectBox.height) < 1;
const acceptStyle = await accept.evaluate((el) => {
  const s = getComputedStyle(el);
  return s.backgroundImage + '|' + s.color + '|' + s.fontWeight + '|' + s.fontSize;
});
const rejectStyle = await reject.evaluate((el) => {
  const s = getComputedStyle(el);
  return s.backgroundImage + '|' + s.color + '|' + s.fontWeight + '|' + s.fontSize;
});
check('accept and reject are the same size', sameHeight, `${acceptBox.height} vs ${rejectBox.height}`);
check('accept and reject are styled identically', acceptStyle === rejectStyle);

// --- accessibility -------------------------------------------------------
const modalAttrs = await dialog.evaluate((el) => ({
  role: el.getAttribute('role'),
  modal: el.getAttribute('aria-modal'),
  labelled: el.getAttribute('aria-labelledby'),
}));
check(
  'dialog carries role/aria-modal/aria-labelledby',
  modalAttrs.role === 'dialog' && modalAttrs.modal === 'true' && !!modalAttrs.labelled
);

const bodyInert = await page.evaluate(() => {
  const main = document.querySelector('section#book');
  return main?.hasAttribute('inert');
});
check('page behind the dialog is inert', bodyInert === true);

const focusStart = await page.evaluate(() => {
  const root = document.getElementById('adobe-consent-root').shadowRoot;
  return root.activeElement?.className || document.activeElement?.tagName;
});
check('focus moves into the dialog on open', String(focusStart).includes('panel'), String(focusStart));

// Tab should stay inside the dialog.
for (let i = 0; i < 12; i++) await page.keyboard.press('Tab');
const focusTrapped = await page.evaluate(() => {
  const host = document.getElementById('adobe-consent-root');
  return host.shadowRoot.activeElement !== null;
});
check('focus stays trapped inside the dialog', focusTrapped);

// --- no layout shift -----------------------------------------------------
const cls = await page.evaluate(
  () =>
    new Promise((resolve) => {
      let total = 0;
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) if (!entry.hadRecentInput) total += entry.value;
      }).observe({ type: 'layout-shift', buffered: true });
      setTimeout(() => resolve(total), 400);
    })
);
check('no cumulative layout shift from the banner', cls < 0.01, `CLS ${cls.toFixed(4)}`);

// --- network cost --------------------------------------------------------
const consentRequests = requests.filter((u) => u.includes('adobe-consent'));
check(
  'consent layer costs exactly one request',
  consentRequests.length === 1,
  `${consentRequests.length} request(s)`
);

await page.screenshot({ path: 'demo/screenshot-banner.png' });

// --- blocked tags stay blocked ------------------------------------------
const analyticsFlagBefore = await page.locator('#flag-analytics').textContent();
check('analytics tag is blocked before consent', /blocked/.test(analyticsFlagBefore ?? ''));

// --- save a partial choice ----------------------------------------------
await dialog.locator('input[data-category="analytics"]').check();
await dialog.locator('button.action', { hasText: 'Save choices' }).click();
await page.waitForTimeout(300);

check('dialog closes after saving', !(await dialog.isVisible().catch(() => false)));

const analyticsFlagAfter = await page.locator('#flag-analytics').textContent();
check('blocked analytics script runs once granted', /running/.test(analyticsFlagAfter ?? ''));

const advertisingFlagAfter = await page.locator('#flag-advertising').textContent();
check(
  'advertising script stays blocked when not granted',
  /blocked/.test(advertisingFlagAfter ?? '')
);

// --- Adobe calls actually fired -----------------------------------------
const calls = await page.evaluate(() => window.__demoCalls.map((c) => c.api + ': ' + c.message));

const setConsentCalls = calls.filter((c) => c.startsWith('alloy: setConsent'));
check('alloy setConsent fired', setConsentCalls.length > 0, setConsentCalls[0] || 'not called');

// The first call happens on page load, before any choice, and correctly denies
// everything. The decision under test is the most recent one.
check(
  'page-load setConsent denies collection while undecided',
  /collect:n/.test(setConsentCalls[0] || ''),
  setConsentCalls[0] || ''
);
const latestSetConsent = setConsentCalls[setConsentCalls.length - 1];
check(
  'setConsent granted collect and denied personalize after saving',
  /collect:y/.test(latestSetConsent || '') && /personalize:n/.test(latestSetConsent || ''),
  latestSetConsent || ''
);

const optInCall = calls.filter((c) => c.startsWith('adobe.optIn')).pop();
check('ECID Opt-In completed', !!optInCall, optInCall || 'not called');
check(
  'Opt-In approved analytics and ECID only',
  /aa/.test(optInCall || '') && /ecid/.test(optInCall || '') && !/target/.test(optInCall || '')
);

check(
  'data layer received a consent event',
  calls.some((c) => c.startsWith('adobeDataLayer: push "consent-updated"'))
);
check(
  'direct call rule fired',
  calls.some((c) => c.includes('track("adobe-consent-changed")'))
);
check(
  'per-category direct call fired',
  calls.some((c) => c.includes('track("consent-analytics-granted")'))
);
check(
  'gated callback released on grant',
  calls.some((c) => c.startsWith('gate: analytics gate released'))
);
check(
  'AppMeasurement released once analytics granted',
  calls.some((c) => c.includes('s.abort = false'))
);

// --- persistence across a reload ----------------------------------------
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(400);
const dialogAfterReload = await page
  .locator('#adobe-consent-root [role="dialog"]')
  .isVisible()
  .catch(() => false);
check('decision persists — no re-prompt on reload', !dialogAfterReload);

const stateAfterReload = await page.evaluate(() => window.AdobeConsent.instance.decision);
check(
  'restored decision matches what was saved',
  stateAfterReload.analytics === true && stateAfterReload.advertising === false,
  JSON.stringify(stateAfterReload)
);

const badge = page.locator('#adobe-consent-root .badge');
check('re-open badge is present after a decision', await badge.isVisible());

// --- withdrawing consent -------------------------------------------------
await badge.click();
await page.waitForTimeout(250);
await page.screenshot({ path: 'demo/screenshot-preferences.png' });

await page
  .locator('#adobe-consent-root [role="dialog"] button.action', { hasText: 'Reject all' })
  .click();
await page.waitForTimeout(300);

const callsAfterReject = await page.evaluate(() =>
  window.__demoCalls.map((c) => c.api + ': ' + c.message)
);
check(
  'withdrawal re-asserts denial to alloy',
  callsAfterReject.some((c) => c.startsWith('alloy: setConsent') && /collect:n/.test(c))
);
check(
  'withdrawal aborts AppMeasurement',
  callsAfterReject.some((c) => c.includes('s.abort = true'))
);

// --- GPC -----------------------------------------------------------------
const gpcContext = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const gpcPage = await gpcContext.newPage();
await gpcPage.addInitScript(() => {
  Object.defineProperty(navigator, 'globalPrivacyControl', { value: true, configurable: true });
});
await gpcPage.goto(base, { waitUntil: 'networkidle' });
await gpcPage.waitForTimeout(500);

const gpcDialog = await gpcPage
  .locator('#adobe-consent-root [role="dialog"]')
  .isVisible()
  .catch(() => false);
check('GPC suppresses the prompt', !gpcDialog);

const gpcState = await gpcPage.evaluate(() => ({
  decision: window.AdobeConsent.instance.decision,
  method: window.AdobeConsent.instance.state?.method,
}));
check(
  'GPC is recorded as the decision method',
  gpcState.method === 'gpc' && gpcState.decision.analytics === false,
  JSON.stringify(gpcState)
);

// Chromium always probes /favicon.ico; the demo has none and that is not a bug.
const realFailures = failedRequests.filter((u) => !u.includes('favicon.ico'));
check('no failed requests', realFailures.length === 0, realFailures.slice(0, 3).join(' | '));

const realErrors = consoleErrors.filter((e) => !/favicon/i.test(e) && !/404/.test(e));
check('no uncaught page errors', realErrors.length === 0, realErrors.slice(0, 3).join(' | '));

await browser.close();
server.close();

const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} browser checks passed`);
if (failed.length) {
  console.log('\nFailures:');
  for (const f of failed) console.log(`  - ${f.name} ${f.detail}`);
  process.exit(1);
}
