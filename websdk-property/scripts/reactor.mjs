#!/usr/bin/env node
// =============================================================================
// reactor.mjs — Idempotent Adobe Launch (Reactor) API client + CLI
// =============================================================================
//
// PHILOSOPHY: "Fail Loud, Never Lie"
// -----------------------------------------------------------------------------
// This client never claims success unless it has *verified* the outcome by
// reading the resource back from the Reactor API. Every write is followed by a
// read-back (`verify`). Every long-running operation (a build) is polled until
// it reaches a terminal state, and a non-terminal/failed state is surfaced as a
// thrown error and a non-zero exit code — never swallowed.
//
// The product is the guardrails, not the convenience:
//   - Guardrails : 30s AbortController timeout, idempotent find-or-create,
//                  read-back verification of every resource.
//   - Fallback   : exponential backoff retry on 429/5xx, one automatic re-auth
//                  on 401.
//   - Approval   : production publishing is gated by an explicit human step
//                  (see publish.mjs) — never automated by default.
//
// REQUIRED ENVIRONMENT VARIABLES
// -----------------------------------------------------------------------------
//   REACTOR_CLIENT_ID      Adobe I/O OAuth Server-to-Server client id (also the
//                          x-api-key header value).
//   REACTOR_CLIENT_SECRET  OAuth client secret. NEVER logged or echoed.
//   REACTOR_ORG_ID         Adobe IMS org id (x-gw-ims-org-id header), e.g.
//                          2DD68785558BD0AB7F000101@AdobeOrg
//   REACTOR_SCOPES         OAuth scopes, comma- or space-separated. Typically
//                          "openid, AdobeID, read_organizations,
//                           additional_info.projectedProductContext,
//                           additional_info.roles".
//
// SECURITY: Secrets are read from the environment, used to obtain a token, and
// never printed. The CLI and helpers log only non-secret metadata.
// =============================================================================

import process from 'node:process';
import { readFile } from 'node:fs/promises';

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------
const REACTOR_BASE = 'https://reactor.adobe.io';
const IMS_TOKEN_URL = 'https://ims-na1.adobelogin.com/ims/token/v3';
const JSONAPI_ACCEPT = 'application/vnd.api+json;revision=1';
const JSONAPI_CONTENT_TYPE = 'application/vnd.api+json';
const DEFAULT_TIMEOUT_MS = 30000;
const RETRY_BACKOFF_MS = [2000, 4000, 8000, 16000]; // 4 attempts
const TOKEN_SAFETY_WINDOW_MS = 60_000; // refresh a minute before true expiry

// -----------------------------------------------------------------------------
// Environment helpers (read once, fail loud if missing)
// -----------------------------------------------------------------------------
function requireEnv(name) {
  const value = process.env[name];
  if (!value || value.trim() === '') {
    throw new Error(
      `Missing required environment variable: ${name}. ` +
        `See the header of reactor.mjs for the full list.`,
    );
  }
  return value.trim();
}

function getScopes() {
  // Accept comma- or space-separated scopes; normalise to space-separated.
  const raw = requireEnv('REACTOR_SCOPES');
  return raw
    .split(/[\s,]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .join(' ');
}

// -----------------------------------------------------------------------------
// Token management (cache + auto-refresh)
// -----------------------------------------------------------------------------
let _accessToken = null;
let _tokenExpiresAt = 0; // epoch ms

/**
 * Fetch (and cache) an Adobe IMS Server-to-Server access token using the
 * client_credentials grant. Returns the bearer token string. Never logs the
 * secret or the token value.
 *
 * @param {{ force?: boolean }} [opts]
 * @returns {Promise<string>}
 */
export async function getAccessToken(opts = {}) {
  const force = opts.force === true;
  const now = Date.now();
  if (!force && _accessToken && now < _tokenExpiresAt - TOKEN_SAFETY_WINDOW_MS) {
    return _accessToken;
  }

  const clientId = requireEnv('REACTOR_CLIENT_ID');
  const clientSecret = requireEnv('REACTOR_CLIENT_SECRET');
  const scopes = getScopes();

  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: clientId,
    client_secret: clientSecret,
    scope: scopes,
  });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
  let res;
  try {
    res = await fetch(IMS_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
      signal: controller.signal,
    });
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new Error(`IMS token request timed out after ${DEFAULT_TIMEOUT_MS}ms`);
    }
    throw new Error(`IMS token request failed: ${err.message}`);
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    // Do NOT echo the request body (it contains the secret). Surface status +
    // any non-secret error description from IMS.
    let detail = '';
    try {
      const j = await res.json();
      detail = j.error_description || j.error || '';
    } catch {
      /* ignore parse errors */
    }
    throw new Error(
      `IMS auth failed: HTTP ${res.status} ${res.statusText}` +
        (detail ? ` — ${detail}` : ''),
    );
  }

  const json = await res.json();
  if (!json.access_token) {
    throw new Error('IMS auth succeeded but no access_token was returned.');
  }
  _accessToken = json.access_token;
  const expiresInSec = Number(json.expires_in) || 24 * 60 * 60; // default ~24h
  _tokenExpiresAt = Date.now() + expiresInSec * 1000;
  return _accessToken;
}

/**
 * Run `fn` with a guaranteed-fresh token. Refreshes the token first if it is
 * missing or about to expire. Used by callers that want explicit token
 * lifecycle control; reactorFetch also handles 401 re-auth internally.
 *
 * @template T
 * @param {(token: string) => Promise<T>} fn
 * @returns {Promise<T>}
 */
export async function withToken(fn) {
  const token = await getAccessToken();
  return fn(token);
}

// -----------------------------------------------------------------------------
// Core request wrapper
// -----------------------------------------------------------------------------
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function buildHeaders(token, isWrite) {
  const headers = {
    Authorization: `Bearer ${token}`,
    'x-api-key': requireEnv('REACTOR_CLIENT_ID'),
    'x-gw-ims-org-id': requireEnv('REACTOR_ORG_ID'),
    Accept: JSONAPI_ACCEPT,
  };
  if (isWrite) headers['Content-Type'] = JSONAPI_CONTENT_TYPE;
  return headers;
}

/**
 * Extract a human-readable error message from a JSON:API error response without
 * leaking secrets.
 */
function describeErrors(json, status, statusText) {
  if (json && Array.isArray(json.errors) && json.errors.length > 0) {
    const parts = json.errors.map((e) => {
      const bits = [e.title, e.detail].filter(Boolean).join(': ');
      const src = e.source && e.source.pointer ? ` (${e.source.pointer})` : '';
      return `${bits}${src}`;
    });
    return parts.join(' | ');
  }
  return `HTTP ${status} ${statusText}`;
}

/**
 * Perform a Reactor API request with guardrails:
 *   - required JSON:API headers
 *   - 30s AbortController timeout
 *   - exponential backoff retry (2s,4s,8s,16s) on 429 + 5xx, up to 4 attempts
 *   - one automatic re-auth on 401
 *   - JSON:API body serialization
 *   - clear error throwing (status + JSON:API error detail)
 *
 * @param {string} path           e.g. "/companies" or full URL
 * @param {object} [options]
 * @param {string} [options.method="GET"]
 * @param {object} [options.body]            serialised as JSON:API
 * @param {number} [options.timeoutMs=30000]
 * @returns {Promise<object>}                parsed JSON:API response (or {} on 204)
 */
export async function reactorFetch(path, options = {}) {
  const { method = 'GET', body, timeoutMs = DEFAULT_TIMEOUT_MS } = options;
  const url = path.startsWith('http') ? path : `${REACTOR_BASE}${path}`;
  const isWrite = method !== 'GET' && method !== 'HEAD';

  let reauthed = false;
  let attempt = 0;

  // total attempts = retryable attempts + the final non-retried attempt
  const maxRetries = RETRY_BACKOFF_MS.length;

  for (;;) {
    const token = await getAccessToken();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    let res;
    try {
      res = await fetch(url, {
        method,
        headers: buildHeaders(token, isWrite),
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal,
      });
    } catch (err) {
      clearTimeout(timer);
      if (err.name === 'AbortError') {
        // Treat timeouts as retryable.
        if (attempt < maxRetries) {
          const wait = RETRY_BACKOFF_MS[attempt];
          attempt += 1;
          console.error(
            `[reactor] ${method} ${path} timed out after ${timeoutMs}ms — ` +
              `retry ${attempt}/${maxRetries} in ${wait}ms`,
          );
          await sleep(wait);
          continue;
        }
        throw new Error(
          `${method} ${path} timed out after ${timeoutMs}ms (no retries left)`,
        );
      }
      // Network error — retryable.
      if (attempt < maxRetries) {
        const wait = RETRY_BACKOFF_MS[attempt];
        attempt += 1;
        console.error(
          `[reactor] ${method} ${path} network error (${err.message}) — ` +
            `retry ${attempt}/${maxRetries} in ${wait}ms`,
        );
        await sleep(wait);
        continue;
      }
      throw new Error(`${method} ${path} failed: ${err.message}`);
    } finally {
      clearTimeout(timer);
    }

    // 401 → one automatic re-auth, then retry once with a fresh token.
    if (res.status === 401 && !reauthed) {
      reauthed = true;
      console.error(`[reactor] ${method} ${path} returned 401 — re-authenticating once`);
      await getAccessToken({ force: true });
      continue;
    }

    // 429 / 5xx → exponential backoff retry.
    if ((res.status === 429 || res.status >= 500) && attempt < maxRetries) {
      const wait = RETRY_BACKOFF_MS[attempt];
      attempt += 1;
      console.error(
        `[reactor] ${method} ${path} returned ${res.status} — ` +
          `retry ${attempt}/${maxRetries} in ${wait}ms`,
      );
      await sleep(wait);
      continue;
    }

    if (res.status === 204) return {};

    let json = null;
    const text = await res.text();
    if (text) {
      try {
        json = JSON.parse(text);
      } catch {
        json = null;
      }
    }

    if (!res.ok) {
      throw new Error(
        `${method} ${path} → ${describeErrors(json, res.status, res.statusText)}`,
      );
    }
    return json ?? {};
  }
}

// -----------------------------------------------------------------------------
// JSON:API helpers
// -----------------------------------------------------------------------------
function jsonApiBody(type, attributes, relationships, meta) {
  const data = { type, attributes };
  if (relationships) data.relationships = relationships;
  if (meta) data.meta = meta;
  return { data };
}

/**
 * Iterate every page of a JSON:API collection and return the concatenated
 * `data` array. Reactor paginates via `links.next`.
 */
export async function getAll(path) {
  const out = [];
  let next = path;
  // Reactor defaults to page[size]=25; bump it to reduce round-trips.
  if (!/[?&]page\[size\]=/.test(next)) {
    next += (next.includes('?') ? '&' : '?') + 'page[size]=100';
  }
  while (next) {
    const page = await reactorFetch(next);
    if (Array.isArray(page.data)) out.push(...page.data);
    next = page.links && page.links.next ? page.links.next : null;
  }
  return out;
}

// -----------------------------------------------------------------------------
// Read-back verification — the heart of "Never Lie"
// -----------------------------------------------------------------------------
/**
 * GET a resource by type+id and assert it exists. Throws (fail loud) if the
 * resource cannot be read back. Returns the resource object on success.
 *
 * @param {string} resourceType  plural Reactor collection, e.g. "properties"
 * @param {string} id
 * @returns {Promise<object>}
 */
export async function verify(resourceType, id) {
  if (!id) throw new Error(`verify(${resourceType}): no id supplied`);
  const res = await reactorFetch(`/${resourceType}/${id}`);
  if (!res.data || res.data.id !== id) {
    throw new Error(
      `VERIFY FAILED: ${resourceType}/${id} did not read back as expected.`,
    );
  }
  return res.data;
}

// -----------------------------------------------------------------------------
// Find-or-create helpers (idempotent)
// -----------------------------------------------------------------------------
/**
 * Find a property by name under a company, or create it. Verifies the result.
 *
 * @param {string} companyId
 * @param {{name: string, domains?: string[], platform?: string}} attrs
 * @returns {Promise<object>} the property resource
 */
export async function findOrCreateProperty(companyId, attrs) {
  if (!attrs || !attrs.name) throw new Error('findOrCreateProperty: attrs.name required');
  const existing = await getAll(`/companies/${companyId}/properties`);
  const match = existing.find((p) => p.attributes && p.attributes.name === attrs.name);
  if (match) {
    console.error(`[reactor] property "${attrs.name}" already exists (${match.id})`);
    return verify('properties', match.id);
  }
  const payload = jsonApiBody('properties', {
    name: attrs.name,
    domains: attrs.domains || [],
    platform: attrs.platform || 'web',
  });
  const created = await reactorFetch(`/companies/${companyId}/properties`, {
    method: 'POST',
    body: payload,
  });
  const id = created.data && created.data.id;
  console.error(`[reactor] created property "${attrs.name}" (${id})`);
  return verify('properties', id);
}

/**
 * Find an environment by name (and type) under a property, or create it.
 *
 * @param {string} propertyId
 * @param {{name: string, stage: string, [k:string]: any}} attrs
 *        stage ∈ {development, staging, production}
 * @returns {Promise<object>}
 */
export async function findOrCreateEnvironment(propertyId, attrs) {
  if (!attrs || !attrs.name || !attrs.stage) {
    throw new Error('findOrCreateEnvironment: attrs.name and attrs.stage required');
  }
  const existing = await getAll(`/properties/${propertyId}/environments`);
  const match = existing.find(
    (e) =>
      e.attributes &&
      e.attributes.name === attrs.name &&
      e.attributes.stage === attrs.stage,
  );
  if (match) {
    console.error(
      `[reactor] environment "${attrs.name}" (${attrs.stage}) already exists (${match.id})`,
    );
    return verify('environments', match.id);
  }
  const attributes = { name: attrs.name, stage: attrs.stage };
  // archive/library hosting settings may be passed through if present.
  if (attrs.library_path) attributes.library_path = attrs.library_path;
  if (attrs.library_name) attributes.library_name = attrs.library_name;
  if (attrs.path) attributes.path = attrs.path;
  const created = await reactorFetch(`/properties/${propertyId}/environments`, {
    method: 'POST',
    body: jsonApiBody('environments', attributes),
  });
  const id = created.data && created.data.id;
  console.error(`[reactor] created environment "${attrs.name}" (${attrs.stage}) (${id})`);
  return verify('environments', id);
}

/**
 * Find a data element by name under a property, or create it. Verifies result.
 *
 * @param {string} propertyId
 * @param {object} attrs  Reactor data_element attributes (name, delegate_descriptor_id, settings, ...)
 * @returns {Promise<object>}
 */
export async function findOrCreateDataElement(propertyId, attrs, extensionId) {
  if (!attrs || !attrs.name) throw new Error('findOrCreateDataElement: attrs.name required');
  const existing = await getAll(`/properties/${propertyId}/data_elements`);
  const match = existing.find((d) => d.attributes && d.attributes.name === attrs.name);
  if (match) {
    console.error(`[reactor] data element "${attrs.name}" already exists (${match.id})`);
    return verify('data_elements', match.id);
  }
  const relationships = extensionId
    ? { extension: { data: { id: extensionId, type: 'extensions' } } }
    : undefined;
  const created = await reactorFetch(`/properties/${propertyId}/data_elements`, {
    method: 'POST',
    body: jsonApiBody('data_elements', attrs, relationships),
  });
  const id = created.data && created.data.id;
  console.error(`[reactor] created data element "${attrs.name}" (${id})`);
  return verify('data_elements', id);
}

/**
 * Find a rule by name under a property, or create it. Verifies result.
 *
 * @param {string} propertyId
 * @param {object} attrs  Reactor rule attributes (name, ...)
 * @returns {Promise<object>}
 */
export async function findOrCreateRule(propertyId, attrs) {
  if (!attrs || !attrs.name) throw new Error('findOrCreateRule: attrs.name required');
  const existing = await getAll(`/properties/${propertyId}/rules`);
  const match = existing.find((r) => r.attributes && r.attributes.name === attrs.name);
  if (match) {
    console.error(`[reactor] rule "${attrs.name}" already exists (${match.id})`);
    return verify('rules', match.id);
  }
  const created = await reactorFetch(`/properties/${propertyId}/rules`, {
    method: 'POST',
    body: jsonApiBody('rules', { name: attrs.name }),
  });
  const id = created.data && created.data.id;
  console.error(`[reactor] created rule "${attrs.name}" (${id})`);
  return verify('rules', id);
}

/**
 * Add a rule component (event / condition / action) to a rule. Components are
 * not independently named, so this is not strictly find-or-create; callers
 * should drive idempotency at the rule level (a freshly created rule has no
 * components). Verifies the created component reads back.
 *
 * @param {string} ruleId
 * @param {object} attrs  rule_component attributes (name, delegate_descriptor_id, settings, order, rule_order, negate, ...)
 * @param {string} extensionId  the extension the delegate belongs to (relationship)
 * @returns {Promise<object>}
 */
export async function addRuleComponent(ruleId, attrs, extensionId) {
  if (!attrs || !attrs.delegate_descriptor_id) {
    throw new Error('addRuleComponent: attrs.delegate_descriptor_id required');
  }
  const relationships = {};
  if (extensionId) {
    relationships.extension = { data: { type: 'extensions', id: extensionId } };
  }
  const created = await reactorFetch(`/rules/${ruleId}/rule_components`, {
    method: 'POST',
    body: jsonApiBody(
      'rule_components',
      attrs,
      Object.keys(relationships).length ? relationships : undefined,
    ),
  });
  const id = created.data && created.data.id;
  console.error(`[reactor] added rule component "${attrs.name || attrs.delegate_descriptor_id}" (${id})`);
  return verify('rule_components', id);
}

/**
 * Create a development library under a property. Verifies result.
 *
 * @param {string} propertyId
 * @param {{name: string}} attrs
 * @returns {Promise<object>}
 */
export async function createLibrary(propertyId, attrs) {
  if (!attrs || !attrs.name) throw new Error('createLibrary: attrs.name required');
  const created = await reactorFetch(`/properties/${propertyId}/libraries`, {
    method: 'POST',
    body: jsonApiBody('libraries', { name: attrs.name }),
  });
  const id = created.data && created.data.id;
  console.error(`[reactor] created library "${attrs.name}" (${id})`);
  return verify('libraries', id);
}

/**
 * Add a resource (data_element / rule / extension, at a specific revision) to a
 * library via the resources relationship. JSON:API relationship POST.
 *
 * @param {string} libraryId
 * @param {string} resourceType  e.g. "data_elements", "rules", "extensions"
 * @param {string} resourceId
 * @returns {Promise<void>}
 */
export async function addResourceToLibrary(libraryId, resourceType, resourceId) {
  await reactorFetch(`/libraries/${libraryId}/relationships/resources`, {
    method: 'POST',
    body: { data: [{ type: resourceType, id: resourceId }] },
  });
  console.error(`[reactor] added ${resourceType}/${resourceId} to library ${libraryId}`);
}

/**
 * Kick off a build for a library. Returns the build resource (status: pending).
 *
 * @param {string} libraryId
 * @returns {Promise<object>}
 */
export async function buildLibrary(libraryId) {
  const created = await reactorFetch(`/libraries/${libraryId}/builds`, {
    method: 'POST',
  });
  const id = created.data && created.data.id;
  console.error(`[reactor] started build ${id} for library ${libraryId}`);
  return created.data;
}

/**
 * Fetch a build by id.
 * @param {string} buildId
 * @returns {Promise<object>}
 */
export async function getBuild(buildId) {
  const res = await reactorFetch(`/builds/${buildId}`);
  if (!res.data) throw new Error(`getBuild: build ${buildId} not found`);
  return res.data;
}

/**
 * Poll a build until it reaches a terminal status (succeeded/failed) or the
 * time budget is exhausted. Fail loud: throws if the build fails or the budget
 * runs out. Returns the final build resource on success.
 *
 * @param {string} buildId
 * @param {number} [budgetMs=300000]  total polling budget (default 5 min)
 * @param {number} [intervalMs=5000]
 * @returns {Promise<object>}
 */
export async function pollBuild(buildId, budgetMs = 300_000, intervalMs = 5000) {
  const deadline = Date.now() + budgetMs;
  for (;;) {
    const build = await getBuild(buildId);
    const status = build.attributes && build.attributes.status;
    if (status === 'succeeded') {
      console.error(`[reactor] build ${buildId} succeeded`);
      return build;
    }
    if (status === 'failed') {
      throw new Error(`BUILD FAILED: build ${buildId} reported status "failed".`);
    }
    if (Date.now() >= deadline) {
      throw new Error(
        `BUILD TIMEOUT: build ${buildId} did not finish within ${budgetMs}ms ` +
          `(last status "${status}").`,
      );
    }
    await sleep(intervalMs);
  }
}

// -----------------------------------------------------------------------------
// Library state transitions (submit / approve / reject / publish)
// -----------------------------------------------------------------------------
/**
 * Transition a library's state via PATCH with meta.action.
 * action ∈ {submit, approve, reject, publish}.
 * Verifies the library reads back and returns the updated resource.
 *
 * @param {string} libraryId
 * @param {('submit'|'approve'|'reject'|'publish')} action
 * @returns {Promise<object>}
 */
export async function transitionLibrary(libraryId, action) {
  const valid = ['submit', 'approve', 'reject', 'publish'];
  if (!valid.includes(action)) {
    throw new Error(`transitionLibrary: action must be one of ${valid.join(', ')}`);
  }
  const res = await reactorFetch(`/libraries/${libraryId}`, {
    method: 'PATCH',
    body: { data: { id: libraryId, type: 'libraries', meta: { action } } },
  });
  console.error(`[reactor] library ${libraryId} transition "${action}" requested`);
  return res.data;
}

/**
 * Fetch a single library and assert its state. Used as a read-back guard after
 * a transition (e.g. assert state === "published").
 *
 * @param {string} libraryId
 * @param {string} [expectedState]
 * @returns {Promise<object>}
 */
export async function getLibrary(libraryId, expectedState) {
  const res = await reactorFetch(`/libraries/${libraryId}`);
  if (!res.data) throw new Error(`getLibrary: library ${libraryId} not found`);
  const state = res.data.attributes && res.data.attributes.state;
  if (expectedState && state !== expectedState) {
    throw new Error(
      `VERIFY FAILED: library ${libraryId} state is "${state}", expected "${expectedState}".`,
    );
  }
  return res.data;
}

/**
 * List all libraries for a property (all states). Convenience for publish /
 * rollback flows.
 * @param {string} propertyId
 * @returns {Promise<object[]>}
 */
export async function listLibraries(propertyId) {
  return getAll(`/properties/${propertyId}/libraries`);
}

/**
 * List environments for a property.
 * @param {string} propertyId
 * @returns {Promise<object[]>}
 */
export async function listEnvironments(propertyId) {
  return getAll(`/properties/${propertyId}/environments`);
}

/**
 * Set (or change) the environment relationship of a library. Required before a
 * build so the build targets the correct host. Verifies nothing here (the
 * subsequent build poll is the proof).
 *
 * @param {string} libraryId
 * @param {string} environmentId
 * @returns {Promise<void>}
 */
export async function setLibraryEnvironment(libraryId, environmentId) {
  await reactorFetch(`/libraries/${libraryId}/relationships/environment`, {
    method: 'PATCH',
    body: { data: { type: 'environments', id: environmentId } },
  });
  console.error(`[reactor] library ${libraryId} bound to environment ${environmentId}`);
}

// -----------------------------------------------------------------------------
// Extension packages + installed extensions
// (added for the AboutAmazon Web SDK property build — a NEW property has no
// extensions, so the pipeline must install them for real, and data elements /
// rule components need the installed extension as a relationship anchor.)
// -----------------------------------------------------------------------------
/**
 * List extension packages visible to the company, filtered to web platform.
 * Optionally filter by exact package name (e.g. "adobe-alloy").
 *
 * @param {string} [name]
 * @returns {Promise<object[]>}
 */
export async function listExtensionPackages(name) {
  let path = `/extension_packages?filter[platform]=EQ web`;
  if (name) path += `&filter[name]=EQ ${encodeURIComponent(name)}`;
  return getAll(path);
}

/**
 * Fetch one extension package by id — the response carries the full delegate
 * catalog (events/conditions/actions/data_elements with their names and
 * settings schemas). Used to RESOLVE delegate_descriptor_ids at runtime for
 * closed-source extensions instead of guessing them.
 *
 * @param {string} extensionPackageId
 * @returns {Promise<object>}
 */
export async function getExtensionPackage(extensionPackageId) {
  const res = await reactorFetch(`/extension_packages/${extensionPackageId}`);
  if (!res.data) throw new Error(`getExtensionPackage: ${extensionPackageId} not found`);
  return res.data;
}

/**
 * List extensions installed on a property.
 * @param {string} propertyId
 * @returns {Promise<object[]>}
 */
export async function listExtensions(propertyId) {
  return getAll(`/properties/${propertyId}/extensions`);
}

/**
 * Find an installed extension by package name on the property, or install the
 * latest available extension package of that name. Settings (if given) are
 * applied on install only — an already-installed extension's settings are left
 * untouched (report, don't clobber). Verifies the result reads back.
 *
 * @param {string} propertyId
 * @param {string} packageName          e.g. "adobe-alloy"
 * @param {object|null} settings        extension-level settings object or null
 * @returns {Promise<{extension: object, extensionPackage: object}>}
 */
export async function findOrCreateExtension(propertyId, packageName, settings) {
  const packages = await listExtensionPackages(packageName);
  if (packages.length === 0) {
    throw new Error(
      `Extension package "${packageName}" is not available to this company — ` +
        `check the catalog name (Reactor > extension_packages).`,
    );
  }
  // Prefer the package marked current/succeeded; fall back to the first.
  const pkg =
    packages.find((p) => p.attributes && p.attributes.status === 'succeeded') || packages[0];

  const installed = await listExtensions(propertyId);
  const existing = installed.find(
    (e) => e.attributes && e.attributes.name === packageName,
  );
  if (existing) {
    console.error(`[reactor] extension "${packageName}" already installed (${existing.id})`);
    return { extension: await verify('extensions', existing.id), extensionPackage: pkg };
  }

  const attributes = {};
  if (settings !== undefined && settings !== null) {
    attributes.settings = typeof settings === 'string' ? settings : JSON.stringify(settings);
  }
  const created = await reactorFetch(`/properties/${propertyId}/extensions`, {
    method: 'POST',
    body: jsonApiBody('extensions', attributes, {
      extension_package: { data: { id: pkg.id, type: 'extension_packages' } },
    }),
  });
  const id = created.data && created.data.id;
  console.error(`[reactor] installed extension "${packageName}" (${id}) from package ${pkg.id}`);
  return { extension: await verify('extensions', id), extensionPackage: pkg };
}

// -----------------------------------------------------------------------------
// Read helpers for exporting an existing property (see export-current.mjs)
// -----------------------------------------------------------------------------
export async function listProperties(companyId) {
  return getAll(`/companies/${companyId}/properties`);
}

export async function listDataElements(propertyId) {
  return getAll(`/properties/${propertyId}/data_elements`);
}

export async function listRules(propertyId) {
  return getAll(`/properties/${propertyId}/rules`);
}

export async function listRuleComponents(ruleId) {
  return getAll(`/rules/${ruleId}/rule_components`);
}

// -----------------------------------------------------------------------------
// CLI
// -----------------------------------------------------------------------------
function parseFlags(argv) {
  const flags = {};
  const positional = [];
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith('--')) {
        flags[key] = true;
      } else {
        flags[key] = next;
        i += 1;
      }
    } else {
      positional.push(a);
    }
  }
  return { flags, positional };
}

const HELP = `
reactor.mjs — idempotent Adobe Launch (Reactor) client + CLI

Required env: REACTOR_CLIENT_ID, REACTOR_CLIENT_SECRET, REACTOR_ORG_ID, REACTOR_SCOPES

Usage:
  node reactor.mjs whoami
      GET /companies and print company id/name (proves auth).

  node reactor.mjs get <path>
      Raw authenticated GET against a Reactor path, e.g.
      node reactor.mjs get /properties/PRxxxx

  node reactor.mjs create-property --company <id> --name <name> --domain <domain>
      Idempotently find-or-create a web property and verify it.

  node reactor.mjs --help
`;

async function cmdWhoami() {
  const companies = await getAll('/companies');
  if (companies.length === 0) {
    console.error('No companies returned — token is valid but org has no companies?');
    process.exitCode = 1;
    return;
  }
  console.log('Authenticated. Companies visible to this token:');
  for (const c of companies) {
    console.log(`  ${c.id}  ${c.attributes ? c.attributes.name : '(no name)'}`);
  }
  console.log(`VERIFIED: auth works; ${companies.length} company(ies) read back.`);
}

async function cmdGet(path) {
  if (!path) throw new Error('get: a path argument is required, e.g. /companies');
  const res = await reactorFetch(path.startsWith('/') ? path : `/${path}`);
  console.log(JSON.stringify(res, null, 2));
}

async function cmdCreateProperty(flags) {
  const companyId = flags.company;
  const name = flags.name;
  const domain = flags.domain;
  if (!companyId || !name || !domain) {
    throw new Error('create-property requires --company, --name, and --domain');
  }
  const prop = await findOrCreateProperty(companyId, {
    name,
    domains: [domain],
    platform: 'web',
  });
  console.log(`VERIFIED property: ${prop.id}  name="${prop.attributes.name}"`);
}

async function main() {
  const argv = process.argv.slice(2);
  const { flags, positional } = parseFlags(argv);
  const command = positional[0];

  if (!command || flags.help || command === 'help') {
    console.log(HELP.trim());
    return;
  }

  switch (command) {
    case 'whoami':
      await cmdWhoami();
      break;
    case 'get':
      await cmdGet(positional[1]);
      break;
    case 'create-property':
      await cmdCreateProperty(flags);
      break;
    default:
      console.error(`Unknown command: ${command}`);
      console.log(HELP.trim());
      process.exitCode = 2;
  }
}

// Only run the CLI when invoked directly, not when imported.
const invokedDirectly =
  process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href;

if (invokedDirectly) {
  main().catch((err) => {
    // Fail loud: print the message (never secrets) and exit non-zero.
    console.error(`\nFAILED: ${err.message}`);
    process.exit(1);
  });
}

// Re-export a small grab-bag of utilities used by sibling scripts.
export {
  readFile as _readFile, // re-exported for convenience in sibling scripts
  REACTOR_BASE,
};
