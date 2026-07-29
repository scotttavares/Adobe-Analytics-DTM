#!/usr/bin/env node
// =============================================================================
// generate-blueprint.mjs — catalog → blueprint generator (the Finding 9 fix)
// =============================================================================
//
// The source property duplicated one XDM payload shape across ~25 hand-edited
// data elements; the audit (Finding 9) recommends a shared-builder pattern.
// This script IS that pattern applied at authoring time: every payload data
// element and every rule is emitted from ONE template, driven by
// catalog/events-catalog.json. Nobody copy-pastes a payload again — you add a
// catalog entry and re-generate. Drift becomes structurally impossible.
//
// USAGE:
//   node scripts/generate-blueprint.mjs [--out blueprint/aboutamazon-websdk.blueprint.json]
//        [--overrides catalog/acdl-events.overrides.json]
//        [--company-id COxxxx]
//        [--interim-third-party-edge]
//
// The blueprint is emitted as a DRAFT (meta.draft=true, publish.mjs refuses it)
// until every rule's Adobe Client Data Layer event name is resolved — the
// Launch Inspector workbook this build is derived from does not export which
// data-layer event each listener subscribes to. Run scripts/export-current.mjs
// against the existing AboutAmazon-US property to produce the overrides file
// with the real event settings, then re-run this generator.
//
// No credentials are needed to run this script — it is a pure local transform.
// =============================================================================

import process from 'node:process';
import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const SENTINEL = 'CONFIRM-VIA-EXPORT';

// -----------------------------------------------------------------------------
// Args
// -----------------------------------------------------------------------------
function parseArgs(argv) {
  const out = { flags: {}, values: {} };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const key = a.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) out.flags[key] = true;
    else {
      out.values[key] = next;
      i += 1;
    }
  }
  return out;
}

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

async function readJsonOptional(path) {
  try {
    return await readJson(path);
  } catch (err) {
    if (err.code === 'ENOENT') return null;
    throw err;
  }
}

// -----------------------------------------------------------------------------
// Payload emission — ONE template for every event payload
// -----------------------------------------------------------------------------
// Payloads use the Web SDK `data.__adobe.analytics` object (the documented
// AppMeasurement-migration path recommended by the audit, deck slide 28): plain
// AppMeasurement variable names, no XDM schema required. Values are set only
// when non-empty so beacons stay clean.
const HELPERS = `var base = _satellite.getVar("data-analyticsBase") || { __adobe: { analytics: {} } };
var a = base.__adobe.analytics;
var events = [];
function set(key, deName) {
  var v = _satellite.getVar(deName);
  if (v !== undefined && v !== null && v !== "") a[key] = v;
}
function setConst(key, value) { a[key] = value; }
function ev(name, valueFrom) {
  if (valueFrom) {
    var v = _satellite.getVar(valueFrom);
    if (v !== undefined && v !== null && v !== "") events.push(name + "=" + v);
  } else {
    events.push(name);
  }
}
function listVar(key, deName) {
  var v = _satellite.getVar(deName);
  if (v !== undefined && v !== null && v !== "") a[key] = v;
}`;

function emitAnalyticsLines(spec) {
  const lines = [];
  const scalar = (key, from) => {
    if (from === undefined || from === null) return;
    if (typeof from === 'object' && from.constant !== undefined) {
      lines.push(`setConst(${JSON.stringify(key)}, ${JSON.stringify(from.constant)});`);
    } else {
      lines.push(`set(${JSON.stringify(key)}, ${JSON.stringify(from)});`);
    }
  };
  scalar('pageName', spec.pageName);
  scalar('channel', spec.channel);
  scalar('pageURL', spec.pageURL);
  scalar('referrer', spec.referrer);
  scalar('campaign', spec.campaign);
  for (const [evar, from] of Object.entries(spec.eVars || {})) scalar(evar, from);
  for (const [prop, from] of Object.entries(spec.props || {})) scalar(prop, from);
  for (const [listKey, sources] of Object.entries(spec.lists || {})) {
    for (const from of sources) lines.push(`listVar(${JSON.stringify(listKey)}, ${JSON.stringify(from)});`);
  }
  for (const e of spec.events || []) {
    if (e.valueFrom) lines.push(`ev(${JSON.stringify(e.event)}, ${JSON.stringify(e.valueFrom)});`);
    else lines.push(`ev(${JSON.stringify(e.event)});`);
  }
  return lines;
}

function emitPayloadSource(header, spec, link) {
  const body = [];
  if (link) {
    body.push(`setConst("linkName", ${JSON.stringify(link.linkName)});`);
    body.push(`setConst("linkType", ${JSON.stringify(link.linkType)});`);
  }
  body.push(...emitAnalyticsLines(spec));
  body.push('if (events.length) a.events = events.join(",");');
  body.push('return base;');
  return [
    `// GENERATED by scripts/generate-blueprint.mjs from catalog/events-catalog.json — DO NOT HAND-EDIT.`,
    `// ${header}`,
    HELPERS,
    '',
    ...body,
  ].join('\n');
}

// Consolidated architecture: ONE dispatcher data element for all interactions.
// The mapping table is generated from the catalog and keyed by the ACDL event
// name that triggers each rule. The triggering event object is read
// defensively (the ACDL extension's event shape is closed-source; verify once
// on a dev build); an unmapped or unreadable event is reported as
// linkName "unmapped: <event>" so misses are VISIBLE in reporting, not silent.
function emitInteractionDispatcher(interactions, keyForRule) {
  const entries = interactions.map((it) => {
    const key = keyForRule(it);
    const m = {
      n: it.linkName,
      t: it.linkType,
      ev: (it.events || []).map((e) => (e.valueFrom ? [e.event, e.valueFrom] : [e.event])),
      vars: it.eVars || {},
    };
    if (it.lists) m.lists = it.lists;
    return `  ${JSON.stringify(key)}: ${JSON.stringify(m)}`;
  });
  return [
    '// GENERATED by scripts/generate-blueprint.mjs from catalog/events-catalog.json — DO NOT HAND-EDIT.',
    '// Consolidated interaction dispatcher: one element serves every interaction rule.',
    '// Keys are the adobeDataLayer event names each rule listens for.',
    'var MAPPINGS = {',
    entries.join(',\n'),
    '};',
    'var base = _satellite.getVar("data-analyticsBase") || { __adobe: { analytics: {} } };',
    'var a = base.__adobe.analytics;',
    '// Resolve the triggering data layer event name from the rule event context.',
    '// Verify the working property once on a dev build (see build sheet note).',
    'var name = "";',
    'if (typeof event !== "undefined" && event) {',
    '  var msg = event.message || event.detail || event.dataLayer || event;',
    '  if (msg && typeof msg.event === "string") name = msg.event;',
    '  else if (typeof event.eventName === "string") name = event.eventName;',
    '}',
    'var map = MAPPINGS[name];',
    'if (!map) {',
    '  // Loud failure: shows up in Custom Links as "unmapped: …" instead of vanishing.',
    '  a.linkName = "unmapped: " + (name || "(event name unreadable)");',
    '  a.linkType = "o";',
    '  return base;',
    '}',
    'a.linkName = map.n;',
    'a.linkType = map.t;',
    'var events = [];',
    '(map.ev || []).forEach(function (e) {',
    '  if (e.length > 1) {',
    '    var v = _satellite.getVar(e[1]);',
    '    if (v !== undefined && v !== null && v !== "") events.push(e[0] + "=" + v);',
    '  } else {',
    '    events.push(e[0]);',
    '  }',
    '});',
    'if (events.length) a.events = events.join(",");',
    'Object.keys(map.vars || {}).forEach(function (k) {',
    '  var v = _satellite.getVar(map.vars[k]);',
    '  if (v !== undefined && v !== null && v !== "") a[k] = v;',
    '});',
    'Object.keys(map.lists || {}).forEach(function (k) {',
    '  var vals = map.lists[k].map(function (deName) { return _satellite.getVar(deName); })',
    '    .filter(function (v) { return v !== undefined && v !== null && v !== ""; });',
    '  if (vals.length) a[k] = vals.join(",");',
    '});',
    'return base;',
  ].join('\n');
}

// -----------------------------------------------------------------------------
// Main
// -----------------------------------------------------------------------------
async function main() {
  const { flags, values } = parseArgs(process.argv.slice(2));

  const property = await readJson(join(ROOT, 'catalog', 'property.json'));
  const deCatalog = await readJson(join(ROOT, 'catalog', 'data-elements.catalog.json'));
  const events = await readJson(join(ROOT, 'catalog', 'events-catalog.json'));
  const overridesPath = values.overrides || join(ROOT, 'catalog', 'acdl-events.overrides.json');
  const overrides = (await readJsonOptional(overridesPath)) || { rules: {} };

  const unresolved = [];
  const arch = flags['per-event']
    ? 'per-event'
    : flags.consolidated
      ? 'consolidated'
      : property.payloadArchitecture || 'adobe-variable';

  // Deterministic cacheId per variable name — stable across regenerations so
  // re-runs never mint a "new" variable identity.
  const stableCacheId = (name) => {
    const h = createHash('sha256').update(`aan-websdk-variable:${name}`).digest('hex');
    return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`;
  };

  // Build the __adobe.analytics form object for an Update Variable action from
  // a catalog analytics spec. Values are %DE% tokens or constants — exactly
  // what the form-based UI stores.
  function analyticsFormObject(spec, link) {
    const out = {};
    const scalar = (key, from) => {
      if (from === undefined || from === null) return;
      if (typeof from === 'object' && from.constant !== undefined) out[key] = from.constant;
      else out[key] = `%${from}%`;
    };
    if (link) {
      out.linkName = link.linkName;
      out.linkType = link.linkType;
    }
    scalar('pageName', spec.pageName);
    scalar('channel', spec.channel);
    scalar('pageURL', spec.pageURL);
    scalar('referrer', spec.referrer);
    scalar('campaign', spec.campaign);
    for (const [k, v] of Object.entries(spec.eVars || {})) scalar(k, v);
    for (const [k, v] of Object.entries(spec.props || {})) scalar(k, v);
    for (const [k, sources] of Object.entries(spec.lists || {})) {
      out[k] = sources.map((s) => `%${s}%`).join(',');
    }
    const evs = [];
    for (const e of spec.events || []) {
      if (e.valueFrom) evs.push(`${e.event}=%${e.valueFrom}%`);
      else evs.push(e.event);
    }
    if (evs.length) out.events = evs.join(',');
    return out;
  }

  function updateVariableAction(variableName, dataObj) {
    return {
      extension: 'adobe-alloy',
      delegate_descriptor_id: 'adobe-alloy::actions::update-variable',
      delegateDisplayName: 'Update variable',
      category: 'analytics',
      settings: {
        dataElementId: `RESOLVE-DE-ID:${variableName}`,
        dataElementCacheId: stableCacheId(variableName),
        data: { __adobe: { analytics: dataObj } },
      },
    };
  }
  // Verified against the live old property 2026-07-29: the ACDL event type's
  // display name is "Data Pushed" (the Launch Inspector workbook had labeled
  // it "Datalayer Push Listener"). The delegate id below is derived from that
  // display name; publish.mjs still resolves by display name against the live
  // extension package as the safety net.
  const acdlDelegateDefault = {
    delegate_descriptor_id: 'adobe-client-data-layer::events::data-pushed',
    delegateDisplayName: 'Data Pushed',
  };

  // The plain event-name string for a rule (dispatcher key). Overrides win,
  // then the catalog value; null when still unresolved.
  function eventNameFor(ruleName, catalogValue) {
    const o = overrides.rules && overrides.rules[ruleName];
    if (o && o.settings) {
      const s = o.settings;
      const cand = s.event || s.eventName || s.name;
      if (typeof cand === 'string' && cand) return cand;
    }
    if (catalogValue && catalogValue !== SENTINEL) return catalogValue;
    return null;
  }

  // Resolve each rule's ACDL event: exact settings from the overrides file win;
  // otherwise emit the sentinel and mark the blueprint draft.
  function acdlEventFor(ruleName, catalogValue, timeScope) {
    const scope = timeScope || 'all';
    const o = overrides.rules && overrides.rules[ruleName];
    if (o && o.settings) {
      return {
        extension: 'adobe-client-data-layer',
        delegate_descriptor_id: o.delegate_descriptor_id || acdlDelegateDefault.delegate_descriptor_id,
        delegateDisplayName: acdlDelegateDefault.delegateDisplayName,
        settings: o.settings,
        timeScope: scope,
      };
    }
    if (!catalogValue || catalogValue === SENTINEL) {
      unresolved.push(`rule "${ruleName}": ACDL event name/settings (${SENTINEL})`);
      return {
        extension: 'adobe-client-data-layer',
        ...acdlDelegateDefault,
        settings: { event: SENTINEL },
        timeScope: scope,
      };
    }
    return {
      extension: 'adobe-client-data-layer',
      ...acdlDelegateDefault,
      settings: { event: catalogValue },
      timeScope: scope,
    };
  }

  // ---------------------------------------------------------------- extensions
  const edgeDomain = flags['interim-third-party-edge']
    ? 'edge.adobedc.net'
    : property.webSdkInstance.edgeDomain;
  if (!flags['interim-third-party-edge'] && /TBD/i.test(edgeDomain)) {
    unresolved.push(
      'webSdkInstance.edgeDomain is a placeholder — complete the first-party domain setup ' +
        '(docs/MANUAL-STEPS.md #4) or generate with --interim-third-party-edge to launch on edge.adobedc.net',
    );
  }

  const alloySettings = {
    instances: [
      {
        name: property.webSdkInstance.name,
        edgeConfigId: property.datastreams.production,
        stagingEdgeConfigId: property.datastreams.staging,
        developmentEdgeConfigId: property.datastreams.development,
        orgId: property.orgId,
        edgeDomain,
        edgeBasePath: property.webSdkInstance.edgeBasePath,
        defaultConsent: property.webSdkInstance.defaultConsent,
        idMigrationEnabled: property.webSdkInstance.idMigrationEnabled,
        thirdPartyCookiesEnabled: property.webSdkInstance.thirdPartyCookiesEnabled,
        targetMigrationEnabled: property.webSdkInstance.targetMigrationEnabled,
        prehidingStyle: property.webSdkInstance.prehidingStyle,
        clickCollectionEnabled: property.webSdkInstance.clickCollectionEnabled,
        context: property.webSdkInstance.context,
      },
    ],
  };

  const extensions = property.extensions.installed.map((e) => {
    const out = { name: e.name, displayName: e.displayName };
    if (e.name === 'adobe-alloy') out.settings = alloySettings;
    else if (e.settings) out.settings = e.settings;
    return out;
  });

  // ------------------------------------------------------------- data elements
  const delegates = deCatalog.delegates;
  const dataElements = [];

  for (const de of deCatalog.dataElements) {
    const d = delegates[de.delegate];
    if (!d) throw new Error(`No delegate mapping for catalog key "${de.delegate}" (${de.name})`);
    let settings = de.settings;
    if (de.delegate === 'acdl-computed-state') {
      // The ACDL computed-state data element reads a data layer path. Key name
      // ("path") is validated/resolved against the live extension schema by
      // publish.mjs; the path VALUE below is exact from the source property.
      settings = { path: de.settings.dataLayerPath };
    }
    if (de.delegate === 'core-custom-code') {
      settings = { source: de.settings.source };
    }
    const entry = {
      name: de.name,
      extension: d.extension,
      delegate_descriptor_id: d.delegate_descriptor_id,
      settings,
      forceLowerCase: de.forceLowerCase,
      cleanText: de.cleanText,
      storageDuration: de.storageDuration ?? null,
    };
    if (d.displayName) entry.delegateDisplayName = d.displayName;
    if (de.defaultValue !== undefined && de.defaultValue !== null) entry.defaultValue = de.defaultValue;
    if (de.decision) entry._decision = de.decision;
    if (de.name === 'LoginID') {
      entry.piiClass = 'pseudonymous';
      entry.consentCategory = 'C0002';
    }
    dataElements.push(entry);
  }

  // Shared payload skeleton — only for the generated-code architectures. Under
  // adobe-variable, the Variable data element natively provides the fresh
  // correctly-shaped container, so no skeleton element exists.
  if (arch !== 'adobe-variable') {
    dataElements.push({
      name: 'data-analyticsBase',
      extension: 'core',
      delegate_descriptor_id: 'core::dataElements::custom-code',
      settings: {
        source: [
          '// GENERATED — shared payload skeleton every data-* builder starts from (Finding 9 fix).',
          '// Common fields shared by ALL events belong here (and only here).',
          'return { __adobe: { analytics: {} } };',
        ].join('\n'),
      },
      forceLowerCase: false,
      cleanText: false,
      storageDuration: null,
    });
  }

  // Consent mapping for the set-consent rule.
  if (property.consentRule && property.consentRule.enabled) {
    dataElements.push({
      name: property.consentRule.generalValueDataElement,
      extension: 'core',
      delegate_descriptor_id: 'core::dataElements::custom-code',
      settings: {
        source: [
          '// GENERATED — maps the site cookie-consent selection to the Web SDK consent value.',
          '// DECISION (docs/MANUAL-STEPS.md #6): confirm the real consentSelected values pushed',
          '// by the site banner; explicit opt-out strings map to "out", everything else to "in".',
          'var sel = (_satellite.getVar("Consent Selected") || "").toString().toLowerCase();',
          'var optOut = ["reject", "rejected", "decline", "declined", "opt-out", "optout", "opt out", "no", "false", "out"];',
          'return optOut.indexOf(sel) !== -1 ? "out" : "in";',
        ].join('\n'),
      },
      forceLowerCase: false,
      cleanText: false,
      storageDuration: null,
    });
  }

  // Generated payloads: page view, site error, and the interactions. Under
  // adobe-variable these are Web SDK VARIABLE elements (Data object, Analytics
  // solution) — the values are set by form-based Update Variable actions in
  // the rules. Under the code architectures they are custom-code builders.
  const pv = events.pageView;
  const se = events.siteError;

  if (arch === 'adobe-variable') {
    for (const varName of [pv.payloadDataElement, 'data-interaction', se.payloadDataElement]) {
      dataElements.push({
        name: varName,
        extension: 'adobe-alloy',
        delegate_descriptor_id: 'adobe-alloy::dataElements::variable',
        delegateDisplayName: 'Variable',
        settings: { cacheId: stableCacheId(varName), solutions: ['analytics'] },
        forceLowerCase: false,
        cleanText: false,
        storageDuration: null,
      });
    }
  } else {
    dataElements.push({
      name: pv.payloadDataElement,
      extension: 'core',
      delegate_descriptor_id: 'core::dataElements::custom-code',
      settings: {
        source: emitPayloadSource(
          `Page view payload (replaces "${pv.replaces}") — Analytics mapping is byte-for-byte the source property's.`,
          pv.analytics,
        ),
      },
      forceLowerCase: false,
      cleanText: false,
      storageDuration: null,
    });

    dataElements.push({
      name: se.payloadDataElement,
      extension: 'core',
      delegate_descriptor_id: 'core::dataElements::custom-code',
      settings: {
        source: emitPayloadSource(
          `Site error page view payload (replaces "${se.replaces}").`,
          se.analytics,
        ),
      },
      forceLowerCase: false,
      cleanText: false,
      storageDuration: null,
    });
  }

  if (arch === 'per-event') {
    for (const it of events.interactions) {
      dataElements.push({
        name: it.payloadDataElement,
        extension: 'core',
        delegate_descriptor_id: 'core::dataElements::custom-code',
        settings: {
          source: emitPayloadSource(
            `Interaction payload "${it.linkName}" (replaces "${it.replaces}").`,
            { eVars: it.eVars, events: it.events, lists: it.lists },
            { linkName: it.linkName, linkType: it.linkType },
          ),
        },
        forceLowerCase: false,
        cleanText: false,
        storageDuration: null,
      });
    }
  } else if (arch === 'consolidated') {
    // Consolidated: one dispatcher element for all interactions, keyed by the
    // ACDL event name. Unresolvable keys keep the blueprint in draft state.
    const keyForRule = (it) => {
      const name = eventNameFor(it.rule, it.acdlEvent);
      if (name) return name;
      unresolved.push(
        `dispatcher key for rule "${it.rule}": ACDL event name unknown (${SENTINEL}) — ` +
          `set acdlEvent in events-catalog.json or supply the overrides file`,
      );
      return `${SENTINEL}::${it.rule}`;
    };
    dataElements.push({
      name: 'data-interaction',
      extension: 'core',
      delegate_descriptor_id: 'core::dataElements::custom-code',
      settings: { source: emitInteractionDispatcher(events.interactions, keyForRule) },
      forceLowerCase: false,
      cleanText: false,
      storageDuration: null,
    });
  }

  // --------------------------------------------------------------------- rules
  const rules = [];

  // Page view: the Option 1 consolidation — ONE request that both decides
  // (renderDecisions for Target via the datastream) and measures (Analytics via
  // the same datastream). Replaces the source property's separate
  // "All Pages - Library Loaded" at.js chain AND its Web SDK page-view send.
  const pvSendEvent = {
    extension: 'adobe-alloy',
    delegate_descriptor_id: 'adobe-alloy::actions::send-event',
    category: 'personalization',
    settings: {
      instanceName: property.webSdkInstance.name,
      renderDecisions: true,
      type: pv.xdmEventType,
      data: `%${pv.payloadDataElement}%`,
    },
  };
  const pvActions =
    arch === 'adobe-variable'
      ? [
          updateVariableAction(
            pv.payloadDataElement,
            analyticsFormObject({
              ...pv.analytics,
              // event4 (internal campaign, valued) is deferred until the icid
              // decision lands — it has never fired in the source property
              // (its feeding element was a no-op stub), so omitting it is
              // parity. Add it as an events row with value once confirmed.
              events: (pv.analytics.events || []).filter((e) => !e.valueFrom),
            }),
          ),
          pvSendEvent,
        ]
      : [pvSendEvent];

  rules.push({
    name: pv.rule,
    consentCategory: 'C0002',
    _note:
      'Single page-view request: personalization (renderDecisions) + Analytics ride the same ' +
      'edge call — the durable fix for the audit\'s two-pathway root cause (slides 26-27).',
    event: acdlEventFor(pv.rule, pv.acdlEvent, pv.acdlTimeScope),
    conditions: [],
    actions: pvActions,
  });

  // Site error page view.
  const seSendEvent = {
    extension: 'adobe-alloy',
    delegate_descriptor_id: 'adobe-alloy::actions::send-event',
    category: 'analytics',
    settings: {
      instanceName: property.webSdkInstance.name,
      type: se.xdmEventType,
      data: `%${se.payloadDataElement}%`,
    },
  };
  rules.push({
    name: se.rule,
    consentCategory: 'C0002',
    event: acdlEventFor(se.rule, se.acdlEvent, se.acdlTimeScope),
    conditions: [],
    actions:
      arch === 'adobe-variable'
        ? [updateVariableAction(se.payloadDataElement, analyticsFormObject(se.analytics)), seSendEvent]
        : [seSendEvent],
  });

  // Interactions. adobe-variable: form-based Update Variable (this event's
  // mapping) + Send Event on the shared data-interaction variable.
  // consolidated: single Send Event on the code dispatcher. per-event: single
  // Send Event on that event's own code element.
  for (const it of events.interactions) {
    const sendEvent = {
      extension: 'adobe-alloy',
      delegate_descriptor_id: 'adobe-alloy::actions::send-event',
      category: 'analytics',
      settings: {
        instanceName: property.webSdkInstance.name,
        type: 'web.webinteraction.linkClicks',
        data: arch === 'per-event' ? `%${it.payloadDataElement}%` : '%data-interaction%',
      },
    };
    const actions =
      arch === 'adobe-variable'
        ? [
            updateVariableAction(
              'data-interaction',
              analyticsFormObject(
                { eVars: it.eVars, events: it.events, lists: it.lists },
                { linkName: it.linkName, linkType: it.linkType },
              ),
            ),
            sendEvent,
          ]
        : [sendEvent];
    rules.push({
      name: it.rule,
      consentCategory: 'C0002',
      event: acdlEventFor(it.rule, it.acdlEvent, it.acdlTimeScope),
      conditions: [],
      actions,
    });
  }

  // Consent application rule (Fix 4 groundwork). Infrastructure: it must run
  // regardless of consent state — it IS the consent mechanism.
  if (property.consentRule && property.consentRule.enabled) {
    const ruleName = 'Consent - Apply Visitor Choice';
    rules.push({
      name: ruleName,
      infrastructure: true,
      _note:
        'Maps the site banner selection to alloy setConsent. Runs on the same data-layer event ' +
        'as the Consent Selection tracking rule.',
      event: acdlEventFor(ruleName, (events.interactions.find((i) => i.rule === 'Consent Selection') || {}).acdlEvent, (events.interactions.find((i) => i.rule === 'Consent Selection') || {}).acdlTimeScope),
      conditions: [],
      actions: [
        {
          extension: 'adobe-alloy',
          delegate_descriptor_id: 'adobe-alloy::actions::set-consent',
          category: 'consent',
          settings: {
            instanceName: property.webSdkInstance.name,
            consent: [
              {
                standard: 'Adobe',
                version: '2.0',
                value: { general: `%${property.consentRule.generalValueDataElement}%` },
              },
            ],
          },
        },
      ],
    });
  }

  // ----------------------------------------------------------------- blueprint
  const blueprint = {
    _generated:
      'GENERATED by scripts/generate-blueprint.mjs — DO NOT HAND-EDIT. Change the catalog and re-generate.',
    schemaVersion: '1.0',
    meta: {
      generator: 'websdk-property/scripts/generate-blueprint.mjs',
      architecture: arch,
      sources: [
        'catalog/property.json',
        'catalog/data-elements.catalog.json',
        'catalog/events-catalog.json',
        overrides && overrides._source ? String(overrides._source) : '(no ACDL overrides file)',
      ],
      draft: unresolved.length > 0,
      unresolved,
    },
    company: { id: values['company-id'] || property.company.id },
    property: {
      name: property.property.name,
      domains: property.property.domains,
      platform: property.property.platform,
    },
    environments: property.environments,
    extensions,
    dataElements,
    rules,
    compliance: property.compliance,
    publishPolicy: property.publishPolicy,
  };

  const outPath = values.out || join(ROOT, 'blueprint', 'aboutamazon-websdk.blueprint.json');
  await mkdir(dirname(outPath), { recursive: true });
  await writeFile(outPath, `${JSON.stringify(blueprint, null, 2)}\n`, 'utf8');

  console.log(`Blueprint written: ${outPath}`);
  console.log(`  extensions   : ${extensions.length}`);
  console.log(`  dataElements : ${dataElements.length}`);
  console.log(`  rules        : ${rules.length}`);
  if (unresolved.length > 0) {
    console.log(`\nDRAFT — ${unresolved.length} unresolved item(s) (publish.mjs will refuse this blueprint):`);
    for (const u of unresolved) console.log(`  - ${u}`);
    console.log(
      '\nResolve by running scripts/export-current.mjs (produces catalog/acdl-events.overrides.json), then re-generate.',
    );
  } else {
    console.log('\nBlueprint is publishable (no unresolved items). Next: scripts/preflight.mjs, then scripts/publish.mjs.');
  }
}

main().catch((err) => {
  console.error(`\nFAILED: ${err.message}`);
  process.exit(1);
});
