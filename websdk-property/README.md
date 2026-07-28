# AboutAmazon-US (WebSDK) — new Tags property, as code

This directory stands up the **new Adobe Experience Platform Data Collection
(Tags/Launch) web property** for aboutamazon.com recommended by the
*Adobe Tags Configuration Audit* (Option 1: consolidate Analytics **and**
Target onto the AEP Web SDK). Everything the Reactor API can configure is
defined here as reviewable code; everything it cannot (datastream fields,
Target Admin, DNS, the Next.js embed) is a numbered step in
[docs/MANUAL-STEPS.md](docs/MANUAL-STEPS.md).

**How each audit finding is addressed — finding by finding — is in
[docs/AUDIT-TRACEABILITY.md](docs/AUDIT-TRACEABILITY.md).** The step-by-step
execution guide is [docs/RUNBOOK.md](docs/RUNBOOK.md).

## What gets built

- Property **"AboutAmazon-US (WebSDK)"** (the existing AboutAmazon-US property
  is left untouched until cutover), with Development / Staging / Production
  environments.
- **4 extensions**: Core, Adobe Client Data Layer, AEP Web SDK, Common Web SDK
  Plugins. Deliberately absent: classic Adobe Analytics (Findings 1–2) and both
  classic Target extensions (Findings 3, 4, 8) — their absence *is* the fix.
- **107 data elements**: 71 carried 1:1 from the current property (same names,
  same settings), plus generated payload builders (see below).
- **35 rules**: one consolidated page view (Analytics + Target
  `renderDecisions` on a single edge request), 32 interaction/consent-tracking
  rules, a site-error rule, and a new `Consent - Apply Visitor Choice` rule.

## The shared-builder pattern (Finding 9)

The old property hand-copied one XDM payload shape across ~25 "XDM …" data
elements (the audit found real drift: a reference to a data element that
doesn't exist, one event number double-booked, two orphans). Here, every
payload is **generated from one template** driven by
[`catalog/events-catalog.json`](catalog/events-catalog.json):

```
catalog/*.json  ──▶  scripts/generate-blueprint.mjs  ──▶  blueprint/*.blueprint.json
                                                              │ preflight.mjs (hard gate)
                                                              ▼
                                                          scripts/publish.mjs ──▶ Reactor API
```

Adding a tracked interaction = one catalog entry + re-generate. Hand-editing a
generated payload is prohibited; drift is structurally impossible.

Payloads use the Web SDK **`data.__adobe.analytics` object** (the documented
AppMeasurement-migration path the audit recommends on slide 28) with the
source property's exact eVar/prop/event numbers — no XDM schema is required
until Amazon News adopts AEP applications, at which point a purpose-built
schema (without eVar/prop numbering) is the right move.

## Directory map

| Path | What it is |
|---|---|
| `catalog/property.json` | Org, datastreams, Web SDK instance settings — every audit fix flag with its rationale |
| `catalog/data-elements.catalog.json` | The 71 carried-over data elements + exclusions with reasons |
| `catalog/events-catalog.json` | Single source of truth for every event payload (page view, 32 interactions, site error) |
| `catalog/acdl-events.overrides.example.json` | Shape of the file `export-current.mjs` produces (real data-layer event names) |
| `blueprint/aboutamazon-websdk.blueprint.json` | Generated build plan — currently a **draft** (see below) |
| `scripts/` | Reactor API client + generate / preflight / publish / rollback / export tooling |
| `snippets/prehiding-snippet.html` | Anti-flicker snippet for the page `<head>` (Findings 6+8) |
| `docs/` | Runbook, manual steps, audit traceability |

## Honest state: what is still unresolved

The blueprint is generated as a **draft** and both `preflight.mjs` and
`publish.mjs` refuse drafts. Two things keep it draft, both by design:

1. **Data-layer event names.** The Launch Inspector workbook this build derives
   from does not export *which* `adobeDataLayer` event each of the 35 rules
   listens for. Run `scripts/export-current.mjs` (read-only) against the
   existing property to capture them verbatim, then re-generate.
2. **First-party edge domain** (audit Fix 3) needs the DNS/cert process in
   MANUAL-STEPS #4 — or generate with `--interim-third-party-edge` to launch on
   `edge.adobedc.net` first and cut over later (preflight will keep reminding).

No Adobe credentials are stored in this repo; all scripts read
`REACTOR_CLIENT_ID` / `REACTOR_CLIENT_SECRET` / `REACTOR_ORG_ID` /
`REACTOR_SCOPES` from the environment (OAuth Server-to-Server — see RUNBOOK).
