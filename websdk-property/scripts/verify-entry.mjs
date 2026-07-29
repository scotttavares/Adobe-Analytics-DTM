#!/usr/bin/env node
// =============================================================================
// verify-entry.mjs — machine-check the hand-entered property against the blueprint
// =============================================================================
//
// The build sheet is entered by a human; humans typo. This script reads the NEW
// property back through the Reactor API and diffs what actually exists against
// blueprint/aboutamazon-websdk.blueprint.json — the same artifact the sheet was
// rendered from — so manual entry gets the same verification a publish.mjs run
// would. READ-ONLY: GET requests only.
//
// USAGE:
//   node scripts/verify-entry.mjs [--blueprint blueprint/aboutamazon-websdk.blueprint.json]
//                                 [--property-name "AboutAmazon-US (WebSDK)"]
//                                 [--company-id COxxxx]
//
// REQUIRED ENV: REACTOR_CLIENT_ID, REACTOR_CLIENT_SECRET, REACTOR_ORG_ID,
//               REACTOR_SCOPES (see reactor.mjs header / RUNBOOK Phase 0).
//
// Exit codes: 0 = no failures (warnings allowed), 1 = at least one FAIL.
//
// Comparison philosophy (mirrors "Fail Loud, Never Lie" without crying wolf):
//   FAIL  — a difference that changes behavior: missing resource, wrong event
//           name, wrong delegate, payload field mismatch, custom-code drift.
//   WARN  — likely fine but a human should glance: UI-generated cacheId differs
//           from the blueprint's deterministic one (internal consistency is
//           checked instead), extra settings keys the UI added, extra live
//           resources the blueprint doesn't know.
//   INFO  — shape learnings (e.g. the ACDL event settings key layout) recorded
//           so the blueprint/generator can be tightened later.
// =============================================================================

import process from 'node:process';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { getAll, listProperties, listDataElements, listRules, listRuleComponents } from './reactor.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');

function parseArgs(argv) {
  const values = {};
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith('--')) {
        values[a.slice(2)] = next;
        i += 1;
      } else values[a.slice(2)] = true;
    }
  }
  return values;
}

function parseSettings(raw) {
  if (raw === null || raw === undefined) return {};
  if (typeof raw === 'object') return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return { _unparseable: String(raw) };
  }
}

const findings = { fail: [], warn: [], info: [] };
const fail = (msg) => findings.fail.push(msg);
const warn = (msg) => findings.warn.push(msg);
const info = (msg) => findings.info.push(msg);

// Normalize code for comparison: kill CRLF and trailing whitespace per line —
// the editor the human pasted into may differ from the file's line endings.
const normCode = (s) =>
  String(s ?? '')
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((l) => l.replace(/\s+$/, ''))
    .join('\n')
    .trim();

function firstCodeDiff(a, b) {
  const A = normCode(a).split('\n');
  const B = normCode(b).split('\n');
  for (let i = 0; i < Math.max(A.length, B.length); i += 1) {
    if (A[i] !== B[i]) return { line: i + 1, expected: A[i] ?? '(end)', actual: B[i] ?? '(end)' };
  }
  return null;
}

const deepEqual = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const shortName = (delegateId) => String(delegateId || '').split('::').pop();

// Rewrite live references back to blueprint form so both sides speak "names":
// live dataElementId "DExxxx" → "RESOLVE-DE-ID:<name>".
function makeRefRewriter(deIdToName) {
  return (value) => {
    if (typeof value !== 'string') return value;
    const name = deIdToName.get(value);
    return name ? `RESOLVE-DE-ID:${name}` : value;
  };
}

// Blueprint settings must be honored by the live settings; extra live keys are
// UI defaults, reported once as WARN per resource, not per key.
function compareSettingsSubset(where, bpSettings, liveSettings, opts = {}) {
  const soft = new Set(opts.softKeys || []);
  const skip = new Set(opts.skipKeys || []);
  const rewrite = opts.rewrite || ((v) => v);
  for (const [k, v] of Object.entries(bpSettings || {})) {
    if (skip.has(k)) continue;
    const liveV = liveSettings ? liveSettings[k] : undefined;
    if (k === 'source') {
      const d = firstCodeDiff(v, liveV);
      if (d) fail(`${where}: custom code differs at line ${d.line} — expected \`${d.expected}\` got \`${d.actual}\``);
      continue;
    }
    const a = typeof v === 'string' ? v : JSON.parse(JSON.stringify(v));
    const b = typeof liveV === 'string' ? rewrite(liveV) : liveV;
    if (deepEqual(a, b)) continue;
    if (soft.has(k)) {
      warn(`${where}: "${k}" differs (blueprint ${JSON.stringify(a)} vs live ${JSON.stringify(b)}) — allowed, see cacheId note`);
    } else {
      fail(`${where}: "${k}" mismatch — blueprint ${JSON.stringify(a)} vs live ${JSON.stringify(b)}`);
    }
  }
  const extras = Object.keys(liveSettings || {}).filter((k) => !(k in (bpSettings || {})));
  if (extras.length) warn(`${where}: live has extra settings keys the blueprint does not pin: ${extras.join(', ')}`);
}

// The Update variable action's payload is THE thing the manual pass most often
// typos. Deep-compare data.__adobe.analytics field by field, after rewriting
// the live dataElementId to a name.
function compareUpdateVariable(where, bp, live, rewrite, liveDeByName) {
  compareSettingsSubset(where, { dataElementId: bp.dataElementId }, { dataElementId: rewrite(live.dataElementId) });
  const bpA = bp.data?.__adobe?.analytics || {};
  const liveA = live.data?.__adobe?.analytics || {};
  for (const [k, v] of Object.entries(bpA)) {
    if (!(k in liveA)) fail(`${where}: analytics field "${k}" missing (expected \`${JSON.stringify(v)}\`)`);
    else if (!deepEqual(v, liveA[k])) fail(`${where}: analytics field "${k}" — blueprint ${JSON.stringify(v)} vs live ${JSON.stringify(liveA[k])}`);
  }
  for (const k of Object.keys(liveA)) {
    if (!(k in bpA)) fail(`${where}: analytics field "${k}" present in live but NOT in the blueprint (stray entry)`);
  }
  // cacheId: the UI may generate its own; what MUST hold is internal
  // consistency — the action's dataElementCacheId equals the Variable
  // element's own cacheId, or the update silently misses its target.
  const refName = (rewrite(live.dataElementId) || '').replace('RESOLVE-DE-ID:', '');
  const varDe = liveDeByName.get(refName);
  const varCacheId = varDe ? parseSettings(varDe.attributes.settings).cacheId : undefined;
  if (varCacheId && live.dataElementCacheId && varCacheId !== live.dataElementCacheId) {
    fail(`${where}: dataElementCacheId (${live.dataElementCacheId}) does not match variable "${refName}" cacheId (${varCacheId}) — the update will not apply`);
  }
  if (bp.transforms && bp.transforms.length && !(live.transforms && live.transforms.length)) {
    warn(`${where}: blueprint expects clear/remove transforms but live has none — residue risk (RUNBOOK Phase 4 residue test)`);
  }
}

async function main() {
  const values = parseArgs(process.argv.slice(2));
  const bpPath = values.blueprint || join(ROOT, 'blueprint', 'aboutamazon-websdk.blueprint.json');
  const bp = JSON.parse(await readFile(bpPath, 'utf8'));
  if (bp.meta && bp.meta.draft) {
    console.error('REFUSED: blueprint is a draft — resolve it and re-generate before verifying entry against it.');
    process.exit(1);
  }
  const propertyName = values['property-name'] || bp.property.name;

  // ---- fetch live -----------------------------------------------------------
  const companies = values['company-id'] ? [{ id: values['company-id'] }] : await getAll('/companies');
  let property = null;
  for (const c of companies) {
    const props = await listProperties(c.id);
    property = props.find((p) => p.attributes.name === propertyName);
    if (property) break;
  }
  if (!property) {
    console.error(`FAIL: property "${propertyName}" not found in any visible company.`);
    process.exit(1);
  }
  console.log(`Property : ${propertyName} (${property.id})`);

  const liveDes = await listDataElements(property.id);
  const liveRules = await listRules(property.id);
  console.log(`Live     : ${liveDes.length} data elements, ${liveRules.length} rules`);
  console.log(`Blueprint: ${bp.dataElements.length} data elements, ${bp.rules.length} rules`);

  const liveDeByName = new Map(liveDes.map((d) => [d.attributes.name, d]));
  const deIdToName = new Map(liveDes.map((d) => [d.id, d.attributes.name]));
  const rewrite = makeRefRewriter(deIdToName);

  // ---- data elements --------------------------------------------------------
  for (const de of bp.dataElements) {
    const live = liveDeByName.get(de.name);
    if (!live) {
      fail(`data element "${de.name}": MISSING`);
      continue;
    }
    const where = `data element "${de.name}"`;
    if (shortName(live.attributes.delegate_descriptor_id) !== shortName(de.delegate_descriptor_id)) {
      fail(`${where}: wrong TYPE — expected ${de.delegate_descriptor_id}, live ${live.attributes.delegate_descriptor_id}`);
      continue;
    }
    compareSettingsSubset(where, de.settings, parseSettings(live.attributes.settings), {
      softKeys: ['cacheId'],
      rewrite,
    });
    const attrPairs = [
      ['forceLowerCase', 'force_lower_case'],
      ['cleanText', 'clean_text'],
      ['storageDuration', 'storage_duration'],
      ['defaultValue', 'default_value'],
    ];
    for (const [bpKey, liveKey] of attrPairs) {
      if (de[bpKey] === undefined || de[bpKey] === null) continue;
      const liveV = live.attributes[liveKey];
      if (!deepEqual(de[bpKey], liveV)) fail(`${where}: ${liveKey} — blueprint ${JSON.stringify(de[bpKey])} vs live ${JSON.stringify(liveV)}`);
    }
  }
  const bpDeNames = new Set(bp.dataElements.map((d) => d.name));
  for (const d of liveDes) {
    if (!bpDeNames.has(d.attributes.name)) warn(`data element "${d.attributes.name}": exists live but not in the blueprint`);
  }

  // ---- rules ----------------------------------------------------------------
  const liveRuleByName = new Map(liveRules.map((r) => [r.attributes.name, r]));
  for (const rule of bp.rules) {
    const live = liveRuleByName.get(rule.name);
    if (!live) {
      fail(`rule "${rule.name}": MISSING`);
      continue;
    }
    if (live.attributes.enabled === false) warn(`rule "${rule.name}": exists but is DISABLED`);
    const comps = await listRuleComponents(live.id);
    const kind = (c) => (c.attributes.delegate_descriptor_id.includes('::events::') ? 'event' : c.attributes.delegate_descriptor_id.includes('::conditions::') ? 'condition' : 'action');
    const events = comps.filter((c) => kind(c) === 'event');
    const actions = comps.filter((c) => kind(c) === 'action').sort((a, b) => (a.attributes.order ?? 0) - (b.attributes.order ?? 0));

    // Event: delegate type must match; for ACDL "Data Pushed" the settings key
    // layout is the live extension's to define — require the event NAME (and
    // time scope when we pin one) to appear among the values, record the shape.
    if (events.length !== 1) {
      fail(`rule "${rule.name}": expected exactly 1 event, live has ${events.length}`);
    } else {
      const ev = events[0];
      const where = `rule "${rule.name}" event`;
      if (shortName(ev.attributes.delegate_descriptor_id) !== shortName(rule.event.delegate_descriptor_id)) {
        fail(`${where}: wrong type — expected ${rule.event.delegate_descriptor_id}, live ${ev.attributes.delegate_descriptor_id}`);
      } else {
        const liveS = parseSettings(ev.attributes.settings);
        const liveVals = Object.values(liveS).map((v) => String(v));
        const wantName = rule.event.settings && rule.event.settings.event;
        if (wantName) {
          if (!liveVals.includes(String(wantName))) {
            fail(`${where}: event name "${wantName}" not present in live settings ${JSON.stringify(liveS)}`);
          }
          const scope = rule.event.timeScope || 'all';
          if (!liveVals.map((v) => v.toLowerCase()).includes(scope)) {
            warn(`${where}: time scope "${scope}" not visible in live settings ${JSON.stringify(liveS)} — confirm the Time scope radio`);
          }
          info(`${where}: live ACDL settings shape = ${JSON.stringify(liveS)}`);
        } else {
          compareSettingsSubset(where, rule.event.settings, liveS, { rewrite });
        }
      }
    }

    // Actions: same count, same order of types, then per-type comparison.
    const bpActions = rule.actions || [];
    if (actions.length !== bpActions.length) {
      fail(`rule "${rule.name}": expected ${bpActions.length} action(s), live has ${actions.length}`);
      continue;
    }
    bpActions.forEach((bpA, i) => {
      const liveA = actions[i];
      const where = `rule "${rule.name}" action ${i + 1} (${shortName(bpA.delegate_descriptor_id)})`;
      if (shortName(liveA.attributes.delegate_descriptor_id) !== shortName(bpA.delegate_descriptor_id)) {
        fail(`${where}: order/type mismatch — live has ${shortName(liveA.attributes.delegate_descriptor_id)} in this slot (Update variable MUST precede Send event)`);
        return;
      }
      const liveS = parseSettings(liveA.attributes.settings);
      if (shortName(bpA.delegate_descriptor_id) === 'update-variable') {
        compareUpdateVariable(where, bpA.settings, { ...liveS, dataElementId: liveS.dataElementId }, rewrite, liveDeByName);
      } else {
        compareSettingsSubset(where, bpA.settings, liveS, { rewrite, softKeys: ['dataElementCacheId'] });
      }
    });
  }
  const bpRuleNames = new Set(bp.rules.map((r) => r.name));
  for (const r of liveRules) {
    if (!bpRuleNames.has(r.attributes.name)) warn(`rule "${r.attributes.name}": exists live but not in the blueprint`);
  }

  // ---- report ---------------------------------------------------------------
  const section = (title, list, mark) => {
    if (!list.length) return;
    console.log(`\n${title} (${list.length})`);
    for (const m of list) console.log(`  ${mark} ${m}`);
  };
  section('FAILURES', findings.fail, '✗');
  section('WARNINGS', findings.warn, '~');
  section('INFO', findings.info, 'i');
  console.log('\n' + '='.repeat(72));
  if (findings.fail.length) {
    console.log(`VERIFY FAILED: ${findings.fail.length} failure(s), ${findings.warn.length} warning(s). Fix in the UI, re-run.`);
    process.exit(1);
  }
  console.log(`VERIFY PASSED: 0 failures, ${findings.warn.length} warning(s), ${findings.info.length} info. Manual entry matches the blueprint.`);
}

main().catch((err) => {
  console.error(`verify-entry failed: ${err.stack || err}`);
  process.exit(1);
});
