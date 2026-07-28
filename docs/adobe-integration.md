# Adobe integration guide

How consent gets from the dialog into each Adobe product, what you have to
configure, and what you deliberately do not.

---

## 1. AEP Web SDK (alloy)

### What the library sends

On page load and on every change, for every alloy instance it can find:

```js
alloy("setConsent", {
  consent: [{
    standard: "Adobe",
    version: "2.0",
    value: {
      collect:     { val: "y" },
      share:       { val: "n" },
      personalize: { content: { val: "y" } },
      metadata:    { time: "2026-07-28T22:47:03.114Z" }
    }
  }]
});
```

Instances come from `window.__alloyNS`, falling back to a global named `alloy`.
A multi-instance property gets a call per instance with no configuration.

### Configure the Web SDK for `pending`

In the Web SDK extension, set **Default Consent** to **Pending**. Alloy then
holds every `sendEvent` until it hears from us, which is what stops a page-view
beacon racing the banner.

Two things worth knowing about that queue:

- It lives **in memory only** and does not survive a reload.
- `defaultConsent` itself **does not persist between page loads** — the Web SDK
  extension sets it on every `configure`, which is why it must be `Pending` in
  the extension config rather than set once at runtime.

### Why `setConsent` fires on every page load

Alloy keeps its own `kndctr_<orgId>_consent` cookie (180-day expiry), so it can
restore a preference without us. Re-asserting an unchanged decision is still the
right default because Adobe only makes a server call **when the value actually
changes** — so the cost is a function call, and in exchange the SDK and the CMP
can never silently disagree. Turn it off with
`adobe.webSdk.sendOnEveryPageLoad: false` if you would rather send only on
change.

### The `collect` mapping is deliberate

By default `collect` is granted if **any** of analytics, personalization, or
advertising is granted:

```js
adobe: { mapping: { collect: ['analytics', 'personalization', 'advertising'] } }
```

Mapping `collect` to analytics alone looks tidier and is a trap: Adobe documents
Web SDK consent enforcement as currently **all-or-nothing, keyed on `collect`**,
so `collect: n` stops collection outright. A visitor who allowed
personalization but refused analytics would have their personalization data
dropped too.

### `adID` is not sent on the web

XDM's `adID` requires an `idType` of `IDFA` or `GAID` alongside the value —
those are mobile advertising identifiers with no web equivalent. It is omitted
unless you explicitly name a type:

```js
adobe: { webSdk: { adIdType: 'IDFA' } }   // hybrid/app contexts only
```

### Consent travelling with an event

`setConsent` updates the profile; it does not attach consent to your other
events. If you also want it on an event, the **Consent XDM Object** data element
returns the same `value` object for mapping onto `xdm.consents`.

---

## 2. ECID Opt-In service

This is the path that matters for an AppMeasurement / at.js / DIL estate — the
classic libraries check `adobe.optIn` before they fire or set cookies.

### Turn it on

In the **Experience Cloud ID Service** extension, set **Enable Opt-In** to
*Yes*. Leave **Pre Opt In Approvals** and **Permissions** empty — this library
is the source of truth and calls the API directly.

### What the library calls

```js
adobe.optIn.approve(['ecid', 'aa'], true);   // true = stage, don't apply yet
adobe.optIn.deny(['target', 'aam'], true);
adobe.optIn.complete();                      // one atomic apply
```

Staging both sides and completing once avoids the half-applied state you get
from calling `approve()` and `deny()` separately.

### Unknown categories are filtered out

Adobe's API reference documents four categories (`aam`, `aa`, `ecid`,
`target`), but the shipped VisitorAPI defines eight (adding `adcloud`,
`campaign`, `livefyre`, `mediaaa`). Passing an id the loaded library does not
know makes the **whole call fail** with `[OptIn] Invalid category(-ies)` — a
real error people have hit after OneTrust extension upgrades. The adapter reads
`adobe.OptInCategories` at runtime and drops anything the page does not define.

### Default mapping

| Opt-In category | Granted by |
| --- | --- |
| `ecid` | analytics, personalization, or advertising |
| `aa` (Analytics) | analytics |
| `target` | personalization |
| `aam` (Audience Manager) | advertising |

---

## 3. Adobe Analytics (AppMeasurement)

The Opt-In service already gates AppMeasurement. This adapter additionally sets:

```js
s.abort  = true;   // short-circuits the next t() / tl()
s.optOut = true;   // durable flag checked on every beacon
```

That exists for the estate you actually have rather than the one you wish you
had: a hardcoded `s.t()` in page source, outside Tags, is not covered by
Opt-In's extension wiring. Point it at a custom tracker variable with
`adobe.analytics.instanceGlobal: 's_meridian'`.

---

## 4. Adobe Client Data Layer

Every change pushes:

```js
adobeDataLayer.push({
  event: 'consent-updated',
  consent: {
    categories: { essential: true, analytics: true, personalization: false, advertising: false },
    granted: ['essential', 'analytics'],
    denied: ['personalization', 'advertising'],
    adobe: { collect: true, share: false, personalize: false, analytics: true, target: false, audienceManager: false },
    method: 'save_choices',
    region: 'DE',
    model: 'opt_in',
    policyVersion: 1,
    receiptId: '…',
    pending: false
  }
});
```

Pushes made before ACDL loads are queued by its array stub and replayed, and a
listener registered with the default `all` scope also receives events that
already fired — so ordering between the data layer and this library does not
matter.

---

## 5. Launch / Tags

### Extension elements

**Events**

| Event | Fires when |
| --- | --- |
| Consent Changed | any change; optionally also on load with the consent already in effect |
| Consent Granted for Category | a category becomes granted — **and on load if it already is** |
| Consent Revoked for Category | a category is withdrawn |

That "and on load if it already is" is the important one. The obvious rule —
*load this tag when the visitor has consented to analytics* — silently never
runs for returning visitors in most CMPs, because a change event only fires on a
transition.

**Condition** — `Has Consent`, which fails closed if consent cannot be resolved.

**Actions** — Show Preference Center, Show Consent Banner, Set Consent
(accept all / reject all / grant and deny specific categories), Reset Consent,
Re-scan Blocked Tags.

**Data elements** — Consent Status (`boolean` / `y`-`n` / `in`-`out` / `1`-`0`),
Consent Summary String, Consent Region, Consent XDM Object.

Rule authors pick categories from a **dropdown populated with the categories
this property is actually configured with**, rather than retyping ids.

### Shared module

```js
var consent = turbine.getSharedModule('adobe-consent', 'consent-api');

if (consent.hasConsent('analytics')) { /* … */ }
consent.gate('advertising', function () { loadRemarketingPixel(); });
```

### Direct call rules

A direct call fires on every change:

```js
_satellite.track('adobe-consent-changed', { consent: {…}, method: '…', region: '…' });
```

Read it in a rule as `%event.detail.consent.analytics%`. Note the `detail`
segment — that is how `_satellite.track` payloads surface, and it differs from
the extension's own events, where `trigger()` merges into the event directly
(`%event.consent.analytics%`).

Adobe now labels `_satellite.track` a legacy method and points new work at the
data layer, so prefer the ACDL integration or the extension's own events; the
direct call is there for properties already built around it. Enable
`perCategoryDirectCalls` to also get `consent-analytics-granted` style
identifiers.

---

## 6. Reporting on consent in Analytics / CJA

The **Consent Summary String** data element produces a single low-cardinality
value:

```
essential+analytics|save_choices|EU
```

Set it into one prop or eVar and you can report consent rate, method mix, and
regional split from one dimension instead of four. Pair it with **Consent
Region** if you want jurisdiction as its own breakdown.

Do not send this from a beacon that analytics consent has denied — by
definition, those visitors are not in your data. Consent-rate denominators have
to come from a source that is allowed to fire, which usually means a
server-side log or an essential-category beacon.

---

## 7. Migrating from OneTrust

Keep OneTrust's UI while you cut over the plumbing, or replace both.

**Plumbing only** — run headless and feed it from `OptanonWrapper`:

```js
window.adobeConsentConfig = { ui: { headless: true } };

function OptanonWrapper() {
  var active = (window.OnetrustActiveGroups || '').split(',');
  AdobeConsent.instance.save({
    analytics:       active.indexOf('C0002') !== -1,
    personalization: active.indexOf('C0003') !== -1,
    advertising:     active.indexOf('C0004') !== -1
  });
}
```

All the Adobe wiring then runs from here and the OneTrust-specific custom code
goes away.

**Full replacement** — drop the OneTrust scripts, delete the mapping code, and
map the categories once in configuration. The usual gotcha is markup: OneTrust's
auto-blocking uses `class="optanon-category-C0002"`, this uses
`data-cc-category="analytics"`, so tagged scripts need a find-and-replace.

---

## 8. Verifying it works

```bash
npm run demo     # then open the Consent Inspector section
npm run verify   # 35 assertions in real Chromium
```

On a live site, with Launch debugging on:

```js
_satellite.setDebug(true);          // extension logs region, model, environment
AdobeConsent.instance.decision;     // what is granted right now
AdobeConsent.instance.state;        // method, region, policy version, receipt id
AdobeConsent.instance.getReceipts();// local audit trail
document.cookie.match(/adobe_consent=[^;]*/);
```

Check that `kndctr_<orgId>_consent` appears after a decision — that is alloy
acknowledging `setConsent`.
