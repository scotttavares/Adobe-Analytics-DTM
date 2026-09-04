/**
 * Pre-deploy cookie crawl.
 *
 * Spiders a site in real Chromium, inventories every cookie set (including
 * HttpOnly, via the CDP cookie jar) plus storage keys, classifies each against
 * scripts/cookie-catalog.json, diffs against a stored baseline to surface *new*
 * cookies, and writes JSON + HTML reports. Exits non-zero when new or
 * unknown cookies appear, so a scheduled job can flag a change.
 *
 * Usage:
 *   node scripts/cookie-crawl.mjs --url https://example.com \
 *     [--max-pages 30] [--cadence weekly|monthly] [--out cookie-report] \
 *     [--baseline cookie-report/baseline.json] [--no-update] \
 *     [--click-accept "#acAccept"]      # also crawl post-consent state
 */
import { chromium } from 'playwright';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

// ---- args -------------------------------------------------------------------
function parseArgs(argv) {
  const o = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const k = a.slice(2);
      const v = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true;
      o[k] = v;
    }
  }
  return o;
}
const args = parseArgs(process.argv.slice(2));
const START = args.url || process.env.SCAN_URL;
const MAX_PAGES = Number(args['max-pages'] || 30);
const CADENCE = args.cadence || 'weekly';
const OUT = args.out || 'cookie-report';
const BASELINE = args.baseline || join(OUT, 'baseline.json');
const UPDATE = !args['no-update'];
const CLICK_ACCEPT = typeof args['click-accept'] === 'string' ? args['click-accept'] : null;
if (!START) {
  console.error('cookie-crawl: --url <startUrl> (or SCAN_URL) is required');
  process.exit(2);
}

// ---- classification ---------------------------------------------------------
const catalog = JSON.parse(readFileSync(join(here, 'cookie-catalog.json'), 'utf8'))
  .map((e) => ({ ...e, re: new RegExp(e.pattern) }));
function classify(name) {
  for (const e of catalog) if (e.re.test(name)) return e;
  return {
    provider: 'Unknown', company: 'Unknown', category: 'unknown',
    description: 'Not in the curated database — identify and add it to scripts/cookie-catalog.json.',
    dataCollected: '', privacyPolicy: null,
  };
}
const key = (c) => c.name + '@' + c.domain + c.path;

// ---- crawl ------------------------------------------------------------------
const pinned = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium';
const browser = await chromium.launch(existsSync(pinned) ? { executablePath: pinned } : {});
const context = await browser.newContext();
const origin = new URL(START).origin;
const queue = [START.split('#')[0]];
const seen = new Set();
const visited = [];
const errors = [];
const firstSeen = {};

const skip = /\.(png|jpe?g|gif|svg|webp|ico|pdf|zip|gz|css|js|mp4|woff2?|ttf|xml|rss)$/i;

while (queue.length && visited.length < MAX_PAGES) {
  const url = queue.shift();
  if (seen.has(url)) continue;
  seen.add(url);
  const page = await context.newPage();
  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 25000 });
    await page.waitForTimeout(700);
    if (CLICK_ACCEPT) {
      const btn = page.locator(CLICK_ACCEPT).first();
      if (await btn.isVisible().catch(() => false)) { await btn.click().catch(() => {}); await page.waitForTimeout(500); }
    }
    for (const c of await context.cookies()) if (!(key(c) in firstSeen)) firstSeen[key(c)] = url;
    const links = await page.$$eval('a[href]', (as) => as.map((a) => a.href));
    for (const l of links) {
      try {
        const u = new URL(l);
        const clean = (u.origin + u.pathname).split('#')[0];
        if (u.origin === origin && !seen.has(clean) && !skip.test(u.pathname)) queue.push(clean);
      } catch { /* ignore */ }
    }
    visited.push(url);
  } catch (e) {
    errors.push({ url, error: String(e).split('\n')[0] });
  }
  await page.close();
}

const cookies = await context.cookies();
let storage = { local: [], session: [] };
try {
  const p = await context.newPage();
  await p.goto(START, { waitUntil: 'domcontentloaded', timeout: 20000 });
  storage = await p.evaluate(() => ({ local: Object.keys(localStorage), session: Object.keys(sessionStorage) }));
  await p.close();
} catch { /* storage may be blocked */ }
await browser.close();

// ---- inventory + diff -------------------------------------------------------
const inventory = cookies.map((c) => {
  const m = classify(c.name);
  return {
    name: c.name, domain: c.domain, path: c.path,
    httpOnly: c.httpOnly, secure: c.secure, sameSite: c.sameSite,
    expiresDays: c.expires && c.expires > 0 ? Math.round((c.expires * 1000 - Date.now()) / 86400000) : 'session',
    provider: m.provider, company: m.company, category: m.category,
    description: m.description, dataCollected: m.dataCollected, privacyPolicy: m.privacyPolicy,
    firstSeen: firstSeen[key(c)] || START,
  };
}).sort((a, b) => (a.category + a.name).localeCompare(b.category + b.name));

const baseline = existsSync(BASELINE) ? JSON.parse(readFileSync(BASELINE, 'utf8')) : null;
const baseSet = baseline ? new Set(baseline) : null;
const invKeys = inventory.map((c) => c.name + '@' + c.domain + c.path);
const added = baseSet ? inventory.filter((c) => !baseSet.has(c.name + '@' + c.domain + c.path)) : [];
const removed = baseSet ? [...baseSet].filter((k) => !invKeys.includes(k)) : [];
const unknown = inventory.filter((c) => c.category === 'unknown');

const byCategory = inventory.reduce((m, c) => ((m[c.category] = (m[c.category] || 0) + 1), m), {});
const report = {
  generatedAt: new Date().toISOString(),
  start: START, origin, cadence: CADENCE,
  pagesCrawled: visited.length, pagesErrored: errors.length,
  totals: { cookies: inventory.length, byCategory, new: added.length, removed: removed.length, unknown: unknown.length },
  new: added, removed, unknown, inventory, storage, errors,
  firstRun: !baseline,
};

// ---- emit -------------------------------------------------------------------
mkdirSync(OUT, { recursive: true });
writeFileSync(join(OUT, 'report.json'), JSON.stringify(report, null, 2));
writeFileSync(join(OUT, 'report.html'), renderHtml(report));
if (UPDATE) writeFileSync(BASELINE, JSON.stringify(invKeys, null, 2));

console.log(
  `crawled ${visited.length} page(s) · ${inventory.length} cookies ` +
  `(${Object.entries(byCategory).map(([k, v]) => v + ' ' + k).join(', ')}) · ` +
  `${added.length} new · ${removed.length} removed · ${unknown.length} unknown` +
  (report.firstRun ? ' · baseline created' : '')
);

// New or unknown cookies are the signal a scheduled run should act on.
process.exit(added.length || unknown.length ? 1 : 0);

// ---- html report ------------------------------------------------------------
function esc(s) { return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
function renderHtml(r) {
  const catColor = { essential: '#2e7d32', analytics: '#1565c0', personalization: '#6a1b9a', advertising: '#c62828', unknown: '#b26a00' };
  const rows = r.inventory.map((c) => `<tr>
    <td><code>${esc(c.name)}</code></td>
    <td><span class="pill" style="background:${catColor[c.category] || '#666'}">${esc(c.category)}</span></td>
    <td>${esc(c.provider)}</td>
    <td>${esc(c.domain)}</td>
    <td>${c.httpOnly ? 'HttpOnly ' : ''}${c.secure ? 'Secure' : ''}</td>
    <td>${esc(c.expiresDays)}</td>
    <td class="src"><a href="${esc(c.firstSeen)}">${esc(c.firstSeen.replace(r.origin, '') || '/')}</a></td>
  </tr>
  <tr class="detail"><td colspan="7">
    <div>${esc(c.description || '')}</div>
    ${c.dataCollected ? `<div><strong>Data collected:</strong> ${esc(c.dataCollected)}</div>` : ''}
    <div class="who"><strong>${esc(c.company || c.provider)}</strong>${c.privacyPolicy ? ` · <a href="${esc(c.privacyPolicy)}" target="_blank" rel="noopener">Privacy policy ↗</a>` : ' · no public privacy policy on file'}</div>
  </td></tr>`).join('');
  const newBlock = r.new.length
    ? `<div class="alert new"><strong>${r.new.length} new cookie(s) since the last crawl:</strong> ${r.new.map((c) => `<code>${esc(c.name)}</code>`).join(' ')}</div>`
    : (r.firstRun ? '<div class="alert">First run — baseline created. Future crawls will flag anything new.</div>' : '<div class="alert ok">No new cookies since the last crawl.</div>');
  const unkBlock = r.unknown.length
    ? `<div class="alert warn"><strong>${r.unknown.length} unclassified cookie(s)</strong> need a catalog entry: ${r.unknown.map((c) => `<code>${esc(c.name)}</code>`).join(' ')}</div>` : '';
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Cookie crawl — ${esc(r.origin)}</title>
<style>
  body{font:15px/1.6 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#1a1a2e;max-width:1000px;margin:32px auto;padding:0 20px;}
  h1{font-size:22px;margin:0 0 4px} .meta{color:#666;font-size:13px;margin-bottom:20px}
  .stats{display:flex;gap:10px;flex-wrap:wrap;margin:0 0 18px}
  .stat{background:#f4f5f8;border:1px solid #e5e7eb;border-radius:10px;padding:10px 14px;font-size:13px}
  .stat b{display:block;font-size:20px;font-family:Georgia,serif}
  .alert{border-radius:8px;padding:10px 14px;margin:0 0 10px;font-size:14px;background:#eef2ff;border:1px solid #dbe1ff}
  .alert.new{background:#fff4e5;border-color:#ffd9a8} .alert.warn{background:#fdecec;border-color:#f7c4c4}
  .alert.ok{background:#e9f7ec;border-color:#bfe6c8}
  table{width:100%;border-collapse:collapse;font-size:13px;margin-top:8px}
  th,td{text-align:left;padding:7px 8px;border-bottom:1px solid #eee;vertical-align:top}
  th{font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:#666}
  code{background:#f4f4f6;padding:1px 5px;border-radius:4px;font-size:12px}
  .pill{color:#fff;padding:2px 8px;border-radius:999px;font-size:11px;font-weight:600}
  .src a{color:#1565c0;text-decoration:none}
  tr.detail td{padding-top:0;color:#555;font-size:12px;background:#fafbfc;border-bottom:2px solid #eef0f3}
  tr.detail a{color:#1565c0} tr.detail .who{margin-top:3px}
</style></head><body>
<h1>Cookie crawl — ${esc(r.origin)}</h1>
<p class="meta">${esc(r.generatedAt)} · ${r.pagesCrawled} pages crawled · ${r.cadence} cadence${r.pagesErrored ? ' · ' + r.pagesErrored + ' page error(s)' : ''}</p>
<div class="stats">
  <div class="stat"><b>${r.totals.cookies}</b> cookies</div>
  ${Object.entries(r.totals.byCategory).map(([k, v]) => `<div class="stat"><b>${v}</b> ${esc(k)}</div>`).join('')}
  <div class="stat"><b>${r.totals.new}</b> new</div>
  <div class="stat"><b>${r.totals.unknown}</b> unknown</div>
</div>
${newBlock}${unkBlock}
<table><thead><tr><th>Name</th><th>Category</th><th>Provider</th><th>Domain</th><th>Flags</th><th>Expires (days)</th><th>First seen</th></tr></thead>
<tbody>${rows}</tbody></table>
<p class="meta" style="margin-top:20px">Classification is heuristic (scripts/cookie-catalog.json) — treat "unknown" as a to-do, not a verdict. Storage keys observed: ${r.storage.local.length} localStorage, ${r.storage.session.length} sessionStorage.</p>
</body></html>`;
}
