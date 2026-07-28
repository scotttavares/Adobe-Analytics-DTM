# Runbook — building and publishing the Web SDK property

Follow the phases in order. Every script fails loud and verifies its writes by
reading them back ("Fail Loud, Never Lie") — a script that exits 0 has proven
what it claims, and a non-zero exit means stop and read the message, not retry
blindly.

## Phase 0 — Credentials (once)

1. In [Adobe Developer Console](https://developer.adobe.com/console), create
   (or reuse) a project with the **Experience Platform Tags / Reactor API**
   added, credential type **OAuth Server-to-Server** (JWT is sunset).
2. Grant the credential's product profile rights to manage Data Collection
   properties in org `E2FF058362D6F0310A495E5B@AdobeOrg`.
3. Export — never commit — the four variables:

   ```bash
   export REACTOR_CLIENT_ID='…'
   export REACTOR_CLIENT_SECRET='…'
   export REACTOR_ORG_ID='E2FF058362D6F0310A495E5B@AdobeOrg'
   export REACTOR_SCOPES='openid,AdobeID,read_organizations,additional_info.projectedProductContext'
   ```

4. Prove auth and capture the company id:

   ```bash
   node scripts/reactor.mjs whoami     # prints CO… company id(s)
   ```

   Put the company id in `catalog/property.json` → `company.id` (or pass
   `--company-id` to the generator each time).

## Phase 1 — Close the unknowns (read-only against the OLD property)

```bash
node scripts/export-current.mjs --property-name "AboutAmazon-US"
```

Writes `snapshot/aboutamazon-us.snapshot.json` (full as-is dump — keep it, it
is the migration's parity reference) and `catalog/acdl-events.overrides.json`
(the real data-layer event settings per rule). This script only performs GETs.

While you have the snapshot open, spot-check two things the workbook implied:
the ACDL extension's exact settings key for the data layer name, and the
`Common Web SDK Plugins` delegate ids — `publish.mjs` re-verifies both against
the live catalog anyway, but a mismatch here is cheaper to see now.

## Phase 2 — Generate + gate

```bash
node scripts/generate-blueprint.mjs                      # first-party edge domain set
# — or, to launch before DNS/cert work is done (audit Fix 3 stays open):
node scripts/generate-blueprint.mjs --interim-third-party-edge

node scripts/preflight.mjs blueprint/aboutamazon-websdk.blueprint.json
```

Preflight must print `PREFLIGHT PASSED`. It hard-fails on any leftover
`CONFIRM-VIA-EXPORT` sentinel and lists the open audit items (interim edge
domain, consent posture) so nobody forgets them.

Re-generate any time a catalog file changes; never hand-edit the blueprint.

## Phase 3 — Provision + build + promote

```bash
node scripts/publish.mjs blueprint/aboutamazon-websdk.blueprint.json          # stage-auto (default)
```

What happens, in order — each step verified before the next:

1. Find-or-create the property, environments (idempotent — safe to re-run).
2. Install the 4 extensions from the org's extension-package catalog and load
   each package's **live delegate catalog**; every delegate id in the blueprint
   is validated (or resolved by display name) before anything is created.
3. Create every data element (75 under the default adobe-variable
   architecture), then 35 rules with ordered components (Update variable →
   Send event, in that order — sequencing matters).
4. Assemble ONE library, build for **Development**, submit + build for
   **Staging**, approve.
5. **Stop at the production gate.** Production requires an explicit human
   approval: re-run with `--approve-production`, or type `PUBLISH` at the
   interactive prompt. This is deliberate — see the audit's cutover risks.

**Library naming convention** (applies to manual libraries too):
`YYYYMMDD - vX.Y - short description` — e.g.
`20260728 - v1.0 - Initial Web SDK Implementation`. The publishing flow then
reads as a release log, and the dated v1.0 production publish doubles as the
documented data boundary Finding 1's fix requires. One library per reviewed
batch of changes; no perpetual "working" library. If you run `publish.mjs`,
do NOT also hand-create a library for the same changes — the pipeline creates
and promotes its own (named to this convention automatically).

## Phase 4 — Verify in Adobe (before any embed change on the site)

- Assurance/Debugger on a dev URL with the new **Development** embed code:
  one `interact` call to the datastream per page view, `renderDecisions: true`,
  Analytics mapping visible in the datastream's Analytics service.
- Confirm report suite routing: dev embed → `aboutamzndev`, stage →
  `aboutamznstg` (datastream-level — this is what retires audit Finding 2).
- Fire each interaction on a test page and check the `data.__adobe.analytics`
  payload carries the same eVars/events as the old property's XDM elements
  (the snapshot from Phase 1 is the parity reference).
- Optional cross-confirmation pass (dev only): temporarily enable the Web
  SDK extension's click collection (internal/external/download), build to
  **Development only**, replay the test actions, and reconcile auto-collected
  download/exit clicks against the rule-driven events (`event16`, redirect
  events) in `aboutamzndev`. Then disable again and rebuild BEFORE
  submit/approve — extension settings ride the library, and production must
  ship with the value the click-collection decision rule in
  `catalog/property.json` prescribes (match the old property for v1.0).

## Phase 5 — Cutover (site change, coordinated)

1. Complete MANUAL-STEPS #1–#3 (datastream Target namespace + service on all
   envs, A4T reporting switch) and ideally #4–#5 (first-party domain, embed
   strategy + prehiding snippet).
2. Swap the site's Launch embed URL from the old property's to the new
   property's **production** embed. The old property keeps serving until the
   swap, so rollback = revert the embed URL.
3. Run the smoke test: fresh incognito session on 3 critical pages — exactly
   one edge `interact` per page view, **zero** `/b/ss/` AppMeasurement calls,
   zero `tt.omtrdc.net` calls, s_ cookies no longer being written.
4. Record the cutover date/time where analysts will see it — the audit requires
   the historical-trend boundary to be documented (Finding 1, fix step 3).
5. After soak, archive/disable the old property's embed codes.

## Rollback

- **Before cutover**: nothing on the live site references the new property —
  delete or ignore it; the old property was never modified.
- **After cutover**: revert the embed URL (fastest), or re-publish the last
  known-good library of the new property via `scripts/rollback.mjs`.
