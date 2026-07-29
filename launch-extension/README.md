# adobe-consent — Adobe Launch (Tags) extension

The consent manager packaged as a native Adobe Experience Platform Tags
extension.

## What makes this different from a hosted CMP extension

The library is **`require`d into the Tags runtime library** from
`src/lib/vendor/adobe-consent.js`, rather than fetched from a CDN at runtime.
There is no stub script, no config fetch, and no second SDK download — the
banner can paint as soon as your Launch library has. That is the whole reason
this is a real extension rather than a Custom Code action.

## Building

The vendored bundle is generated from the repo source, so build from the repo
root first:

```bash
cd ..
npm install
npm run build     # writes launch-extension/src/lib/vendor/adobe-consent.js
cd launch-extension
```

Then package and upload:

```bash
npx @adobe/reactor-packager
# -> package-adobe-consent-1.0.0.zip

npx @adobe/reactor-uploader package-adobe-consent-1.0.0.zip \
  --auth.client-id=<id> --auth.client-secret=<secret>
```

The uploader uses Adobe I/O **OAuth Server-to-Server** credentials (JWT was
retired in January 2025). It also reads
`REACTOR_IO_INTEGRATION_CLIENT_ID` / `_CLIENT_SECRET` from the environment.

## Testing it for real

Packaging only validates `extension.json` against Adobe's JSON schema. It says
nothing about whether a Tags library can actually be *built* from the extension,
or whether the modules run. The sandbox does both:

```bash
npm run sandbox          # from the repo root; serves http://localhost:3000
npm run verify:launch    # in another shell — 18 assertions in real Chromium
```

That builds a genuine Turbine library from `.sandbox/container.js` and asserts
the extension boots inside it, the CMP is inlined rather than fetched, the
configuration reaches the engine, the banner renders, and every data element
resolves through `_satellite.getVar`. CI runs it on every push.

### The ES-syntax constraint this caught

Adobe's Tags build pipeline parses extension code with **Babylon**, a parser
that predates ES2019. Optional catch binding —

```js
try { risky(); } catch { fallback(); }   // no parameter
```

— makes the library build fail with
`SyntaxError: Unexpected token, expected (` inside `parseTryStatement`. The
extension still packages and uploads cleanly; the failure only appears when a
library is built, which is why it is easy to ship by accident.

The vendored bundle is therefore built with an **es2015** target
(`scripts/build.mjs`), which transpiles that syntax back to `catch (e)`. If you
add hand-written code under `src/lib/`, keep it to conservative ES5-era syntax
for the same reason.

## What the extension provides

**Events**

- **Consent Changed** — any change; optionally also fires on page load with the
  consent already in effect.
- **Consent Granted for Category** — fires when a category becomes granted, and
  on page load if it already is. That second half is what makes "load this tag
  when the visitor has consented to analytics" work for returning visitors.
- **Consent Revoked for Category** — for tearing down whatever the granted rule
  set up.

**Condition** — **Has Consent**. Fails closed when consent cannot be resolved.

**Actions** — Show Preference Center · Show Consent Banner · Set Consent
(accept all / reject all / grant and deny specific categories) · Reset Consent ·
Re-scan Blocked Tags.

**Data elements** — Consent Status (`boolean`, `y`/`n`, `in`/`out`, `1`/`0`) ·
Consent Summary String · Consent Region · Consent XDM Object.

**Shared module** — `consent-api`:

```js
var consent = turbine.getSharedModule('adobe-consent', 'consent-api');
consent.gate('advertising', function () { loadRemarketingPixel(); });
```

Category pickers in the rule builder are populated from the categories the
property is actually configured with, read from `info.extensionSettings`.

## Configuring the other Adobe extensions

| Extension | Setting |
| --- | --- |
| Adobe Experience Platform Web SDK | **Default Consent** → *Pending* |
| Experience Cloud ID Service | **Enable Opt-In** → *Yes*; leave Permissions and Pre Opt In Approvals empty |

This extension is the source of truth and calls both APIs directly.

## Layout

```
extension.json                    manifest (validated by @adobe/reactor-packager)
src/lib/
  main.js                         runs at library load; boots the CMP
  buildConfig.js                  flat extension settings -> nested library config
  instance.js                     singleton lookup with a window fallback
  vendor/adobe-consent.js         generated — do not edit, run `npm run build`
  events/ conditions/ actions/ dataElements/ sharedModules/
src/view/                         configuration and element views
resources/icons/consent.svg
```

## A note on the extension name

The manifest name is `adobe-consent`, which is descriptive of what it does
rather than a claim of Adobe authorship. Adobe's published naming rules
(lowercase, URL-safe, ≤214 characters, immutable after publish) do not prohibit
it, and this is intended as a private extension. If you submit it to Adobe
Exchange as a public extension, expect review to have an opinion about a name
beginning with "adobe" and be ready to rename — the name cannot be changed after
publishing, so decide before you submit.
