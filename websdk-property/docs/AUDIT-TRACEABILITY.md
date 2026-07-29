# Audit traceability — every finding → what this build does about it

Source: *Adobe Tags Configuration Audit* (AboutAmazon-US, findings sourced from
the live property) and the Launch Inspector workbook `aboutamazon.com.xlsx`
(production build 2025-08-05). The audit's recommendation — **Option 1:
migrate Target and Analytics fully onto the Web SDK** — is what this property
implements.

| # | Finding | Status here | Where |
|---|---|---|---|
| 1 | Analytics may be double-counting (classic AppMeasurement + Web SDK both → `aboutamznprod`) | **Fixed by construction** — the classic Analytics extension is not installed; the datastream is the only Analytics path. Cutover date must be documented for trend analysis | `catalog/property.json` → `extensions.deliberatelyAbsent`; RUNBOOK Phase 5.4 |
| 2 | No environment separation in classic Analytics (dev/stage/prod all → `aboutamznprod`) | **Retired with the extension** — datastream-level routing (dev→`aboutamzndev`, stage→`aboutamznstg`) was already correct and is what the new property uses | MANUAL-STEPS #8 |
| 3 | Two classic Target libraries, same account (at.js 1.8.3 dormant + 2.11.7 live) | **Fixed by construction** — neither Target extension installed; delivery via datastream. The live rule's hardcoded `at_property` custom code has no equivalent (the datastream's property token governs) | `catalog/property.json` → `extensions.deliberatelyAbsent`, `targetLegacyReference` |
| 4 | Target ⇄ Web SDK identity bridge off (migration checkbox unchecked + datastream namespace blank) | **Half fixed here, half manual** — `targetMigrationEnabled: true` in the Web SDK extension; the datastream Third-Party ID Namespace is MANUAL-STEPS #2. Audit advises confirming the combination with Adobe support pre-publish | `catalog/property.json` → `webSdkInstance`; MANUAL-STEPS #2 |
| 5 | No first-party domain; third-party cookies enabled (~57.5% ECID fragmentation) | **DNS implemented 2026-07-29** — `smetrics.aboutamazon.com` → `s3tp0itpog.data.adobedc.net` (Adobe ticket E-002373472); `edgeDomain` set, `thirdPartyCookiesEnabled: false`. Verify TLS on the hostname before the production publish; re-measure fragmentation ~30 days post-cutover | `catalog/property.json`; MANUAL-STEPS #4 |
| 6 | Launch loads via `lazyOnload` (defeats pre-hiding, may undercount fast bounces, governs nothing) | **Site-side change, assets ready** — embed strategy change + inline prehiding snippet documented; extension carries matching `prehidingStyle` | MANUAL-STEPS #5; `snippets/prehiding-snippet.html` |
| 7 | A4T already live but Target Admin still reports Target-native | **Manual (Target Admin)** — switch to "Select per activity" → Analytics for A4T activities. With Option 1, A4T's SDID stitching rides the single edge request this property sends | MANUAL-STEPS #3 |
| 8 | Body Hiding disabled on the live Target v2 rule | **Superseded** — the at.js rule chain is gone; anti-flicker is now prehiding snippet + `renderDecisions: true` on the consolidated page view | Page-view rule in the blueprint; MANUAL-STEPS #5 |
| 9 | ~25 structurally identical XDM data elements (copy-paste drift) | **Fixed structurally** — all payloads generated from one template off `catalog/events-catalog.json`; runtime skeleton shared via `data-analyticsBase`. Drift found during extraction is quarantined (below) | `scripts/generate-blueprint.mjs`; `catalog/events-catalog.json` |
| — | Two-pathway root cause (audit slides 26–27): the pathway that decides content is not the pathway Analytics rides | **Fixed by consolidation** — ONE `sendEvent` per page view carries `renderDecisions: true` (Target) and the Analytics payload to the same datastream | `Global Page Load Rule` in the blueprint |

## Finding 1 refinement (likely explanation for the "intermittent" signature)

The `s_` cookies the audit captured as classic-AppMeasurement evidence
(`s_gpv`, `s_dur`, `s_vnc365`, `s_tslv`, `s_nr30`, `s_inv`) are the cookies the
**Common Web SDK Plugins** data elements write — from inside the Web SDK build
itself (getPreviousValue → `s_gpv`, visit number → `s_vnc365`, new/repeat →
`s_nr30`, etc.). Combined with the workbook showing the production build
contains no classic Analytics extension, the Debugger's later "Not Found", and
zero `/b/ss/` requests on re-checks, the most defensible read is that the
"classic system" was never firing — one pathway wearing the other's costume.
**Confirm during Phase 1/4:** (a) the export snapshot shows the classic
extension absent from the live build's resources, and (b) a fresh incognito
session shows zero `/b/ss/` requests. If confirmed, Finding 1's residual risk
re-grades from "possible metric inflation" to "misleading configuration that
never fired" — the fix (extension absent here) is identical either way, but
the historical-data guidance to analysts changes materially.

## Drift found while extracting (Finding 9's prediction, confirmed)

Quarantined rather than silently carried:

- **`XDM Article`** referenced `%Article Publish Date%` — a data element that
  does not exist (`Publish Date` is the real one). The element was also an
  orphan (no rule sends it). Excluded; re-add via the catalog if Article
  tracking is actually wanted.
- **`XDM Video Play`** — orphan (no rule) duplicating Video Start's `event11`.
  Excluded.
- **`event28` double-booked** between XDM Article and XDM Video Pause — but
  **latent, not active**: the Article rule that would send it turned out to be
  a never-published draft (below), so production fires `event28` only from
  Video Pause. Carried 1:1; if article tracking is revived it must take a
  fresh event number (`events-catalog.json → excludedRules`).
- **`ECID` data element** was `return _satellite.getVar("ECID")` — a recursive
  self-reference that always returned undefined. Dropped (the SDK manages
  identity; nothing referenced it).
- **`Internal Campaign`** (now `Campaign: Internal`) was `console.log();`
  (always undefined), so `eVar5`/`event4` have never populated. **Decision
  made 2026-07-29 (property owner): keep it a no-op** — internal-campaign
  tracking is deferred, parity with the source, `event4` stays off (it is
  already filtered out of the generated page view). The element carries a
  documented `return undefined;` (behaviorally identical to the source, no
  console noise). To activate later: implement the real internal-campaign
  parameter here (site-team confirmation, MANUAL-STEPS #6) and `event4`
  comes alive.
- **Rules-list census (2026-07-29): 40 rules in the old property, all
  accounted for.** 35 were in the workbook's production build — the 34
  analytics rules this property carries forward plus `All Pages - Library
  Loaded`, which is the live Target v2 rule (hardcoded `at_property` custom
  code, `bodyHidingEnabled: false` — Findings 3/8 in rule form) and is
  excluded **by design**, superseded by `renderDecisions: true` + the
  prehiding snippet. The remaining 5: **two never-published drafts excluded
  with evidence** — `Article Interaction Tracking` and `Sort By Tracking`,
  both by the same author, both showing "Not yet published" / "No libraries
  using this revision" / not live in their Details panels (Article was
  briefly carried here until its publish-state check flipped it; its payload
  is preserved in `excludedRules` for revival under a fresh event number) —
  and the **three `Newsletter Test:` rules** (`Form Success`, `Proposition
  Display Notification`, `Resolve Experience`): a LIVE single-request
  personalization prototype added to production after the workbook export.
  **Decided 2026-07-29: the test continues, folded in natively** (below); the
  pilot rules stay in the old property and retire at cutover.
- **`Sort By Tracking` + `XDM Sort By`** — an enabled-but-**never-published**
  draft pair (last modified May 2024; Details panel: "Not yet published", "No
  libraries using this revision", not live — verified by contrast with a live
  rule's panel, which reads "Live in production"). Production has never fired
  `sortBy`, so the pair is **excluded** rather than carried; if sort-by
  tracking is wanted it is new scope, specced fresh in the catalog
  (`events-catalog.json → excludedRules`).
- Revision hygiene observed while verifying: `Internal Search ClickThrough`'s
  Send-event action has a head revision (Jan 2024) newer than what production
  runs ("Last Published: Not yet published" on the latest revision while the
  rule itself is "Live in production"). No impact here — payload mappings come
  from the workbook, which reflects the production build — but the old
  property carries unpublished edits, one more reason cutover parity checks
  run against production behavior, not the old property's edit screens.
- Cosmetic drift: leading spaces in the four Scroll interaction names
  (trimmed), double spaces in two Map rule names (normalized) — both listed in
  `anomaliesCarriedForNow` so reporting owners can confirm.

## Deviations from the source property, on purpose

- **`data.__adobe.analytics` instead of XDM-object payloads.** The audit's own
  guidance (slide 28): with no AEP subscription there is no downstream reason
  to model eVars/props as XDM; the data object is the documented migration
  path. When AEP arrives, build a real schema with descriptive names instead.
- **Empty values are omitted** from payloads (the old XDM elements could emit
  empty strings). Cleaner beacons; noted here because hit-level QA diffs will
  show absent-vs-empty differences.
- **Automatic click collection off** (`clickCollectionEnabled: false`) — the
  site's click tracking is bespoke via the data layer; leaving the SDK's
  automatic link tracking on would double-count link activity (same disease as
  Finding 1).
- **New rule** `Consent - Apply Visitor Choice` (Fix 4 groundwork) — the site
  already *tracked* the consent choice; now it also *applies* it.
- **Newsletter sign-up test carried natively** (owner's decision,
  2026-07-29). The owner's live pilot — itself a proof of the audit's
  single-request principle, scoped to one test — continues in this property
  with four deliberate improvements over the pilot's mechanics
  (`events-catalog.json → newsletterTest.deviationsFromPilot`): the
  `newsletter-signup-contextual` scope rides the consolidated page view's
  **single** edge request (the pilot made a second per-page call); the
  response is consumed by a **Send event complete** rule instead of code in a
  `.then()`; *Include rendered propositions* is off on the display
  notification (a no-op in the pilot, an over-reporting bug waiting to happen
  next to `renderDecisions: true`); and the proposition data element is
  specced from Adobe's documented notification payload. The site contract —
  `adobeTarget:flag`, `window.__newsletterProposition`, `Form:onSuccess` — is
  unchanged: **zero site-side work**. Consent classification C0004 pending
  MANUAL-STEPS #6; when gating goes live the page view's `decisionScopes`
  must be conditioned on that category too.
- **Payload architecture: Adobe's Variable / Update Variable pattern**
  (property owner's decision, 2026-07-28, superseding the earlier
  consolidated-code-dispatcher decision the same day). Rationale: (a) it is
  the pattern Adobe's own Analytics-migration documentation prescribes —
  defensible to the client verbatim; (b) the inheriting client team is
  UI-first, so mappings belong in form-based rule actions, not custom code.
  Shape: three Web SDK Variable elements (`data-pageView`, `data-interaction`,
  `data-siteError`; Data object, Analytics solution); every rule pairs an
  **Update variable** action (that event's field mappings, entered as form
  values) with the **Send event** action. 75 data elements total. The mapping
  SPEC remains `catalog/events-catalog.json` — the build sheet renders each
  rule's form entries from it, and the export-diff verification machine-checks
  the hand-entered forms against it. Two things to verify in Phase 4 QA:
  (1) **residue** — the shared `data-interaction` variable persists for the
  page lifetime, so a non-navigating event can carry the previous event's
  eVars unless each Update Variable action clears prior values (use the
  action's clear/remove affordance; test: form-start then scroll-25, inspect
  the scroll beacon for eVar10/eVar19); (2) `event4` (internal campaign,
  valued) is deliberately omitted until the `icid` decision lands — it never
  fired in the source property (its feeding element was a no-op stub), so
  omission is parity. Generated-code alternatives remain available:
  `--consolidated` and `--per-event`.

## Assumptions that must be verified before production (all machine-enforced)

1. **Data-layer event names per rule** — sentinel-blocked until
   `export-current.mjs` supplies them (preflight + publish refuse drafts).
2. **Closed-source delegate ids** (ACDL event/data-element, Common Web SDK
   Plugins data elements) — best-known ids in the catalogs; `publish.mjs`
   validates every id against the live extension-package catalog and resolves
   by display name, hard-stopping on any mismatch.
3. **ACDL extension settings key** for the data layer name — validated the same
   way at install time.
4. **Consent value mapping** (`consent-generalValue`) — assumption documented
   in the generated code; MANUAL-STEPS #6.
