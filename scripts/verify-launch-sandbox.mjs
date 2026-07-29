/**
 * Loads the Turbine library built by `@adobe/reactor-sandbox` in a real browser
 * and asserts the extension actually runs inside it.
 *
 * The packager only validates extension.json against a schema; it says nothing
 * about whether the library builds or the modules execute. This does.
 *
 * Prerequisites:
 *   cd launch-extension && npx @adobe/reactor-sandbox   (leave running)
 *   node scripts/verify-launch-sandbox.mjs
 */
import { chromium } from 'playwright';
import { existsSync } from 'node:fs';

const BASE = process.env.SANDBOX_URL || 'http://localhost:3000';

const results = [];
const check = (name, pass, detail = '') => {
  results.push({ name, pass, detail });
  console.log(`${pass ? '  PASS' : '  FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
};

const pinned = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium';
const browser = await chromium.launch(
  existsSync(pinned) ? { executablePath: pinned } : {}
);
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text());
});

const libRequests = [];
page.on('request', (r) => {
  if (/launch-EN|adobe-consent/.test(r.url())) libRequests.push(r.url());
});

const response = await page.goto(BASE + '/libSandbox.html', { waitUntil: 'networkidle' });
check('library sandbox page loads', response?.ok() === true, `HTTP ${response?.status()}`);

await page.waitForTimeout(1200);

// --- Turbine booted --------------------------------------------------------
const satellite = await page.evaluate(() => typeof window._satellite);
check('Turbine booted (_satellite defined)', satellite === 'object', satellite);

// --- the extension main module ran ----------------------------------------
const managerType = await page.evaluate(() => typeof window.AdobeConsent);
check(
  'extension main module ran and published the manager',
  managerType === 'object',
  managerType
);

// --- the vendored CMP is inlined, not fetched ------------------------------
const separateFetch = libRequests.filter((u) => /adobe-consent\.(min\.)?js/.test(u));
check(
  'CMP is inlined — no separate request for it',
  separateFetch.length === 0,
  separateFetch.join(', ') || 'only the Launch library was requested'
);
check(
  'exactly one library request',
  libRequests.length === 1,
  `${libRequests.length}: ${libRequests.map((u) => u.split('/').pop()).join(', ')}`
);

// --- engine state resolved -------------------------------------------------
const state = await page.evaluate(() => {
  const m = window.AdobeConsent;
  if (!m) return null;
  return {
    region: m.region,
    model: m.engine && m.engine.model,
    pending: m.isPending(),
    decision: m.decision,
  };
});
check('engine resolved its state', !!state, JSON.stringify(state));
check(
  'extension configuration reached the engine (region DE, opt-in)',
  state?.region === 'DE' && state?.model === 'opt_in',
  `${state?.region} / ${state?.model}`
);
check(
  'nothing optional granted before a choice',
  state?.decision?.analytics === false && state?.decision?.essential === true
);

// --- the banner rendered, with the configured copy -------------------------
const dialog = page.locator('#adobe-consent-root [role="dialog"]');
const dialogVisible = await dialog.isVisible().catch(() => false);
check('consent dialog rendered from inside Turbine', dialogVisible);

if (dialogVisible) {
  const title = await dialog.locator('h2.title').textContent();
  check(
    'configuration view settings drove the copy',
    title === 'Your privacy, your altitude',
    title ?? ''
  );
}

// --- data elements resolve through Turbine ---------------------------------
const dataElements = await page.evaluate(() => {
  const out = {};
  for (const name of ['consentStatus', 'consentSummary', 'consentRegion', 'consentXdm']) {
    try {
      out[name] = window._satellite.getVar(name);
    } catch (e) {
      out[name] = 'ERROR: ' + (e && e.message);
    }
  }
  return out;
});
check(
  'consentStatus data element resolves',
  dataElements.consentStatus === 'n',
  JSON.stringify(dataElements.consentStatus)
);
check(
  'consentRegion data element resolves',
  dataElements.consentRegion === 'DE',
  JSON.stringify(dataElements.consentRegion)
);
check(
  'consentSummary data element resolves',
  typeof dataElements.consentSummary === 'string' &&
    dataElements.consentSummary.includes('|'),
  JSON.stringify(dataElements.consentSummary)
);
check(
  'consentXdm data element returns the Adobe 2.0 consent object',
  dataElements.consentXdm && dataElements.consentXdm.collect,
  JSON.stringify(dataElements.consentXdm)
);

// --- the shared module is reachable ---------------------------------------
const shared = await page.evaluate(() => {
  try {
    const api = window._satellite.getSharedModule
      ? window._satellite.getSharedModule('adobe-consent', 'consent-api')
      : null;
    if (!api) return 'not exposed via _satellite';
    return { hasConsent: typeof api.hasConsent, gate: typeof api.gate };
  } catch (e) {
    return 'ERROR: ' + (e && e.message);
  }
});
console.log('  info  shared module via _satellite:', JSON.stringify(shared));

// --- accepting consent works end to end ------------------------------------
if (dialogVisible) {
  await dialog.locator('button.action', { hasText: 'Accept all' }).click();
  await page.waitForTimeout(500);

  const after = await page.evaluate(() => ({
    decision: window.AdobeConsent.decision,
    status: window._satellite.getVar('consentStatus'),
    summary: window._satellite.getVar('consentSummary'),
  }));
  check('accepting consent updates the engine', after.decision.analytics === true);
  check(
    'data elements reflect the new decision',
    after.status === 'y',
    JSON.stringify(after.status)
  );
  check(
    'summary data element reflects the new decision',
    typeof after.summary === 'string' && after.summary.includes('accept_all'),
    JSON.stringify(after.summary)
  );
}

const realErrors = errors.filter((e) => !/favicon/i.test(e));
check('no uncaught errors inside Turbine', realErrors.length === 0, realErrors.slice(0, 3).join(' | '));

await browser.close();

const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} Turbine sandbox checks passed`);
if (failed.length) {
  console.log('\nFailures:');
  for (const f of failed) console.log(`  - ${f.name} ${f.detail}`);
  process.exit(1);
}
