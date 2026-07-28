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
| 5 | No first-party domain; third-party cookies enabled (~57.5% ECID fragmentation) | **Config ready, DNS pending** — `thirdPartyCookiesEnabled: false` now; `edgeDomain` takes the first-party hostname once the Adobe-managed cert exists. `--interim-third-party-edge` launches on `edge.adobedc.net` and preflight keeps the item visibly open | `catalog/property.json`; MANUAL-STEPS #4; preflight "Open audit items" |
| 6 | Launch loads via `lazyOnload` (defeats pre-hiding, may undercount fast bounces, governs nothing) | **Site-side change, assets ready** — embed strategy change + inline prehiding snippet documented; extension carries matching `prehidingStyle` | MANUAL-STEPS #5; `snippets/prehiding-snippet.html` |
| 7 | A4T already live but Target Admin still reports Target-native | **Manual (Target Admin)** — switch to "Select per activity" → Analytics for A4T activities. With Option 1, A4T's SDID stitching rides the single edge request this property sends | MANUAL-STEPS #3 |
| 8 | Body Hiding disabled on the live Target v2 rule | **Superseded** — the at.js rule chain is gone; anti-flicker is now prehiding snippet + `renderDecisions: true` on the consolidated page view | Page-view rule in the blueprint; MANUAL-STEPS #5 |
| 9 | ~25 structurally identical XDM data elements (copy-paste drift) | **Fixed structurally** — all payloads generated from one template off `catalog/events-catalog.json`; runtime skeleton shared via `data-analyticsBase`. Drift found during extraction is quarantined (below) | `scripts/generate-blueprint.mjs`; `catalog/events-catalog.json` |
| — | Two-pathway root cause (audit slides 26–27): the pathway that decides content is not the pathway Analytics rides | **Fixed by consolidation** — ONE `sendEvent` per page view carries `renderDecisions: true` (Target) and the Analytics payload to the same datastream | `Global Page Load Rule` in the blueprint |

## Drift found while extracting (Finding 9's prediction, confirmed)

Quarantined rather than silently carried:

- **`XDM Article`** referenced `%Article Publish Date%` — a data element that
  does not exist (`Publish Date` is the real one). The element was also an
  orphan (no rule sends it). Excluded; re-add via the catalog if Article
  tracking is actually wanted.
- **`XDM Video Play`** — orphan (no rule) duplicating Video Start's `event11`.
  Excluded.
- **`event28` double-booked** between XDM Article and XDM Video Pause. Video
  Pause keeps `event28` for parity; flagged in
  `events-catalog.json → anomaliesCarriedForNow` for the analytics owner.
- **`ECID` data element** was `return _satellite.getVar("ECID")` — a recursive
  self-reference that always returned undefined. Dropped (the SDK manages
  identity; nothing referenced it).
- **`Internal Campaign`** was `console.log();` (always undefined), so
  `eVar5`/`event4` have never populated. Re-implemented reading an assumed
  `icid` query parameter, **flagged as a decision** in the catalog.
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
