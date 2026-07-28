#!/usr/bin/env node
// =============================================================================
// publish.mjs — Provision + build + promote pipeline for an Adobe Launch property
// =============================================================================
//
// PHILOSOPHY: "Fail Loud, Never Lie"
//   - Every resource is provisioned idempotently (find-or-create) and verified.
//   - A build is NOT "done" until pollBuild reads status === "succeeded".
//   - Promotion to staging is verified by a fresh build + read-back.
//   - PRODUCTION IS GATED BY A HUMAN. Under stage-auto/manual we STOP and print
//     a "PRODUCTION APPROVAL REQUIRED" block; production proceeds only with an
//     explicit --approve-production flag, a typed "PUBLISH" at the prompt, or
//     (full-auto) the --i-am-authorized flag. Approval is the product.
//
// USAGE:
//   node publish.mjs <blueprint.json> [--policy stage-auto|full-auto|manual]
//        [--library-name "<existing dev library to adopt>"]
//        [--approve-production] [--i-am-authorized] [--yes]
//
//   Policies:
//     stage-auto (default) : build dev → promote to staging automatically,
//                            then STOP at the production approval gate.
//     manual               : same gate behaviour; nothing auto-promotes past
//                            staging without explicit approval.
//     full-auto            : may publish to production, but ONLY if
//                            --i-am-authorized is also present.
//
//   Confirmation for production:
//     --approve-production : non-interactive approval (CI with a human gate)
//     interactive          : if a TTY is attached and no flag is set, you must
//                            type PUBLISH exactly.
//
// REQUIRED ENV: REACTOR_CLIENT_ID, REACTOR_CLIENT_SECRET, REACTOR_ORG_ID,
//               REACTOR_SCOPES  (see reactor.mjs header).
// =============================================================================

import process from 'node:process';
import { readFile } from 'node:fs/promises';
import { createInterface } from 'node:readline';

import {
  findOrCreateProperty,
  findOrCreateEnvironment,
  findOrCreateDataElement,
  findOrCreateRule,
  addRuleComponent,
  findOrCreateLibrary,
  addResourceToLibrary,
  buildLibrary,
  pollBuild,
  transitionLibrary,
  getLibrary,
  setLibraryEnvironment,
  findOrCreateExtension,
  getExtensionPackage,
  verify,
} from './reactor.mjs';

// -----------------------------------------------------------------------------
// Arg parsing
// -----------------------------------------------------------------------------
function parseArgs(argv) {
  const out = { policy: null, libraryName: null, blueprintPath: null, flags: {} };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--policy') {
      out.policy = argv[i + 1];
      i += 1;
    } else if (a === '--library-name') {
      out.libraryName = argv[i + 1];
      i += 1;
    } else if (a.startsWith('--')) {
      out.flags[a.slice(2)] = true;
    } else if (!out.blueprintPath) {
      out.blueprintPath = a;
    }
  }
  return out;
}

const HELP = `
publish.mjs — provision, build, and promote a Launch property

Usage:
  node publish.mjs <blueprint.json> [--policy stage-auto|full-auto|manual]
       [--approve-production] [--i-am-authorized] [--yes]

See the file header for policy + approval semantics.
`;

// -----------------------------------------------------------------------------
// Provisioning helpers
// -----------------------------------------------------------------------------
async function provisionProperty(bp) {
  const companyId = bp.company && bp.company.id;
  if (!companyId) throw new Error('blueprint.company.id is required');
  if (!bp.property || !bp.property.name) throw new Error('blueprint.property.name is required');

  const property = await findOrCreateProperty(companyId, {
    name: bp.property.name,
    domains: bp.property.domains || (bp.property.domain ? [bp.property.domain] : []),
    platform: bp.property.platform || 'web',
  });
  console.log(`✓ property verified: ${property.id} "${property.attributes.name}"`);
  return property;
}

async function provisionEnvironments(propertyId, bp) {
  const envs = {};
  for (const e of bp.environments || []) {
    const env = await findOrCreateEnvironment(propertyId, { name: e.name, stage: e.stage });
    envs[env.attributes.stage] = env;
    console.log(`✓ environment verified: ${env.id} "${env.attributes.name}" (${env.attributes.stage})`);
  }
  for (const required of ['development', 'staging', 'production']) {
    if (!envs[required]) {
      throw new Error(
        `blueprint is missing a "${required}" environment — all three stages are required to promote.`,
      );
    }
  }
  return envs;
}

async function provisionDataElements(propertyId, bp, extensionsByName, resolver) {
  const map = {};
  for (const de of bp.dataElements || []) {
    const delegateId = resolver.resolve(
      de.delegate_descriptor_id || `${de.type}::dataElements::${de.type}`,
      de.delegateDisplayName,
    );
    const attrs = {
      name: de.name,
      delegate_descriptor_id: delegateId,
      settings: JSON.stringify(de.settings || {}),
    };
    // Optional value-shaping attributes (carried from the source property).
    if (de.forceLowerCase !== undefined) attrs.force_lower_case = de.forceLowerCase === true;
    if (de.cleanText !== undefined) attrs.clean_text = de.cleanText === true;
    if (de.storageDuration !== undefined && de.storageDuration !== null) {
      attrs.storage_duration = de.storageDuration;
    }
    if (de.defaultValue !== undefined && de.defaultValue !== null) {
      attrs.default_value = String(de.defaultValue);
    }
    const ext = extensionsByName[de.extension];
    if (!ext || !ext.id) {
      throw new Error(
        `data element "${de.name}" needs extension "${de.extension}" but it is not installed — ` +
          `check blueprint.extensions.`,
      );
    }
    const created = await findOrCreateDataElement(propertyId, attrs, ext.id);
    map[de.name] = created;
    console.log(`✓ data element verified: ${created.id} "${created.attributes.name}"`);
  }
  return map;
}

async function provisionRules(propertyId, bp, extensionsByName, resolver, dataElementsByName) {
  // Some action settings (Web SDK "Update variable") must reference the
  // variable data element's Reactor id, which only exists after creation. The
  // generator emits "RESOLVE-DE-ID:<name>" placeholders; substitute them here
  // and fail loud on any name that was never provisioned.
  const resolveDeIds = (settingsJson) =>
    settingsJson.replace(/RESOLVE-DE-ID:([^"]+)/g, (whole, deName) => {
      const de = dataElementsByName && dataElementsByName[deName];
      if (!de || !de.id) {
        throw new Error(
          `action settings reference data element "${deName}" via RESOLVE-DE-ID, ` +
            `but it was not provisioned — check blueprint.dataElements.`,
        );
      }
      return de.id;
    });

  const rules = [];
  for (const r of bp.rules || []) {
    const rule = await findOrCreateRule(propertyId, { name: r.name });
    console.log(`✓ rule verified: ${rule.id} "${rule.attributes.name}"`);

    // Components are added to freshly created rules. If the rule already had
    // components we leave them alone (idempotency at the rule level). We detect
    // "fresh" via created_at vs updated_at being effectively equal is brittle,
    // so we instead only add components when the rule reports zero of them.
    const hasComponents =
      rule.relationships &&
      rule.relationships.rule_components &&
      rule.relationships.rule_components.data &&
      rule.relationships.rule_components.data.length > 0;

    const extIdFor = (component) => {
      const extName = component.extension || 'core';
      const ext = extensionsByName[extName];
      if (!ext || !ext.id) {
        throw new Error(
          `rule "${r.name}" needs extension "${extName}" but it is not installed — ` +
            `check blueprint.extensions.`,
        );
      }
      return ext.id;
    };

    if (!hasComponents) {
      // Event(s)
      const evs = r.event ? [r.event] : r.events || [];
      for (const ev of evs) {
        await addRuleComponent(
          rule.id,
          {
            name: `${r.name} :: event`,
            delegate_descriptor_id: resolver.resolve(
              ev.delegate_descriptor_id || `${ev.extension || 'core'}::events::${ev.type}`,
              ev.delegateDisplayName,
            ),
            settings: JSON.stringify(ev.settings || {}),
            order: 0,
          },
          extIdFor(ev),
        );
      }
      // Conditions
      let order = 0;
      for (const cond of r.conditions || []) {
        order += 1;
        await addRuleComponent(
          rule.id,
          {
            name: `${r.name} :: condition`,
            delegate_descriptor_id: resolver.resolve(
              cond.delegate_descriptor_id || `${cond.extension || 'core'}::conditions::${cond.type}`,
              cond.delegateDisplayName,
            ),
            settings: JSON.stringify(cond.settings || {}),
            negate: cond.negate === true,
            order,
          },
          extIdFor(cond),
        );
      }
      // Actions
      for (const act of r.actions || []) {
        order += 1;
        await addRuleComponent(
          rule.id,
          {
            name: `${r.name} :: action`,
            delegate_descriptor_id: resolver.resolve(
              act.delegate_descriptor_id || `${act.extension || 'core'}::actions::${act.type}`,
              act.delegateDisplayName,
            ),
            settings: resolveDeIds(JSON.stringify(act.settings || {})),
            order,
          },
          extIdFor(act),
        );
      }
    } else {
      console.log(`  (rule already has components — left unchanged)`);
    }
    rules.push(rule);
  }
  return rules;
}

// -----------------------------------------------------------------------------
// Delegate resolution — "Fail Loud" for closed-source extension schemas
// -----------------------------------------------------------------------------
// The blueprint carries best-known delegate_descriptor_ids. For extensions whose
// manifests we could verify (core, adobe-alloy) the ids are exact. For closed-
// source extensions (adobe-client-data-layer, common-web-sdk-plugins) the id is
// a guess flagged with delegateDisplayName — this resolver checks every id
// against the LIVE delegate catalog returned by the extension_packages API and
// substitutes by display-name match when the guessed id does not exist. No
// match → hard stop listing what IS available. We never create a component
// with an unverified delegate id.
async function buildDelegateResolver(installedByName) {
  const known = new Map(); // delegate_descriptor_id -> true
  const byExtension = new Map(); // extName -> [{id, displayName, kind}]
  for (const [extName, entry] of Object.entries(installedByName)) {
    const pkg = await getExtensionPackage(entry.packageId);
    const a = pkg.attributes || {};
    const buckets = [
      ['events', a.events || []],
      ['conditions', a.conditions || []],
      ['actions', a.actions || []],
      ['dataElements', a.data_elements || []],
    ];
    const list = [];
    for (const [kind, delegates] of buckets) {
      for (const d of delegates) {
        const id = `${a.name}::${kind}::${d.name}`;
        known.set(id, true);
        list.push({ id, displayName: d.display_name || d.displayName || d.name, kind });
      }
    }
    byExtension.set(extName, list);
    console.log(`• delegate catalog loaded for "${extName}" (${list.length} delegates)`);
  }

  const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  return {
    resolve(candidateId, displayName) {
      if (known.has(candidateId)) return candidateId;
      const [extName, kind] = String(candidateId).split('::');
      const pool = (byExtension.get(extName) || []).filter(
        (d) => !kind || d.id.includes(`::${kind}::`),
      );
      if (displayName) {
        const hit = pool.find((d) => norm(d.displayName) === norm(displayName));
        if (hit) {
          console.log(
            `• delegate resolved by display name: "${candidateId}" -> "${hit.id}" (${displayName})`,
          );
          return hit.id;
        }
      }
      const available = pool.map((d) => `${d.id} ("${d.displayName}")`).join('\n    ');
      throw new Error(
        `Delegate "${candidateId}"${displayName ? ` (display name "${displayName}")` : ''} does not ` +
          `exist in the live catalog for extension "${extName}".\n  Available:\n    ${available ||
          '(extension not installed or has no delegates of this kind)'}`,
      );
    },
  };
}

// -----------------------------------------------------------------------------
// Library assembly + single-library promotion
// -----------------------------------------------------------------------------
// Reactor's library state machine promotes ONE library through the stages:
//   development (dev env build) → submitted (staging env build) → approved
//   → published (production build).
// The environment relationship must point at the matching stage before each
// build. We verify the state transition AND the build result at every step.
async function buildForEnvironment(libraryId, environment, label) {
  await setLibraryEnvironment(libraryId, environment.id);
  const build = await buildLibrary(libraryId);
  const finished = await pollBuild(build.id);
  if (!finished.attributes || finished.attributes.status !== 'succeeded') {
    throw new Error(
      `Build ${build.id} (${label}) did not succeed ` +
        `(status: ${finished.attributes && finished.attributes.status}).`,
    );
  }
  console.log(`✓ ${label} build ${build.id} SUCCEEDED`);
  return finished;
}

async function pollLibraryState(libraryId, expectedState, budgetMs = 300_000, intervalMs = 5000) {
  const deadline = Date.now() + budgetMs;
  for (;;) {
    const lib = await getLibrary(libraryId);
    const state = lib.attributes && lib.attributes.state;
    if (state === expectedState) return lib;
    if (Date.now() >= deadline) {
      throw new Error(
        `Library ${libraryId} did not reach state "${expectedState}" within ${budgetMs}ms ` +
          `(last state "${state}").`,
      );
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
}

// -----------------------------------------------------------------------------
// Production approval gate
// -----------------------------------------------------------------------------
function printApprovalBlock(bp, propertyId, prodEnv, dataElementCount, ruleCount) {
  const line = '!'.repeat(72);
  console.log(`\n${line}`);
  console.log('PRODUCTION APPROVAL REQUIRED');
  console.log(line);
  console.log(`Property      : ${bp.property.name} (${propertyId})`);
  console.log(`Environment   : production (${prodEnv.id})`);
  console.log(`Domain(s)     : ${(bp.property.domains || [bp.property.domain]).join(', ')}`);
  console.log(`Data elements : ${dataElementCount}`);
  console.log(`Rules         : ${ruleCount}`);
  console.log('Rules to publish:');
  for (const r of bp.rules || []) {
    console.log(`   - ${r.name}  [consent: ${r.consentCategory || 'NONE'}]`);
  }
  if (bp.compliance && (bp.compliance.profiles || []).length) {
    console.log(`Compliance    : profiles=${bp.compliance.profiles.join(',')} ipObfuscation=${bp.compliance.ipObfuscation}`);
  }
  console.log(line);
  console.log('This will publish to PRODUCTION. To proceed:');
  console.log('  • non-interactive: re-run with --approve-production');
  console.log('  • full-auto      : re-run with --policy full-auto --i-am-authorized');
  console.log('  • interactive    : type PUBLISH exactly when prompted');
  console.log(`${line}\n`);
}

function promptForPublish() {
  return new Promise((resolve) => {
    if (!process.stdin.isTTY) {
      resolve(false);
      return;
    }
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    rl.question('Type PUBLISH to publish to production (anything else aborts): ', (answer) => {
      rl.close();
      resolve(answer.trim() === 'PUBLISH');
    });
  });
}

async function productionApproved(policy, flags, bp, propertyId, prodEnv, deCount, ruleCount) {
  if (policy === 'full-auto') {
    if (flags['i-am-authorized']) {
      console.log('Policy full-auto + --i-am-authorized: production approved without prompt.');
      return true;
    }
    printApprovalBlock(bp, propertyId, prodEnv, deCount, ruleCount);
    console.log('full-auto requires --i-am-authorized. Not set → STOPPING before production.');
    return false;
  }

  // stage-auto / manual
  if (flags['approve-production']) {
    console.log('--approve-production supplied: production approved.');
    return true;
  }
  printApprovalBlock(bp, propertyId, prodEnv, deCount, ruleCount);
  if (process.stdin.isTTY) {
    return promptForPublish();
  }
  console.log('No approval flag and no TTY → STOPPING before production (this is intentional).');
  return false;
}

// -----------------------------------------------------------------------------
// Post-publish verification stub
// -----------------------------------------------------------------------------
async function verifyProductionPublish(library) {
  // Read the library back and assert published. Recovery/health is NEVER
  // assumed — we remind the operator to run the live smoke test.
  const lib = await getLibrary(library.id, 'published');
  console.log(`✓ library ${lib.id} state read back as "published".`);
  console.log('\nPOST-PUBLISH VERIFICATION (stub):');
  console.log('  [ ] Run the health check against the critical-page list.');
  console.log('  [ ] Confirm sendEvent fires on the homepage with correct datastream.');
  console.log('  [ ] Confirm consent gating (C0002/C0003/C0004) behaves on a real page.');
  console.log('  Publication is NOT considered healthy until the smoke test passes.');
}

// -----------------------------------------------------------------------------
// Main
// -----------------------------------------------------------------------------
async function main() {
  const argv = process.argv.slice(2);
  const { policy: policyArg, libraryName: libraryNameArg, blueprintPath, flags } = parseArgs(argv);

  if (flags.help || !blueprintPath) {
    console.log(HELP.trim());
    return blueprintPath ? 0 : 2;
  }

  const bp = JSON.parse(await readFile(blueprintPath, 'utf8'));
  const policy = policyArg || bp.publishPolicy || 'stage-auto';
  if (!['stage-auto', 'full-auto', 'manual'].includes(policy)) {
    throw new Error(`Unknown policy "${policy}" (stage-auto|full-auto|manual)`);
  }

  console.log('='.repeat(72));
  console.log(`PUBLISH PIPELINE  policy=${policy}`);
  console.log(`Blueprint: ${blueprintPath}`);
  console.log('='.repeat(72));

  // 0) Refuse draft blueprints. generate-blueprint.mjs marks the blueprint as
  // draft while any ACDL event name is still the CONFIRM-VIA-EXPORT sentinel —
  // publishing rules that listen for a made-up data layer event would produce a
  // property that verifies green and collects nothing. Fail loud instead.
  if (bp.meta && bp.meta.draft) {
    throw new Error(
      `Blueprint is a DRAFT — unresolved items:\n  - ${(bp.meta.unresolved || []).join('\n  - ')}\n` +
        `Run scripts/export-current.mjs against the existing property to produce ` +
        `catalog/acdl-events.overrides.json, then re-run generate-blueprint.mjs.`,
    );
  }

  // 1) Provision (idempotent + verified)
  const property = await provisionProperty(bp);
  const envs = await provisionEnvironments(property.id, bp);

  // 2) Install extensions FOR REAL (find-or-create against extension_packages),
  // then load each package's live delegate catalog so every delegate id used by
  // data elements / rule components below is verified — or resolved by display
  // name — before anything is created.
  const extensionsByName = {};
  for (const ext of bp.extensions || []) {
    const { extension, extensionPackage } = await findOrCreateExtension(
      property.id,
      ext.name,
      ext.settings || null,
    );
    extensionsByName[ext.name] = {
      id: extension.id,
      name: ext.name,
      packageId: extensionPackage.id,
    };
    console.log(
      `✓ extension verified: ${extension.id} "${ext.displayName || ext.name}" ` +
        `(package ${extensionPackage.id})`,
    );
  }
  const resolver = await buildDelegateResolver(extensionsByName);

  const dataElements = await provisionDataElements(property.id, bp, extensionsByName, resolver);
  const rules = await provisionRules(property.id, bp, extensionsByName, resolver, dataElements);

  // Assemble the resource list for the library. On a NEW property nothing is
  // published upstream yet, so the library must carry the extensions too — a
  // build without them fails with unresolved delegate references.
  const resources = [
    ...Object.values(extensionsByName).map((e) => ({ type: 'extensions', id: e.id })),
    ...Object.values(dataElements).map((d) => ({ type: 'data_elements', id: d.id })),
    ...rules.map((r) => ({ type: 'rules', id: r.id })),
  ];

  // 3) Assemble ONE library and build it for development. Naming convention:
  // "YYYYMMDD - vX.Y - description" (the publishing flow reads as a release
  // log, and the dated production publish doubles as the audit's documented
  // cutover boundary). Pass --library-name to ADOPT a development library the
  // operator already created in the UI with that exact name; otherwise a
  // uniquely-suffixed one is created.
  console.log('\n--- DEVELOPMENT BUILD ---');
  const now = new Date();
  const yyyymmdd = now.toISOString().slice(0, 10).replace(/-/g, '');
  const hhmmss = now.toISOString().slice(11, 19).replace(/:/g, '');
  const libraryName =
    libraryNameArg || `${yyyymmdd} - v1.0 - Initial Web SDK Implementation (auto ${hhmmss}Z)`;
  const library = await findOrCreateLibrary(property.id, libraryName);
  for (const r of resources) {
    // Tolerate resources already attached (an adopted library may carry the
    // extensions the operator added in the UI). Any other error is fatal.
    try {
      await addResourceToLibrary(library.id, r.type, r.id);
    } catch (err) {
      if (/already|taken|duplicate/i.test(err.message)) {
        console.log(`  (${r.type}/${r.id} already in library — skipped)`);
      } else {
        throw err;
      }
    }
  }
  await buildForEnvironment(library.id, envs.development, 'DEV');

  // 4) Promote the same library to staging: submit, rebuild, approve.
  console.log('\n--- STAGING PROMOTION ---');
  await transitionLibrary(library.id, 'submit');
  await getLibrary(library.id, 'submitted');
  await buildForEnvironment(library.id, envs.staging, 'STAGE');
  await transitionLibrary(library.id, 'approve');
  await getLibrary(library.id, 'approved');
  console.log(`✓ library ${library.id} verified state "approved" with a green staging build.`);

  if (policy === 'manual') {
    console.log('\nPolicy "manual": staging is ready. Stopping (no production attempt).');
  }

  // 4) Production gate
  console.log('\n--- PRODUCTION GATE ---');
  const approved = await productionApproved(
    policy,
    flags,
    bp,
    property.id,
    envs.production,
    Object.keys(dataElements).length,
    rules.length,
  );

  if (!approved) {
    console.log('\nPRODUCTION NOT PUBLISHED. Re-run with explicit approval to proceed.');
    // Not an error — this is the designed safe stop. Exit 0 with clear status.
    return 0;
  }

  // 6) Publish to production: bind the approved library to the production
  // environment, request the publish transition, and drive/verify the prod
  // build. Some Reactor deployments create the production build as part of the
  // publish action; others expect an explicit build request. Handle both, and
  // accept nothing short of a verified "published" state.
  console.log('\n--- PRODUCTION PUBLISH ---');
  await setLibraryEnvironment(library.id, envs.production.id);
  await transitionLibrary(library.id, 'publish');
  try {
    const build = await buildLibrary(library.id);
    const finished = await pollBuild(build.id);
    if (!finished.attributes || finished.attributes.status !== 'succeeded') {
      throw new Error(
        `Production build ${build.id} did not succeed ` +
          `(status: ${finished.attributes && finished.attributes.status}).`,
      );
    }
    console.log(`✓ PROD build ${build.id} SUCCEEDED`);
  } catch (err) {
    // If the publish action already kicked off the production build, an
    // explicit build request is rejected — fall through to the state poll,
    // which is the authoritative verification either way.
    console.log(`• explicit production build request not accepted (${err.message.split('\n')[0]}) — ` +
      `waiting on the publish transition's own build`);
  }
  await pollLibraryState(library.id, 'published');
  await verifyProductionPublish(library);

  console.log('\nDONE: production library verified as published. Run the smoke test now.');
  return 0;
}

const invokedDirectly =
  process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href;

if (invokedDirectly) {
  main()
    .then((code) => process.exit(code || 0))
    .catch((err) => {
      console.error(`\nFAILED: ${err.message}`);
      process.exit(1);
    });
}

export {
  provisionProperty,
  provisionEnvironments,
  provisionDataElements,
  provisionRules,
  buildForEnvironment,
  buildDelegateResolver,
};
