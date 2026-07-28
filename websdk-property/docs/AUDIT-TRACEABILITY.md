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
- **Consolidated payload architecture** (property owner's decision,
  2026-07-28): instead of one generated payload element per interaction, a
  single generated `data-interaction` dispatcher carries the mapping table for
  all 32 interactions, keyed by the triggering data-layer event name — 76
  data elements total instead of 107. Trade-offs accepted: shared blast radius
  (mitigated by generation + the syntax check) and mappings living in code
  rather than per-element UI entries (mitigated by the catalog being the
  reviewable source of truth). Misses are loud by design: an unknown or
  unreadable event reports as linkName `unmapped: <event>` in Custom Links.
  One-time dev-build verification required: confirm the dispatcher reads the
  triggering event's name (the ACDL extension's event object is closed-source;
  the code tries `message`/`detail`/`dataLayer` shapes). `--per-event`
  regenerates the isolated per-event variant if the trade ever reverses.

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
