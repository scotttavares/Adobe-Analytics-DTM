import { build } from 'esbuild';
import { gzipSync, brotliCompressSync } from 'node:zlib';
import { readFileSync, mkdirSync, writeFileSync, existsSync, copyFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const out = resolve(root, 'dist');
mkdirSync(out, { recursive: true });

const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));
const banner = `/*! adobe-consent v${pkg.version} | MIT | Adobe-native cookie consent management */`;

const shared = {
  entryPoints: [resolve(root, 'src/index.ts')],
  bundle: true,
  target: ['es2019', 'chrome80', 'firefox78', 'safari13', 'edge88'],
  legalComments: 'none',
  banner: { js: banner },
  logLevel: 'info',
};

const builds = [
  // The drop-in build: one file, global `AdobeConsent`, auto-inits from a
  // data-config attribute or window.adobeConsentConfig.
  {
    ...shared,
    outfile: resolve(out, 'adobe-consent.min.js'),
    format: 'iife',
    globalName: 'AdobeConsent',
    minify: true,
    footer: {
      js: 'if(typeof window!=="undefined"&&AdobeConsent&&AdobeConsent.default){for(var k in AdobeConsent.default){if(!(k in AdobeConsent))AdobeConsent[k]=AdobeConsent.default[k];}}',
    },
  },
  // Unminified IIFE, for debugging a live page.
  {
    ...shared,
    outfile: resolve(out, 'adobe-consent.js'),
    format: 'iife',
    globalName: 'AdobeConsent',
    minify: false,
    footer: {
      js: 'if(typeof window!=="undefined"&&AdobeConsent&&AdobeConsent.default){for(var k in AdobeConsent.default){if(!(k in AdobeConsent))AdobeConsent[k]=AdobeConsent.default[k];}}',
    },
  },
  { ...shared, outfile: resolve(out, 'adobe-consent.esm.js'), format: 'esm', minify: true },
  { ...shared, outfile: resolve(out, 'adobe-consent.cjs'), format: 'cjs', minify: false },
];

// The Launch extension `require()`s this vendored CommonJS build from its main
// module, so the whole CMP is inlined into the Tags runtime library. That is
// what buys the "no extra network request to render the banner" property.
const extVendorDir = resolve(root, 'launch-extension/src/lib/vendor');
if (existsSync(resolve(root, 'launch-extension/extension.json'))) {
  mkdirSync(extVendorDir, { recursive: true });
  builds.push({
    ...shared,
    outfile: resolve(extVendorDir, 'adobe-consent.js'),
    format: 'cjs',
    minify: true,
    // Adobe's Tags build pipeline parses extension code with Babylon, which
    // predates ES2019 and rejects optional catch binding (`catch {}` with no
    // parameter). At an es2019 target esbuild *preserves* that syntax, and the
    // resulting library fails to build with
    // "SyntaxError: Unexpected token, expected (" inside parseTryStatement.
    // Targeting es2015 transpiles it back to `catch (e)`.
    target: ['es2015'],
  });
}

for (const config of builds) {
  await build(config);
}

// The marketing site dogfoods the library — it loads the same minified bundle
// the docs describe. Keep its copy in lockstep with the build so the site can
// never quietly ship a stale library.
const siteDir = resolve(root, 'site');
if (existsSync(resolve(siteDir, 'index.html'))) {
  copyFileSync(resolve(out, 'adobe-consent.min.js'), resolve(siteDir, 'adobe-consent.min.js'));
  console.log('  synced site/adobe-consent.min.js');
}

const min = readFileSync(resolve(out, 'adobe-consent.min.js'));
const report = {
  version: pkg.version,
  raw: min.length,
  gzip: gzipSync(min, { level: 9 }).length,
  brotli: brotliCompressSync(min).length,
};
writeFileSync(resolve(out, 'size.json'), JSON.stringify(report, null, 2));

const kb = (n) => (n / 1024).toFixed(2) + ' KB';
console.log(
  `\n  adobe-consent.min.js  ${kb(report.raw)} raw  ${kb(report.gzip)} gzip  ${kb(report.brotli)} brotli`
);
