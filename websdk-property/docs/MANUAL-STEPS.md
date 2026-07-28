# Manual steps — what the Reactor API cannot do

The property itself is fully automated by this repo. The audit's remaining
fixes live in systems the Reactor API does not control. Owners/dates belong in
the audit's Ownership & Timeline table; this file is the "how" for each.

## 1. Datastream — Target service on all three environments

**Audit basis:** Environment Inventory (only About Amazon-Production has the
Target service enabled) + Option 1 (Target delivery moves to the datastream).

In Data Collection → Datastreams, for **About Amazon-Stage**
(`01c5cd30-5087-4bcf-b43c-f26dd8eb37a3`) and **About Amazon-Development**
(`8ba971eb-e510-4ae2-943c-2f0bef0b7b42`): add the **Adobe Target** service with
client code `aboutamzn` and the appropriate non-production Target environment.
Production (`5a6faec7-e010-4f43-b07f-b15a304ac780`) already has Target
(environment 43837). Without this, dev/stage testing of personalization is
impossible.

## 2. Datastream — Target **Third-Party ID Namespace** (Finding 4, half 2)

The audit confirmed this field is **blank** on the production datastream. Set
it on **all three** datastreams' Adobe Target service. The property side
(`targetMigrationEnabled: true`, the "Migrate Target from at.js to the Web
SDK" checkbox) is already configured by this repo — the audit stresses BOTH
halves are required, and recommends confirming the exact combination with
Adobe support before production publish because it affects live visitor
identity (audit slides 15–16).

## 3. Target Admin — A4T reporting (Finding 7)

Target Administration → Reporting → set **Reporting Experience Cloud
Solution** to **"Select per activity"** (Adobe's recommended option), then set
**Adobe Analytics** explicitly on A4T activities such as
"Home page | Intl content module". Verify the A4T provisioning request for
Analytics/Target account linkage is complete if activities cannot select
Analytics. The Analytics-side component group already exists (audit confirmed).

## 4. First-party edge domain (Fix 3 / Finding 5)

**Goal:** replace `edge.adobedc.net` with a subdomain of aboutamazon.com so the
ECID cookie is set in a durable first-party context (the audit quantified
~57.5% of visitors fragmenting under the current setup).

1. Choose the subdomain (e.g. `data.aboutamazon.com` or
   `metrics.aboutamazon.com`) with Amazon's DNS owners.
2. Open the Adobe **first-party device ID / managed-certificate** request
   (Experience League: "First-party device IDs" + "Adobe-managed certificate
   program") for that hostname; Adobe supplies the exact CNAME target and
   provisions TLS.
3. After Adobe confirms the cert is live, create the DNS CNAME.
4. Set `webSdkInstance.edgeDomain` in `catalog/property.json` to the hostname,
   re-run `generate-blueprint.mjs` (without `--interim-third-party-edge`),
   re-publish.
5. Re-run the audit's browser/OS ECID-fragmentation segmentation ~30 days
   later to measure the improvement (audit slide 19's method).

Option B in the audit (FPID, your server sets the ID cookie) is more durable
against ITP but needs server-side work — a separate decision with the
Next.js team.

## 5. Next.js embed strategy + prehiding snippet (Findings 6 + 8)

Today Launch loads via `<Script strategy="lazyOnload">` — after every other
tag, defeating any anti-flicker mechanism and risking undercounted fast
bounces. With the site team:

1. Change the Launch `<Script>` strategy from `lazyOnload` to
   **`afterInteractive`** (or `beforeInteractive` if the flicker budget
   demands it) — a one-line change, but it trades against Core Web Vitals, so
   it is their call to schedule and measure.
2. Inline `snippets/prehiding-snippet.html` in `<head>` **before** the Launch
   script (not through Launch). The Web SDK extension is already configured
   with the matching `prehidingStyle`; the page-view rule renders Target
   decisions on the same call (`renderDecisions: true`), which replaces the
   old property's disabled Body Hiding setting (Finding 8).
3. Update the embed to the NEW property's URL at cutover (RUNBOOK Phase 5).

## 6. Consent posture (Fix 4 — decision, then config)

Current state preserved on day one: `defaultConsent: "in"` (no data loss, same
as today). This repo adds the **`Consent - Apply Visitor Choice`** rule mapping
the site's existing banner selection to `setConsent` in/out — but two
decisions are Amazon's:

1. Confirm the actual `consentSelected` values the banner pushes (the mapping
   data element `consent-generalValue` documents its assumption: explicit
   opt-out strings → `out`, everything else → `in`).
2. Decide whether/when to move `defaultConsent` to `"pending"` (queue events
   until the visitor chooses). That is the full consent-first architecture the
   audit's Fix 4 describes; it requires legal sign-off because it changes
   collected volume.

## 7. Open question from the audit (unchanged)

Ask the Amazon team what the **"Adobe Target Prod"** datastream
(`19fbc097-…dc4a5`, modified Jul 2025) is for. Nothing in this repo uses it;
do not delete until answered (audit Ownership item #6).

## 8. Report suites — no action needed (Finding 2)

`aboutamzndev` / `aboutamznstg` / `aboutamznprod` already exist and are
correctly wired per environment **at the datastream level**. Finding 2 was a
defect of the classic AppMeasurement extension's environment config; that
extension does not exist in the new property. Nothing to configure — listed
here so nobody re-creates report suites unnecessarily.
