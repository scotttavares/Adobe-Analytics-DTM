# Installing & publishing the ClearConsent extension

The extension is a real, packaged Adobe Experience Platform **Tags** extension.
`npm run extension:package` produces `package-clearconsent-1.0.0.zip` (validated
by Adobe's `reactor-packager`), and the Turbine sandbox suite proves a genuine
Tags library builds and runs from it. There are two ways to put it in front of
users — from "easy for your team today" to "one-click for everyone."

## Level 1 — Private extension (available today, no Adobe review)

Upload the package to your own Adobe org. It then shows up in that org's
Extensions catalog, and anyone on your team installs it with a click and
configures it entirely in the UI — no code per property. This is already the
"easy to install" experience for a single organization, and the reason this is
an extension rather than copy-paste custom code.

```bash
npm install && npm run build            # from the repo root
cd launch-extension
npx @adobe/reactor-packager             # -> package-clearconsent-1.0.0.zip
npx @adobe/reactor-uploader package-clearconsent-1.0.0.zip \
  --auth.client-id=<id> --auth.client-secret=<secret>
```

Credentials are Adobe I/O **OAuth Server-to-Server** (JWT was retired Jan 2025);
the uploader also reads `REACTOR_IO_INTEGRATION_CLIENT_ID` / `_CLIENT_SECRET`
from the environment.

## Level 2 — Public one-click via Adobe Exchange (requires Adobe review)

For *any* Launch user to find "ClearConsent" in the Extensions catalog and click
**Install**, the extension has to be listed on **Adobe Exchange**. That is an
Adobe partner submission with a human review — it can't be automated from code,
but the extension is structurally ready and every other asset can be prepared in
advance.

### Prerequisites
- An **Adobe Exchange / Developer Distribution partner account**.
- The packaged `.zip` (we have it).

### Submission asset checklist
| Asset | Status |
| --- | --- |
| Extension package (`.zip`) | ✅ builds from a clean checkout |
| Manifest: name, version, description, author | ✅ `extension.json` |
| Icon | ✅ `resources/icons/consent.svg` (Exchange listings usually also want a raster logo, e.g. a 512×512 PNG) |
| Category / tags | ⬜ choose (e.g. "Privacy & Consent") |
| Screenshots (config UI + banner) | ⬜ can be generated from the demo / sandbox |
| Documentation URL | ✅ this repo (a dedicated docs page reads better) |
| Support contact (email or URL) | ⬜ provide |
| Listing copy (short + long description) | ◻️ draftable from the README |

### What review looks at (and how we're ready for it)
- **Naming.** `clearconsent` is fine; a name beginning with "adobe" would draw
  scrutiny, and the name is **immutable after publishing** — decide before you
  submit.
- **Functionality + security.** Adobe builds a library and exercises the
  extension. `npm run verify:launch` (the Turbine sandbox suite, 18 assertions)
  mirrors that check locally, and CI runs it on every push.
- **The ES-syntax constraint** (Babylon / optional catch binding) is already
  handled by the es2015 vendored build — don't regress it.

### After approval
Installing becomes, for anyone: open your property → **Extensions → Catalog →
ClearConsent → Install → Configure in the UI → Publish**. No code, no upload.

## What can be prepared ahead of the submission
- Screenshots of the tabbed config UI and the live banner (from the demo/sandbox).
- A raster icon (e.g. 512×512 PNG) derived from `consent.svg`.
- Draft short/long listing copy and a category.
- An "Install the extension" call-to-action on the marketing site.

The only step that can't be done from this repo is the Adobe Exchange partner
submission and Adobe's review — those are yours.
