# Adobe Exchange listing — ClearConsent

Draft copy and assets for submitting ClearConsent to the Adobe Exchange
marketplace as a public Adobe Experience Platform **Tags** extension. See
[`../PUBLISHING.md`](../PUBLISHING.md) for the submission runbook.

---

## Name
**ClearConsent — Cookie Consent Manager**

## Category / tags
Privacy & Consent · Data Governance · Consent Management (CMP)
Tags: `consent`, `cmp`, `gdpr`, `ccpa`, `gpc`, `privacy`, `web-sdk`, `ecid`, `analytics`

## Short description (catalog card, ~150 chars)
A fast, accessible, self-hosted cookie consent manager that wires consent
straight into the Web SDK, ECID Opt-In, Analytics, and the data layer — no code.

## Long description

ClearConsent is a cookie consent manager (CMP) built for Adobe estates. Instead
of bolting a generic banner onto Adobe with custom code, it drives the Adobe
consent APIs directly and installs as a native Tags extension, so the whole
thing lives inside the property you already publish.

**No extra network requests.** The library is inlined into your Tags runtime
library rather than fetched from a CDN, so the banner can paint as soon as your
Launch library has — no stub, no config round-trip, no second SDK download.

**No glue code.** Point-and-click configuration replaces the usual hand-written
recipe of parsing category strings and mapping them onto `adobe.optIn` and Web
SDK `setConsent`. The mapping is configuration; the Adobe calls are the
extension's job.

**Consent, wired to Adobe on every load and every change:**
- **AEP Web SDK** — `setConsent` in the Adobe 2.0 standard, on every instance.
- **ECID Opt-In** — staged approve/deny, then a single `complete()`.
- **Adobe Analytics (AppMeasurement)** — sets `s.abort` / `s.optOut`.
- **Adobe Client Data Layer** — pushes a `consent-updated` event.
- **Tags** — direct-call rules your other rules can gate on.

**Compliance defaults that can't be misconfigured away:** reject is always as
prominent as accept, nothing is pre-ticked in opt-in regions, Escape records a
rejection, and Global Privacy Control is honored by default (binding under CPRA
and Colorado law). Region rules resolve opt-in / opt-out / notice with
specificity matching and never block first paint.

**Accessible by construction:** a shadow-DOM dialog with `role="dialog"`, a focus
trap, focus restoration, background `inert`, a polite live region, and
reduced-motion and forced-colors support. Zero axe-core violations.

**What it provides in the rule builder:** 3 events (Consent Changed, Consent
Granted for Category, Consent Revoked for Category), a Has Consent condition,
5 actions (Set Consent, Show Banner, Show Preference Center, Reset Consent,
Re-scan Blocked Tags), 4 data elements (Consent Status, Summary String, Region,
XDM Object), and a shared `consent-api` module with a `gate()` helper.

**Companion cookie tooling — in the open-source repo, not the installed
extension.** The project also ships a curated cookie catalog (each entry has a
plain-language description, the company behind it, and a privacy-policy link),
used two ways: a pre-deploy crawl script that emails a diff when a new cookie
appears, and a runtime scanner shown on the project site. Installing the Tags
extension gives you the CMP and the Adobe wiring — the catalog and scanner are
repo/CI tooling, not part of the install.

Self-hosted and MIT-licensed. Not included in the extension: a *certified* IAB
TCF string and registered CMP ID (the bundled TCF surface is an experimental,
labeled starter), and the breadth of a hosted, legally-reviewed cookie database —
if you need those, a hosted CMP is a fair choice.

## Assets in this folder
| File | Use |
| --- | --- |
| `icon-512.png` | 512×512 listing icon (also `../resources/icons/consent.svg`) |
| `screenshot-config-general.png` | Config UI — consent model, signals, blocking |
| `screenshot-config-categories.png` | Config UI — category editor |
| `screenshot-config-adobe.png` | Config UI — Adobe wiring |
| `screenshot-banner.png` | The live consent banner |

## Still to provide before submitting
One blocker remains that can't come from this repo:

- **Support contact** — email or URL, shown publicly on the listing.
  Fill in: `SUPPORT_CONTACT = ____________`

Decided / optional:
- **Name** — "ClearConsent" (the manifest ships `clearconsent`). Immutable after
  publish; no leading "adobe", so it's clear of Adobe's naming scrutiny.
- **Documentation URL** — optional; this repo's README + `docs/` work. A dedicated
  hosted page reads better if you have one.
