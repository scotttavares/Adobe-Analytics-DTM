/**
 * Runs axe-core against the consent dialog in real Chromium.
 *
 * The existing browser suite asserts specific accessibility *structure* — roles,
 * focus trapping, inert backgrounds. That proves the things I thought to check.
 * axe checks the things I did not, including contrast ratios computed from
 * rendered pixels, which no amount of reading the CSS will tell you.
 *
 * axe traverses shadow DOM natively, so the dialog is audited even though it
 * lives in a shadow root.
 *
 * Run with: node scripts/verify-a11y.mjs
 */
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import { extname, join, normalize, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const axeSource = readFileSync(
  resolve(root, 'node_modules/axe-core/axe.min.js'),
  'utf8'
);

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
const base = `http://localhost:${server.address().port}/demo/index.html`;

const pinned = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium';
const browser = await chromium.launch(existsSync(pinned) ? { executablePath: pinned } : {});

// WCAG 2.2 AA is what the European Accessibility Act effectively requires.
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'];

async function audit(label, prepare) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.goto(base, { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  if (prepare) await prepare(page);
  await page.waitForTimeout(300);

  await page.addScriptTag({ content: axeSource });
  const result = await page.evaluate(
    async (tags) =>
      await window.axe.run(document, {
        runOnly: { type: 'tag', values: tags },
        resultTypes: ['violations'],
      }),
    TAGS
  );
  await page.close();

  // Only report what actually touches the consent UI — the demo page itself is
  // scaffolding, not the deliverable.
  const ours = result.violations.filter((v) =>
    v.nodes.some((n) =>
      (n.target || []).some((t) => String(t).includes('clearconsent-root'))
    )
  );
  const others = result.violations.filter((v) => !ours.includes(v));

  console.log(`\n=== ${label} ===`);
  console.log(`  consent UI violations: ${ours.length}`);
  if (ours.length) {
    for (const v of ours) {
      console.log(`\n  [${v.impact}] ${v.id} — ${v.help}`);
      console.log(`    ${v.helpUrl}`);
      for (const n of v.nodes.slice(0, 4)) {
        console.log(`    target: ${JSON.stringify(n.target)}`);
        if (n.failureSummary) {
          console.log(`      ${n.failureSummary.replace(/\n/g, '\n      ')}`);
        }
      }
    }
  }
  if (others.length) {
    console.log(
      `  (demo page only, not the library: ${others.map((v) => v.id).join(', ')})`
    );
  }
  return ours;
}

const findings = [];

findings.push(...(await audit('First-layer notice', null)));

findings.push(
  ...(await audit('Notice with a category detail expanded', async (page) => {
    await page
      .locator('#clearconsent-root .details-toggle')
      .first()
      .click();
  }))
);

findings.push(
  ...(await audit('Preference center reopened from the badge', async (page) => {
    await page
      .locator('#clearconsent-root button.action', { hasText: 'Accept all' })
      .click();
    await page.waitForTimeout(300);
    await page.locator('#clearconsent-root .badge').click();
  }))
);

findings.push(
  ...(await audit('Blocked-embed placeholder', async (page) => {
    await page.evaluate(() => {
      const frame = document.createElement('iframe');
      frame.setAttribute('data-cc-category', 'personalization');
      frame.setAttribute('data-cc-src', 'https://example.com/embed');
      frame.setAttribute('title', 'Example embed');
      document.querySelector('section#experience')?.appendChild(frame);
    });
    await page.waitForTimeout(400);
  }))
);

/**
 * axe cannot compute contrast against a CSS gradient — it reports those nodes
 * as "incomplete" rather than pass or fail. The primary buttons are exactly
 * that case, so the ratio is computed here against both gradient stops.
 */
function relativeLuminance([r, g, b]) {
  const channel = (v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function contrastRatio(fg, bg) {
  const a = relativeLuminance(fg);
  const b = relativeLuminance(bg);
  const [hi, lo] = a > b ? [a, b] : [b, a];
  return (hi + 0.05) / (lo + 0.05);
}

function parseColor(css) {
  const m = css.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}

const contrastPage = await browser.newPage({ viewport: { width: 1280, height: 900 } });
await contrastPage.goto(base, { waitUntil: 'networkidle' });
await contrastPage.waitForTimeout(500);

const swatches = await contrastPage.evaluate(() => {
  const shadow = document.getElementById('clearconsent-root').shadowRoot;
  const primary = shadow.querySelector('button.primary');
  const secondary = shadow.querySelector('button.secondary');
  const body = shadow.querySelector('p.body');
  const title = shadow.querySelector('h2.title');
  const panel = shadow.querySelector('.panel');
  const cs = getComputedStyle;
  return {
    primaryText: cs(primary).color,
    primaryGradient: cs(primary).backgroundImage,
    secondaryText: cs(secondary).color,
    panelBg: cs(panel).backgroundColor,
    bodyText: cs(body).color,
    titleText: cs(title).color,
  };
});
await contrastPage.close();

console.log('\n=== Contrast (computed; axe reports gradients as incomplete) ===');

const gradientStops = [...swatches.primaryGradient.matchAll(/rgba?\((\d+),\s*(\d+),\s*(\d+)/g)].map(
  (m) => [Number(m[1]), Number(m[2]), Number(m[3])]
);
const primaryFg = parseColor(swatches.primaryText);

const contrastChecks = [];
gradientStops.forEach((stop, i) => {
  const ratio = contrastRatio(primaryFg, stop);
  contrastChecks.push({
    label: `primary button text vs gradient stop ${i + 1} rgb(${stop.join(',')})`,
    ratio,
    min: 4.5,
  });
});

const panelBg = parseColor(swatches.panelBg);
for (const [label, fg] of [
  ['secondary button text vs panel', swatches.secondaryText],
  ['body text vs panel', swatches.bodyText],
  ['heading vs panel', swatches.titleText],
]) {
  contrastChecks.push({ label, ratio: contrastRatio(parseColor(fg), panelBg), min: 4.5 });
}

let contrastFailures = 0;
for (const c of contrastChecks) {
  const ok = c.ratio >= c.min;
  if (!ok) contrastFailures++;
  console.log(
    `  ${ok ? 'PASS' : 'FAIL'}  ${c.label} — ${c.ratio.toFixed(2)}:1 (AA needs ${c.min}:1)`
  );
}

await browser.close();
server.close();

const total = findings.length + contrastFailures;
console.log(
  `\n${total === 0 ? 'PASS' : 'FAIL'} — ${findings.length} axe violation(s), ${contrastFailures} contrast failure(s) in the consent UI`
);
if (total) process.exit(1);
