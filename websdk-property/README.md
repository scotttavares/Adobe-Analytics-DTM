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
- **76 data elements**: 71 carried 1:1 from the current property (same names,
  same settings), plus 3 Web SDK **Variable** elements (`data-pageView`,
  `data-interaction`, `data-siteError` — Adobe's documented Analytics
  data-object pattern; values are filled by form-based **Update variable**
  actions in each rule, so the inheriting team maintains mappings in the UI,
  not in code), the consent mapper, and the newsletter test's proposition
  element. The mapping SPEC still lives in `catalog/events-catalog.json`; the
  build sheet renders per-rule form instructions from it and the export-diff
  verifies hand entry against it. Generated-code alternatives remain:
  `--consolidated` (one code dispatcher) and `--per-event` (one code element
  per interaction).
- **38 rules**: one consolidated page view (Analytics + Target
  `renderDecisions` **and** the newsletter test's decision scope on a single
  edge request), 32 interaction/consent-tracking rules, a site-error rule, a
  new `Consent - Apply Visitor Choice` rule, and the 3-rule **newsletter
  sign-up test** carried natively from the owner's live pilot
  (`events-catalog.json → newsletterTest` — response handler on *Send event
  complete*, display notification, combined conversion event; site contract
  unchanged).

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

## State: fully resolved (2026-07-29)

The blueprint generates with **zero unresolved items** and `preflight.mjs`
passes all checks. The two former draft-blockers are closed: every rule's
`adobeDataLayer` event name was verified verbatim from the live property, and
the first-party edge domain is real (`smetrics.aboutamazon.com`, Adobe ticket
E-002373472 — verify TLS on the hostname before the production publish, per
MANUAL-STEPS #4). The draft-gating machinery stays: any future catalog entry
with a `CONFIRM-VIA-EXPORT` sentinel or unknown payload re-drafts the
blueprint, and `preflight.mjs`/`publish.mjs` refuse drafts.

No Adobe credentials are stored in this repo; all scripts read
`REACTOR_CLIENT_ID` / `REACTOR_CLIENT_SECRET` / `REACTOR_ORG_ID` /
`REACTOR_SCOPES` from the environment (OAuth Server-to-Server — see RUNBOOK).
