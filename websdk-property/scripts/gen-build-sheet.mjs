#!/usr/bin/env node
// =============================================================================
// gen-build-sheet.mjs — blueprint → human build sheet (for building BY HAND)
// =============================================================================
//
// Emits docs/RULES-BUILD-SHEET.md: a rule-by-rule instruction sheet for
// standing the property up manually in the Adobe Data Collection (Tags) UI —
// every rule's event (IF), conditions, and actions (THEN) with their exact
// settings, including the full Analytics variable mappings for each
// "Update variable" action. This is the by-hand companion to publish.mjs
// (which provisions the same blueprint via the Reactor API).
//
// USAGE:
//   node scripts/gen-build-sheet.mjs [--in blueprint/aboutamazon-websdk.blueprint.json]
//                                    [--out docs/RULES-BUILD-SHEET.md]
//
// Regenerate whenever the blueprint changes so the sheet never drifts from the
// source of truth.
// =============================================================================
import process from 'node:process';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');

const { values } = parseArgs({
  options: {
    in: { type: 'string', default: 'blueprint/aboutamazon-websdk.blueprint.json' },
    out: { type: 'string', default: 'docs/RULES-BUILD-SHEET.md' },
  },
});

const bp = JSON.parse(readFileSync(join(ROOT, values.in), 'utf8'));

const EXT = {
  'adobe-client-data-layer': 'Adobe Client Data Layer',
  'adobe-alloy': 'Adobe Experience Platform Web SDK',
  core: 'Core',
};
const CONSENT = {
  C0001: 'C0001 — Strictly necessary',
  C0002: 'C0002 — Performance / analytics',
  C0003: 'C0003 — Functional',
  C0004: 'C0004 — Targeting / advertising',
};
const out = [];
const w = (s = '') => out.push(s);

// strip the publish-time placeholder prefix from a data-element target
const deName = (v) => (typeof v === 'string' ? v.replace(/^RESOLVE-DE-ID:/, '') : v);
const slug = (name) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// ---- header -------------------------------------------------------------
const propName = bp.property?.name || 'AboutAmazon-US (Web SDK)';
w(`# Rule build sheet — ${propName}`);
w('');
w('> **How to use this sheet.** Build each rule by hand in **Adobe Data Collection → Tags →');
w('> your property → Rules**. For every rule below: create the rule, add the **event (IF)**');
w('> exactly as listed, add each **action (THEN)** in order, then save. There are no conditions');
w('> on any rule in this property. Values shown as `%Name%` are **data element references** —');
w('> pick that data element in the field, do not type the literal text. Targets shown as');
w('> `Data: …` are **Variable-type data elements** you select in the "Update variable" action.');
w('');
w(`- **Rules:** ${bp.rules.length}  ·  **Data elements:** ${(bp.dataElements || []).length}  ·  **Extensions:** ${(bp.extensions || []).length}`);
w('- **One request per page.** Page-load and interaction rules both build an XDM variable, then');
w('  send it on the single Alloy edge call — the durable fix for the two-pathway issue in the audit.');
w('- **Build order:** create all Variable data elements first (`Data: Page View`, `Data: Interaction`,');
w('  `Data: Site Error`), then the rules — the "Update variable" action needs those to exist.');
w('');

// ---- conventions / legend ----------------------------------------------
w('## Conventions');
w('');
w('| In this sheet | In the Tags UI |');
w('|---|---|');
w('| **IF** | The rule\'s **Events** section (the trigger) |');
w('| **THEN** | The rule\'s **Actions** section, in order |');
w('| `%Page: Name%` | A **data element** reference — select it, don\'t type it |');
w('| `Data: Page View` | A **Variable** data element you target in *Update variable* |');
w('| Extension names | `Adobe Client Data Layer`, `Adobe Experience Platform Web SDK`, `Core` |');
w('| Consent `C000x` | OneTrust category gating the rule (see each rule header) |');
w('');

// ---- index --------------------------------------------------------------
w('## Rule index');
w('');
w('| # | Rule | Consent | IF (event) | THEN (actions) |');
w('|--:|---|---|---|---|');
bp.rules.forEach((r, i) => {
  const ev = r.event.settings.event || r.event.settings.type || r.event.settings.elementSelector || '';
  const evTxt = ev ? ` \`${ev}\`` : '';
  const acts = r.actions.map((a) => a.delegateDisplayName || a.delegate_descriptor_id.split('::').pop()).join(' → ');
  w(`| ${i + 1} | [${r.name}](#${i + 1}-${slug(r.name)}) | ${r.consentCategory || '—'} | ${r.event.delegateDisplayName}${evTxt} | ${acts} |`);
});
w('');
w('---');
w('');

// ---- helpers for update-variable mappings -------------------------------
function orderedMappings(analytics) {
  const groups = { basics: [], evars: [], props: [], lists: [], events: [], other: [] };
  const BASIC = ['linkName', 'linkType', 'pageName', 'channel', 'pageURL', 'referrer', 'campaign', 'purchaseID', 'products', 'state', 'zip'];
  const numKey = (k) => parseInt(k.replace(/\D+/g, ''), 10) || 0;
  for (const [k, v] of Object.entries(analytics)) {
    if (k === 'events') { groups.events = String(v).split(',').map((s) => s.trim()).filter(Boolean); continue; }
    if (/^eVar\d+$/.test(k)) groups.evars.push([k, v]);
    else if (/^prop\d+$/.test(k)) groups.props.push([k, v]);
    else if (/^list\d+$/.test(k)) groups.lists.push([k, v]);
    else if (BASIC.includes(k)) groups.basics.push([k, v]);
    else groups.other.push([k, v]);
  }
  groups.evars.sort((a, b) => numKey(a[0]) - numKey(b[0]));
  groups.props.sort((a, b) => numKey(a[0]) - numKey(b[0]));
  groups.lists.sort((a, b) => numKey(a[0]) - numKey(b[0]));
  return groups;
}

function renderUpdateVariable(a, n) {
  const target = deName(a.settings.dataElementId);
  w(`**Action ${n} — Update variable**  ·  *${EXT[a.extension] || a.extension}*`);
  w('');
  w(`- **Variable (data element to update):** \`${target}\``);
  const analytics = a.settings?.data?.__adobe?.analytics;
  if (!analytics) {
    w('- *(no Analytics mappings — see raw settings)*');
    w('');
    return;
  }
  const g = orderedMappings(analytics);
  const linkType = analytics.linkType;
  if (analytics.linkName || linkType) {
    const lt = linkType === 'o' ? 'o — custom/other link' : linkType === 'd' ? 'd — download' : linkType === 'e' ? 'e — exit' : linkType;
    w(`- **Link:** name = \`${analytics.linkName ?? '—'}\`  ·  type = \`${lt ?? '—'}\``);
  }
  w('');
  const section = (title, rows) => {
    if (!rows.length) return;
    w(`  **${title}**`);
    w('');
    w('  | Field | Value |');
    w('  |---|---|');
    for (const [k, v] of rows) w(`  | ${k} | \`${v}\` |`);
    w('');
  };
  const basics = g.basics.filter(([k]) => k !== 'linkName' && k !== 'linkType');
  section('Analytics — page / link', basics);
  section('eVars', g.evars);
  section('props', g.props);
  section('Lists', g.lists);
  if (g.other.length) section('Other', g.other);
  if (g.events.length) {
    w(`  **Events:** ${g.events.map((e) => `\`${e}\``).join(', ')}`);
    w('');
  }
}

function renderSendEvent(a, n) {
  const s = a.settings || {};
  w(`**Action ${n} — Send event**  ·  *${EXT[a.extension] || a.extension}*`);
  w('');
  w('  | Setting | Value |');
  w('  |---|---|');
  w(`  | Instance | \`${s.instanceName || 'alloy'}\` |`);
  w(`  | Type | \`${s.type || ''}\` |`);
  if (typeof s.renderDecisions !== 'undefined') w(`  | Render decisions | ${s.renderDecisions ? '✓ on' : 'off'} |`);
  if (Array.isArray(s.decisionScopes) && s.decisionScopes.length) w(`  | Decision scopes | ${s.decisionScopes.map((x) => `\`${x}\``).join(', ')} |`);
  if (typeof s.data !== 'undefined') w(`  | Data | \`${s.data}\` |`);
  if (typeof s.xdm !== 'undefined') w(`  | XDM | \`${s.xdm}\` |`);
  w('');
}

function renderSetConsent(a, n) {
  const s = a.settings || {};
  w(`**Action ${n} — Set consent**  ·  *${EXT[a.extension] || a.extension}*`);
  w('');
  w('  | Setting | Value |');
  w('  |---|---|');
  w(`  | Instance | \`${s.instanceName || 'alloy'}\` |`);
  for (const c of s.consent || []) {
    w(`  | Standard | \`${c.standard}\` (v${c.version}) |`);
    for (const [k, v] of Object.entries(c.value || {})) w(`  | value.${k} | \`${v}\` |`);
  }
  w('');
}

function renderCustomCode(a, n) {
  w(`**Action ${n} — Custom code**  ·  *${EXT[a.extension] || a.extension}* · \`${a.settings.language || 'javascript'}\``);
  w('');
  w('<details><summary>JavaScript source (paste into the code editor)</summary>');
  w('');
  w('```javascript');
  w(a.settings.source || '');
  w('```');
  w('');
  w('</details>');
  w('');
}

function renderEvent(r) {
  const e = r.event;
  const s = e.settings || {};
  w(`**IF — ${e.delegateDisplayName}**  ·  *${EXT[e.extension] || e.extension}*`);
  w('');
  const bits = [];
  if (s.event) bits.push(`Data layer event = \`${s.event}\``);
  if (s.type && e.delegate_descriptor_id.includes('custom-event')) bits.push(`Custom event type = \`${s.type}\``);
  if (s.elementSelector) bits.push(`Element selector = \`${s.elementSelector}\``);
  if (e.delegate_descriptor_id.includes('send-event-complete')) bits.push(`Fires when the Alloy \`sendEvent\` on \`${s.instanceName || 'alloy'}\` completes`);
  if (!bits.length) bits.push('*(no extra settings)*');
  for (const b of bits) w(`- ${b}`);
  if (typeof e.timeScope !== 'undefined') w(`- Trigger scope: \`${e.timeScope}\``);
  w('');
}

// ---- per-rule sections --------------------------------------------------
bp.rules.forEach((r, i) => {
  w(`## <a id="${i + 1}-${slug(r.name)}"></a>${i + 1}. ${r.name}`);
  w('');
  const consent = r.consentCategory ? (CONSENT[r.consentCategory] || r.consentCategory) : 'No consent category set';
  w(`**Consent:** ${consent}`);
  w('');
  if (r._note) {
    w(`> ${r._note.replace(/\n/g, ' ')}`);
    w('');
  }
  renderEvent(r);
  if ((r.conditions || []).length) {
    w('**IF (conditions)**');
    w('');
    w('```json');
    w(JSON.stringify(r.conditions, null, 2));
    w('```');
    w('');
  }
  w('**THEN**');
  w('');
  r.actions.forEach((a, ai) => {
    const d = a.delegate_descriptor_id;
    if (d.includes('update-variable')) renderUpdateVariable(a, ai + 1);
    else if (d.includes('send-event')) renderSendEvent(a, ai + 1);
    else if (d.includes('set-consent')) renderSetConsent(a, ai + 1);
    else if (d.includes('custom-code')) renderCustomCode(a, ai + 1);
    else {
      w(`**Action ${ai + 1} — ${a.delegateDisplayName || d}**  ·  *${EXT[a.extension] || a.extension}*`);
      w('');
      w('```json');
      w(JSON.stringify(a.settings, null, 2));
      w('```');
      w('');
    }
  });
  w('---');
  w('');
});

writeFileSync(join(ROOT, values.out), out.join('\n'));
console.log(`wrote ${values.out} — ${bp.rules.length} rules, ${out.length} lines`);
