#!/usr/bin/env node
// =============================================================================
// rollback.mjs — Roll an environment back to its last known-good library.
// =============================================================================
//
// PHILOSOPHY: "Fail Loud, Never Lie"
//   - We never roll back to a library we cannot positively identify as a
//     previously-published, good build for the target environment.
//   - We re-publish, poll the build to "succeeded", and read the library state
//     back as "published". If any of that fails we throw and exit non-zero.
//   - Recovery is CONFIRMED by a human smoke test, never assumed. We print the
//     critical-page / critical-event reminder at the end.
//
// USAGE:
//   node rollback.mjs --property <id> --environment <development|staging|production>
//        [--to-library <id>] [--yes]
//
//   --to-library : explicit known-good library id to roll back to. If omitted,
//                  we auto-select the most recent *previously* published library
//                  for the environment (i.e. the one before the current head).
//
// REQUIRED ENV: REACTOR_CLIENT_ID, REACTOR_CLIENT_SECRET, REACTOR_ORG_ID,
//               REACTOR_SCOPES  (see reactor.mjs header).
//
// Exit codes: 0 = rollback published + verified; 1 = any failure / no target;
//             2 = usage error.
// =============================================================================

import process from 'node:process';
import { createInterface } from 'node:readline';

import {
  listLibraries,
  listEnvironments,
  setLibraryEnvironment,
  buildLibrary,
  pollBuild,
  transitionLibrary,
  getLibrary,
  verify,
} from './reactor.mjs';

// -----------------------------------------------------------------------------
// Args
// -----------------------------------------------------------------------------
function parseArgs(argv) {
  const out = { flags: {} };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--property') {
      out.property = argv[i + 1];
      i += 1;
    } else if (a === '--environment') {
      out.environment = argv[i + 1];
      i += 1;
    } else if (a === '--to-library') {
      out.toLibrary = argv[i + 1];
      i += 1;
    } else if (a.startsWith('--')) {
      out.flags[a.slice(2)] = true;
    }
  }
  return out;
}

const HELP = `
rollback.mjs — roll an environment back to the last known-good library

Usage:
  node rollback.mjs --property <id> --environment <development|staging|production>
       [--to-library <id>] [--yes]
`;

// -----------------------------------------------------------------------------
// Selection of the known-good target
// -----------------------------------------------------------------------------
/**
 * Identify the library to roll back to.
 * Strategy:
 *   - If --to-library is given, verify it exists and is/was published; use it.
 *   - Otherwise, gather all libraries that have been published to this
 *     environment, sort by published time (newest first). The newest is the
 *     CURRENT head; the one *before* it is the rollback target.
 *
 * A library is considered "published to env X" when its state is "published"
 * (or has a non-null published_at) and its build/environment relationship
 * targeted env X. Reactor exposes `attributes.state`, `attributes.published_at`
 * and a `relationships.upstream_library` / `last_built_at`; we use the most
 * portable signals: state === 'published' + the environment relationship.
 */
async function selectTarget(propertyId, environmentId, explicitLibraryId) {
  const libraries = await listLibraries(propertyId);

  const publishedHere = libraries.filter((lib) => {
    const attrs = lib.attributes || {};
    const wasPublished = attrs.state === 'published' || Boolean(attrs.published_at);
    const envRel =
      lib.relationships &&
      lib.relationships.environment &&
      lib.relationships.environment.data;
    const targetsEnv = !envRel || envRel.id === environmentId;
    return wasPublished && targetsEnv;
  });

  // Sort newest-published first.
  publishedHere.sort((a, b) => {
    const ta = Date.parse((a.attributes && a.attributes.published_at) || (a.attributes && a.attributes.updated_at) || 0) || 0;
    const tb = Date.parse((b.attributes && b.attributes.published_at) || (b.attributes && b.attributes.updated_at) || 0) || 0;
    return tb - ta;
  });

  if (explicitLibraryId) {
    const found = libraries.find((l) => l.id === explicitLibraryId);
    if (!found) {
      throw new Error(`--to-library ${explicitLibraryId} not found on property ${propertyId}`);
    }
    const ok = found.attributes && (found.attributes.state === 'published' || found.attributes.published_at);
    if (!ok) {
      throw new Error(
        `--to-library ${explicitLibraryId} has never been published (state="${found.attributes && found.attributes.state}") ` +
          `— refusing to roll back to an unproven library.`,
      );
    }
    return { target: found, current: publishedHere[0] || null, candidates: publishedHere };
  }

  if (publishedHere.length < 2) {
    throw new Error(
      `Cannot identify a known-good rollback target for environment ${environmentId}: ` +
        `found ${publishedHere.length} previously-published library(ies) (need at least 2, ` +
        `or pass --to-library explicitly).`,
    );
  }

  const current = publishedHere[0];
  const target = publishedHere[1];
  return { target, current, candidates: publishedHere };
}

function confirmRollback(target, current, environment, flags) {
  return new Promise((resolve) => {
    const line = '!'.repeat(72);
    console.log(`\n${line}`);
    console.log('ROLLBACK CONFIRMATION');
    console.log(line);
    console.log(`Environment   : ${environment.attributes.stage} (${environment.id})`);
    if (current) {
      console.log(`Current head  : ${current.id} "${current.attributes.name}"`);
    }
    console.log(`Roll back to  : ${target.id} "${target.attributes.name}"`);
    console.log(line);

    if (flags.yes) {
      console.log('--yes supplied: proceeding.');
      resolve(true);
      return;
    }
    if (!process.stdin.isTTY) {
      console.log('No --yes and no TTY → refusing to roll back silently. Re-run with --yes.');
      resolve(false);
      return;
    }
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    rl.question('Type ROLLBACK to proceed (anything else aborts): ', (answer) => {
      rl.close();
      resolve(answer.trim() === 'ROLLBACK');
    });
  });
}

// -----------------------------------------------------------------------------
// Main
// -----------------------------------------------------------------------------
async function main() {
  const argv = process.argv.slice(2);
  const args = parseArgs(argv);

  if (args.flags.help || !args.property || !args.environment) {
    if (!args.flags.help) console.error('ERROR: --property and --environment are required.');
    console.log(HELP.trim());
    return args.flags.help ? 0 : 2;
  }
  if (!['development', 'staging', 'production'].includes(args.environment)) {
    console.error('ERROR: --environment must be development|staging|production');
    return 2;
  }

  console.log('='.repeat(72));
  console.log('ROLLBACK');
  console.log(`Property    : ${args.property}`);
  console.log(`Environment : ${args.environment}`);
  console.log('='.repeat(72));

  // Resolve the environment id.
  const environments = await listEnvironments(args.property);
  const environment = environments.find((e) => e.attributes.stage === args.environment);
  if (!environment) {
    throw new Error(`Environment "${args.environment}" not found on property ${args.property}`);
  }

  // Identify the known-good target.
  const { target, current } = await selectTarget(args.property, environment.id, args.toLibrary);
  console.log(`Known-good target identified: ${target.id} "${target.attributes.name}"`);

  // Confirm.
  const ok = await confirmRollback(target, current, environment, args.flags);
  if (!ok) {
    console.log('Rollback aborted by operator.');
    return 1;
  }

  // Re-publish the target: bind to env, build, poll, transition to published.
  console.log('\n--- RE-PUBLISHING KNOWN-GOOD LIBRARY ---');
  await setLibraryEnvironment(target.id, environment.id);
  const build = await buildLibrary(target.id);
  const finished = await pollBuild(build.id);
  if (!finished.attributes || finished.attributes.status !== 'succeeded') {
    throw new Error(
      `Rollback build ${build.id} did not succeed (status: ${finished.attributes && finished.attributes.status}).`,
    );
  }
  console.log(`✓ rollback build ${build.id} SUCCEEDED`);

  // Drive the library to published (submit→approve→publish; harmless if already
  // approved — Reactor will reject invalid transitions and we'd fail loud).
  try {
    await transitionLibrary(target.id, 'submit');
    await transitionLibrary(target.id, 'approve');
  } catch (err) {
    // The library may already be approved/published; only fail if the final
    // publish + read-back fails.
    console.error(`(transition note: ${err.message})`);
  }
  await transitionLibrary(target.id, 'publish');

  // VERIFY: read the library state back as published — never assume.
  await getLibrary(target.id, 'published');
  await verify('libraries', target.id);
  console.log(`✓ library ${target.id} verified state "published".`);

  // Recovery is confirmed by the human smoke test.
  const line = '-'.repeat(72);
  console.log(`\n${line}`);
  console.log('SMOKE TEST REMINDER — recovery is NOT confirmed until this passes:');
  console.log('  [ ] Load each critical page and confirm it renders.');
  console.log('  [ ] Confirm each critical event (page view, form submit, consent) fires.');
  console.log('  [ ] Confirm the correct datastream/config is in use for this environment.');
  console.log('  Do NOT close the incident until the smoke test is green.');
  console.log(line);

  console.log('\nDONE: known-good library re-published and verified. Run the smoke test.');
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

export { selectTarget };
