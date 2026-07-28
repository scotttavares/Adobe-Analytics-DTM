#!/usr/bin/env node
// =============================================================================
// export-current.mjs — snapshot the EXISTING AboutAmazon-US property
// =============================================================================
//
// Purpose: close the unknowns the Launch Inspector workbook could not export.
// The workbook shows every rule uses an "Adobe Client Data Layer: Datalayer
// Push Listener" event but NOT which data-layer event name each rule listens
// for, and it cannot show closed-source extensions' exact delegate ids or
// settings key names. This script reads all of that from the live property via
// the Reactor API and writes:
//
//   1. snapshot/aboutamazon-us.snapshot.json       — full as-is dump (extensions
//      + settings, data elements + settings, rules + ordered components)
//   2. catalog/acdl-events.overrides.json          — per-rule VERBATIM event
//      component settings + delegate id, consumed by generate-blueprint.mjs
//
// USAGE:
//   node scripts/export-current.mjs [--property-name "AboutAmazon-US"] [--company-id COxxxx]
//
// REQUIRED ENV: REACTOR_CLIENT_ID, REACTOR_CLIENT_SECRET, REACTOR_ORG_ID,
//               REACTOR_SCOPES  (see reactor.mjs header). READ-ONLY: this
//               script performs GET requests only — it never writes to Adobe.
// =============================================================================

import process from 'node:process';
import { writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  getAll,
  listProperties,
  listExtensions,
  listDataElements,
  listRules,
  listRuleComponents,
  getExtensionPackage,
} from './reactor.mjs';

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
  if (raw === null || raw === undefined) return null;
  if (typeof raw === 'object') return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return { _unparseable: String(raw) };
  }
}

async function main() {
  const values = parseArgs(process.argv.slice(2));
  const propertyName = values['property-name'] || 'AboutAmazon-US';

  // 1) Find the source property by exact name across visible companies.
  let companies;
  if (values['company-id']) {
    companies = [{ id: values['company-id'] }];
  } else {
    companies = await getAll('/companies');
  }
  let property = null;
  let companyId = null;
  for (const c of companies) {
    const props = await listProperties(c.id);
    const hit = props.find((p) => p.attributes && p.attributes.name === propertyName);
    if (hit) {
      property = hit;
      companyId = c.id;
      break;
    }
  }
  if (!property) {
    const seen = [];
    for (const c of companies) {
      for (const p of await listProperties(c.id)) seen.push(`${c.id}: "${p.attributes.name}"`);
    }
    throw new Error(
      `Property named "${propertyName}" not found. Properties visible to this credential:\n  ` +
        seen.join('\n  '),
    );
  }
  console.log(`✓ source property: ${property.id} "${propertyName}" (company ${companyId})`);

  // 2) Extensions with settings + their package delegate catalogs (gives the
  // EXACT delegate ids + settings schemas for closed-source extensions).
  const extensions = await listExtensions(property.id);
  const extensionDump = [];
  for (const e of extensions) {
    const entry = {
      id: e.id,
      name: e.attributes.name,
      version: e.attributes.version,
      settings: parseSettings(e.attributes.settings),
    };
    const pkgRel = e.relationships && e.relationships.extension_package;
    if (pkgRel && pkgRel.data && pkgRel.data.id) {
      const pkg = await getExtensionPackage(pkgRel.data.id);
      const a = pkg.attributes || {};
      entry.package = {
        id: pkg.id,
        displayName: a.display_name,
        delegates: {
          events: (a.events || []).map((d) => ({ name: d.name, displayName: d.display_name })),
          conditions: (a.conditions || []).map((d) => ({ name: d.name, displayName: d.display_name })),
          actions: (a.actions || []).map((d) => ({ name: d.name, displayName: d.display_name })),
          dataElements: (a.data_elements || []).map((d) => ({ name: d.name, displayName: d.display_name })),
        },
      };
    }
    extensionDump.push(entry);
    console.log(`✓ extension: ${entry.name} v${entry.version}`);
  }

  // 3) Data elements with settings.
  const dataElements = (await listDataElements(property.id)).map((d) => ({
    id: d.id,
    name: d.attributes.name,
    delegate_descriptor_id: d.attributes.delegate_descriptor_id,
    settings: parseSettings(d.attributes.settings),
    force_lower_case: d.attributes.force_lower_case,
    clean_text: d.attributes.clean_text,
    storage_duration: d.attributes.storage_duration,
    default_value: d.attributes.default_value,
  }));
  console.log(`✓ data elements: ${dataElements.length}`);

  // 4) Rules with ordered components (settings VERBATIM).
  const rules = [];
  const overrides = { _source: `export-current.mjs @ ${new Date().toISOString()} from property ${property.id}`, rules: {} };
  for (const r of await listRules(property.id)) {
    const comps = (await listRuleComponents(r.id))
      .map((c) => ({
        id: c.id,
        name: c.attributes.name,
        delegate_descriptor_id: c.attributes.delegate_descriptor_id,
        order: c.attributes.order,
        settings: parseSettings(c.attributes.settings),
        negate: c.attributes.negate,
      }))
      .sort((x, y) => (x.order || 0) - (y.order || 0));
    rules.push({ id: r.id, name: r.attributes.name, components: comps });

    const eventComp = comps.find(
      (c) => c.delegate_descriptor_id && c.delegate_descriptor_id.includes('::events::'),
    );
    if (
      eventComp &&
      eventComp.delegate_descriptor_id.startsWith('adobe-client-data-layer::')
    ) {
      overrides.rules[r.attributes.name] = {
        delegate_descriptor_id: eventComp.delegate_descriptor_id,
        settings: eventComp.settings,
      };
    }
    console.log(`✓ rule: "${r.attributes.name}" (${comps.length} components)`);
  }

  // 5) Write outputs.
  const snapshotPath = join(ROOT, 'snapshot', 'aboutamazon-us.snapshot.json');
  await mkdir(dirname(snapshotPath), { recursive: true });
  await writeFile(
    snapshotPath,
    `${JSON.stringify(
      {
        exportedAt: new Date().toISOString(),
        property: { id: property.id, name: propertyName, companyId },
        extensions: extensionDump,
        dataElements,
        rules,
      },
      null,
      2,
    )}\n`,
    'utf8',
  );
  console.log(`\n✓ snapshot written: ${snapshotPath}`);

  const overridesPath = join(ROOT, 'catalog', 'acdl-events.overrides.json');
  await writeFile(overridesPath, `${JSON.stringify(overrides, null, 2)}\n`, 'utf8');
  const count = Object.keys(overrides.rules).length;
  console.log(`✓ ACDL event overrides written: ${overridesPath} (${count} rules)`);
  if (count === 0) {
    console.log(
      'WARNING: no Adobe Client Data Layer event components were found — check the property name.',
    );
    process.exitCode = 1;
    return;
  }
  console.log('\nNext: re-run scripts/generate-blueprint.mjs — the blueprint should leave draft state.');
}

main().catch((err) => {
  console.error(`\nFAILED: ${err.message}`);
  process.exit(1);
});
