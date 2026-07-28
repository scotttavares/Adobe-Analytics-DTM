#!/usr/bin/env node
// =============================================================================
// preflight.mjs — Compliance + sanity gate, run BEFORE building anything.
// =============================================================================
//
// PHILOSOPHY: "Fail Loud, Never Lie" — this is a HARD GATE. It does NOT call
// Adobe. It statically inspects the blueprint and exits NON-ZERO on any
// failure. A green build is worthless if it would ship a Fair-Lending or PHI
// violation, so we refuse to proceed.
//
// USAGE:
//   node preflight.mjs <blueprint.json> [--profile financial] [--profile healthcare] ...
//
//   --profile is repeatable and is UNIONed with any compliance.profiles in the
//   blueprint itself. Recognised: healthcare | financial | general.
//
// CHECKS (every check prints PASS/FAIL; ANY fail → exit 1):
//   1. PII leakage     — any data element value / rule action setting that
//                        matches email/SSN/account-number regexes, OR a data
//                        element with piiClass != "none" that is missing a
//                        consentCategory.
//   2. Consent gating  — any analytics/advertising/personalization rule (by
//                        action category or by name) lacking a consentCategory.
//   3. Fair Lending    — (financial) any rule that uses a loan-propensity /
//                        firmographic data element (name ~ /propensit|D&B|
//                        networth|salesAnnual|walletSize/) in a targeting/
//                        advertising action without fairLendingReviewed:true on
//                        that element.
//   4. Healthcare/PHI  — (healthcare) compliance.ipObfuscation must be true,
//                        and no advertising tags/actions may run on pages
//                        flagged phi:true.
//
// Exit codes: 0 = all checks pass; 1 = at least one failure; 2 = usage error.
// =============================================================================

import process from 'node:process';
import { readFile } from 'node:fs/promises';

// -----------------------------------------------------------------------------
// Detection regexes
// -----------------------------------------------------------------------------
const PII_PATTERNS = [
  { label: 'email address', re: /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/ },
  { label: 'US SSN', re: /\b\d{3}-\d{2}-\d{4}\b/ },
  // Account/card numbers: a run of 12–19 digits, optionally space/dash grouped.
  { label: 'account/card number', re: /\b(?:\d[ -]?){12,19}\b/ },
];

const FIRMOGRAPHIC_RE = /propensit|D&B|dnb|networth|net[_-]?worth|salesAnnual|walletSize/i;

const TARGETING_CATEGORIES = new Set([
  'analytics',
  'advertising',
  'personalization',
  'targeting',
]);
const TARGETING_ACTION_TYPES = new Set([
  'sendEvent',
  'trackPageView',
  'trackEvent',
  'fireTag',
  'setTargeting',
]);
const ADVERTISING_HINT_RE = /advertis|pixel|meta|facebook|fbq|gtag|doubleclick|adwords/i;

// -----------------------------------------------------------------------------
// Reporting
// -----------------------------------------------------------------------------
const results = []; // { check, status: 'PASS'|'FAIL', detail }
function pass(check, detail = '') {
  results.push({ check, status: 'PASS', detail });
}
function fail(check, detail) {
  results.push({ check, status: 'FAIL', detail });
}

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------
function scanForPii(value) {
  // Recursively walk strings inside an object/array; return the first hit.
  const stack = [value];
  while (stack.length) {
    const v = stack.pop();
    if (v == null) continue;
    if (typeof v === 'string') {
      for (const { label, re } of PII_PATTERNS) {
        if (re.test(v)) return { label, sample: v.slice(0, 60) };
      }
    } else if (Array.isArray(v)) {
      for (const item of v) stack.push(item);
    } else if (typeof v === 'object') {
      for (const k of Object.keys(v)) {
        // Don't treat documentation keys as live config.
        if (k.startsWith('_')) continue;
        stack.push(v[k]);
      }
    }
  }
  return null;
}

function ruleCategory(rule) {
  // Highest-signal category among the rule's actions.
  const cats = (rule.actions || []).map((a) => a.category).filter(Boolean);
  for (const c of ['advertising', 'personalization', 'targeting', 'analytics']) {
    if (cats.includes(c)) return c;
  }
  return cats[0] || null;
}

function ruleIsTargeting(rule) {
  // Always-on infrastructure rules (library-loaded init, PII-scrub, consent-change
  // listener) are deliberately un-gated — they MUST run before consent state exists
  // (e.g. the rule that scrubs PII from the URL, or the one that re-reads consent on
  // change). Gating them would break the consent mechanism itself. They are exempt
  // from the consent requirement, but ONLY if they carry no analytics/advertising/
  // personalization action (an infrastructure rule that also fires a pixel is mislabeled).
  if (rule.infrastructure === true || ruleCategory(rule) === 'infrastructure') {
    const types = (rule.actions || []).map((a) => a.type);
    const cats = (rule.actions || []).map((a) => a.category);
    const looksFiring = types.some((t) => TARGETING_ACTION_TYPES.has(t)) ||
      cats.some((c) => TARGETING_CATEGORIES.has(c)) || ADVERTISING_HINT_RE.test(rule.name || '');
    if (!looksFiring) return false; // genuinely infrastructure → exempt from consent gating
    // else: flagged infrastructure but it fires a tracking action → fall through, treat as firing.
  }
  const cat = ruleCategory(rule);
  if (cat && TARGETING_CATEGORIES.has(cat)) return true;
  const types = (rule.actions || []).map((a) => a.type);
  if (types.some((t) => TARGETING_ACTION_TYPES.has(t))) return true;
  if (ADVERTISING_HINT_RE.test(rule.name || '')) return true;
  return false;
}

function dataElementsReferencedBy(rule, elementsByName) {
  // Find %data-element% references in any action/condition setting, plus
  // explicit dataElement fields on conditions.
  const referenced = new Set();
  const collectFromString = (s) => {
    const re = /%([^%]+)%/g;
    let m;
    while ((m = re.exec(s)) !== null) {
      if (elementsByName.has(m[1])) referenced.add(m[1]);
    }
  };
  const walk = (v) => {
    if (v == null) return;
    if (typeof v === 'string') collectFromString(v);
    else if (Array.isArray(v)) v.forEach(walk);
    else if (typeof v === 'object') {
      for (const k of Object.keys(v)) {
        if (k.startsWith('_')) continue;
        walk(v[k]);
      }
    }
  };
  for (const a of rule.actions || []) walk(a.settings);
  for (const c of rule.conditions || []) {
    walk(c.settings);
    if (c.dataElement && elementsByName.has(c.dataElement)) referenced.add(c.dataElement);
  }
  return [...referenced];
}

// -----------------------------------------------------------------------------
// Checks
// -----------------------------------------------------------------------------
function checkPii(bp) {
  const dataElements = bp.dataElements || [];
  let failed = false;

  for (const de of dataElements) {
    // (a) literal PII in the element's settings
    const hit = scanForPii(de.settings);
    if (hit) {
      fail(
        'PII leakage',
        `data element "${de.name}" settings contain a ${hit.label} pattern: "${hit.sample}"`,
      );
      failed = true;
    }
    // (b) classified PII without a consent category
    const piiClass = de.piiClass || 'none';
    if (piiClass !== 'none' && !de.consentCategory) {
      fail(
        'PII leakage',
        `data element "${de.name}" has piiClass="${piiClass}" but no consentCategory`,
      );
      failed = true;
    }
  }

  for (const rule of bp.rules || []) {
    for (const a of rule.actions || []) {
      const hit = scanForPii(a.settings);
      if (hit) {
        fail(
          'PII leakage',
          `rule "${rule.name}" action "${a.type}" settings contain a ${hit.label} pattern: "${hit.sample}"`,
        );
        failed = true;
      }
    }
  }

  if (!failed) {
    pass(
      'PII leakage',
      `${dataElements.length} data element(s) + rule actions scanned; no email/SSN/account patterns, no unclassified PII`,
    );
  }
}

function checkConsentGating(bp) {
  let failed = false;
  for (const rule of bp.rules || []) {
    if (!ruleIsTargeting(rule)) continue;
    const cat = rule.consentCategory;
    if (!cat) {
      fail(
        'Consent gating',
        `rule "${rule.name}" (${ruleCategory(rule) || 'targeting'}) is missing a consentCategory`,
      );
      failed = true;
    }
  }
  if (!failed) {
    pass('Consent gating', 'every analytics/advertising/personalization rule declares a consentCategory');
  }
}

function checkFairLending(bp, profiles) {
  if (!profiles.has('financial')) {
    pass('Fair Lending (financial)', 'profile not active — skipped');
    return;
  }
  const elementsByName = new Map((bp.dataElements || []).map((d) => [d.name, d]));
  let failed = false;
  let flaggedAny = false;

  for (const rule of bp.rules || []) {
    if (!ruleIsTargeting(rule)) continue;
    const refs = dataElementsReferencedBy(rule, elementsByName);
    for (const name of refs) {
      const de = elementsByName.get(name);
      const isFirmographic =
        FIRMOGRAPHIC_RE.test(name) || (de && de.piiClass === 'firmographic');
      if (!isFirmographic) continue;
      flaggedAny = true;
      if (!(de && de.fairLendingReviewed === true)) {
        fail(
          'Fair Lending (financial)',
          `rule "${rule.name}" uses firmographic/loan-propensity element "${name}" ` +
            `in a targeting/advertising action without fairLendingReviewed:true`,
        );
        failed = true;
      }
    }
  }
  if (!failed) {
    pass(
      'Fair Lending (financial)',
      flaggedAny
        ? 'all firmographic elements used in targeting are fairLendingReviewed:true'
        : 'no firmographic/loan-propensity elements used in targeting actions',
    );
  }
}

function checkHealthcare(bp, profiles) {
  if (!profiles.has('healthcare')) {
    pass('Healthcare/PHI', 'profile not active — skipped');
    return;
  }
  let failed = false;

  const ipObf = bp.compliance && bp.compliance.ipObfuscation === true;
  if (!ipObf) {
    fail('Healthcare/PHI', 'compliance.ipObfuscation must be true under the healthcare profile');
    failed = true;
  }

  // Advertising tags/actions on PHI-flagged pages.
  // A rule can be flagged phi:true directly, or via a page reference.
  const phiPages = new Set();
  for (const p of bp.pages || []) {
    if (p.phi === true && p.name) phiPages.add(p.name);
  }
  for (const rule of bp.rules || []) {
    const cat = ruleCategory(rule);
    const isAdvertising =
      cat === 'advertising' ||
      (rule.actions || []).some((a) => ADVERTISING_HINT_RE.test(a.type || '') || ADVERTISING_HINT_RE.test((a.extension || '')));
    if (!isAdvertising) continue;

    const rulePhi =
      rule.phi === true ||
      (rule.pages || []).some((pg) => phiPages.has(pg)) ||
      (rule.event && rule.event.settings && phiPages.has(rule.event.settings.page));
    if (rulePhi) {
      fail(
        'Healthcare/PHI',
        `advertising rule "${rule.name}" runs on a PHI-flagged page — not permitted`,
      );
      failed = true;
    }
  }

  if (!failed) {
    pass('Healthcare/PHI', 'ipObfuscation enabled and no advertising tags on PHI-flagged pages');
  }
}

// -----------------------------------------------------------------------------
// AboutAmazon Web SDK build — additional gates
// -----------------------------------------------------------------------------
// A generated blueprint stays "draft" while any ACDL data-layer event name is
// still the CONFIRM-VIA-EXPORT sentinel (the Launch Inspector workbook does not
// export those). A draft that reached production would verify green and collect
// nothing — hard fail here, before publish.mjs even gets the chance to refuse.
function checkDraftBlueprint(bp) {
  const unresolved = (bp.meta && bp.meta.unresolved) || [];
  if (bp.meta && bp.meta.draft) {
    fail(
      'Draft blueprint',
      `blueprint is a DRAFT with ${unresolved.length} unresolved item(s): ` +
        `${unresolved.slice(0, 3).join(' | ')}${unresolved.length > 3 ? ' | …' : ''} — ` +
        `run scripts/export-current.mjs then re-generate`,
    );
  } else {
    pass('Draft blueprint', 'blueprint is fully resolved (no CONFIRM-VIA-EXPORT sentinels)');
  }
}

// Non-blocking audit reminders: things that are legitimate to publish with, but
// leave an audit finding open. PASS with a WARN-style detail so the operator
// sees them at every gate.
function checkOpenAuditItems(bp) {
  const alloy = (bp.extensions || []).find((e) => e.name === 'adobe-alloy');
  const instance =
    alloy && alloy.settings && Array.isArray(alloy.settings.instances)
      ? alloy.settings.instances[0]
      : null;
  const notes = [];
  if (instance && /adobedc\.net$/.test(instance.edgeDomain || '')) {
    notes.push(
      `edgeDomain "${instance.edgeDomain}" is still Adobe's third-party domain — audit Fix 3 ` +
        `(first-party domain) remains OPEN until DNS + Adobe-managed cert are done (docs/MANUAL-STEPS.md #4)`,
    );
  }
  if (instance && instance.defaultConsent === 'in') {
    notes.push(
      'defaultConsent="in" preserves current ungated collection — audit Fix 4 consent architecture ' +
        'remains a roadmap item (docs/MANUAL-STEPS.md #6)',
    );
  }
  pass(
    'Open audit items',
    notes.length ? notes.join(' ;; ') : 'none — all in-property audit fixes are active',
  );
}

// -----------------------------------------------------------------------------
// Main
// -----------------------------------------------------------------------------
function parseArgs(argv) {
  const profiles = [];
  let blueprintPath = null;
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--profile') {
      const v = argv[i + 1];
      if (!v) throw new Error('--profile requires a value (healthcare|financial|general)');
      profiles.push(v.toLowerCase());
      i += 1;
    } else if (a === '--help' || a === '-h') {
      return { help: true };
    } else if (!blueprintPath) {
      blueprintPath = a;
    }
  }
  return { blueprintPath, profiles };
}

const HELP = `
preflight.mjs — static compliance + sanity gate (no Adobe calls)

Usage:
  node preflight.mjs <blueprint.json> [--profile financial] [--profile healthcare]

Exit codes: 0 = all checks pass, 1 = a check failed, 2 = usage error.
`;

async function main() {
  const argv = process.argv.slice(2);
  const args = parseArgs(argv);
  if (args.help) {
    console.log(HELP.trim());
    return 0;
  }
  if (!args.blueprintPath) {
    console.error('ERROR: a blueprint JSON path is required.');
    console.log(HELP.trim());
    return 2;
  }

  let bp;
  try {
    bp = JSON.parse(await readFile(args.blueprintPath, 'utf8'));
  } catch (err) {
    console.error(`ERROR: cannot read/parse blueprint "${args.blueprintPath}": ${err.message}`);
    return 2;
  }

  // Union of CLI profiles and blueprint compliance.profiles.
  const profiles = new Set([
    ...args.profiles,
    ...((bp.compliance && bp.compliance.profiles) || []).map((p) => String(p).toLowerCase()),
  ]);

  console.log('='.repeat(72));
  console.log('PREFLIGHT COMPLIANCE GATE');
  console.log(`Blueprint : ${args.blueprintPath}`);
  console.log(`Property  : ${(bp.property && bp.property.name) || '(unnamed)'}`);
  console.log(`Profiles  : ${profiles.size ? [...profiles].join(', ') : '(none)'}`);
  console.log('='.repeat(72));

  // Run all checks (they push into `results`).
  checkDraftBlueprint(bp);
  checkPii(bp);
  checkConsentGating(bp);
  checkFairLending(bp, profiles);
  checkHealthcare(bp, profiles);
  checkOpenAuditItems(bp);

  // Report.
  let failures = 0;
  for (const r of results) {
    const tag = r.status === 'PASS' ? 'PASS' : 'FAIL';
    console.log(`[${tag}] ${r.check}${r.detail ? ` — ${r.detail}` : ''}`);
    if (r.status === 'FAIL') failures += 1;
  }
  console.log('-'.repeat(72));

  if (failures > 0) {
    console.log(`PREFLIGHT FAILED: ${failures} check(s) failed. Build is BLOCKED.`);
    return 1;
  }
  console.log('PREFLIGHT PASSED: all checks green. Safe to proceed to build.');
  return 0;
}

const invokedDirectly =
  process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href;

if (invokedDirectly) {
  main()
    .then((code) => process.exit(code))
    .catch((err) => {
      console.error(`\nFAILED: ${err.message}`);
      process.exit(1);
    });
}

// Exported for programmatic use / testing by sibling scripts.
export {
  checkPii,
  checkConsentGating,
  checkFairLending,
  checkHealthcare,
  results as _results,
};
