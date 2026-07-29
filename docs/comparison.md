# How this compares

Honest comparison with the CMPs an Adobe shop usually evaluates. Claims about
other products are sourced; where a number comes from a competitor's benchmark
rather than an independent one, that is flagged.

---

## Summary

| | adobe-consent | OneTrust | Cookiebot |
| --- | --- | --- | --- |
| Payload | 14.6 KB gzip, 1 request — **0 extra requests** as a Launch extension | ~184 KB / 16 requests (benchmark) | ~34 KB, ~209 DOM nodes |
| Requests before the banner can paint | 0 (inlined in the Tags library) | 3 dependent (stub → domain config → SDK) | 1, synchronous by default |
| Adobe Launch extension | yes, purpose-built | yes, since 2018 — surfaces `OnetrustActiveGroups`; consent logic still custom | none found; only a deprecated DTM guide |
| Web SDK `setConsent` | automatic, every instance | custom rules and data elements | fully custom |
| ECID Opt-In | automatic, unknown categories filtered | hand-mapped custom code | fully custom |
| AppMeasurement `abort`/`optOut` | automatic | not covered | not covered |
| Reject as prominent as accept | enforced, not configurable | configurable — and widely misconfigured | configurable |
| Pre-ticked boxes | impossible in opt-in regions | configurable | configurable |
| GPC honored | default on | supported, configuration-dependent | supported, configuration-dependent |
| Cost | MIT | ~$1.1k/month/domain (third-party estimate) | free ≤50 pages, then ~€7-90/month/domain |
| Self-hosted | yes, entirely | no | no |

---

## Performance

**OneTrust's load chain is three dependent round trips.** `otSDKStub.js` fetches
`domain.json`, which leads to `otBannerSdk.js` — OneTrust's own developer docs
describe the sequence. Nothing can paint until all three land.
([OneTrust docs](https://developer.onetrust.com/onetrust/docs/performance-availability-cookie-script))

**Payload.** Benchmarks measured ~184 KB of JS across 16 network requests for
OneTrust. *Flagged: this comes from ConsentStack and CookieBench, competitor-run
benchmarks, not an independent reproduction.*
([ConsentStack](https://www.consentstack.io/blog/cookie-consent-banner-performance),
[CookieBench](https://cookiebench.com/benchmarks/with-onetrust/network))

**Interaction latency.** Real-user monitoring puts the P75 processing time of
OneTrust's Accept handler at ~113 ms on mobile, and reject-all at ~81 ms — CMPs
"do too much at once" in click handlers.
([Erwin Hofman RUM analysis](https://www.erwinhofman.com/blog/performance-inp-impact-from-onetrust-other-cmps/))

**Layout shift.** DebugBear documents a page whose LCP went from 1.43 s to
3.61 s because the OneTrust banner text became the LCP element; OneTrust also
animates with CSS `bottom` rather than `transform` and forces synchronous layout
via `getBoundingClientRect()`.
([DebugBear](https://www.debugbear.com/blog/cookie-consent-banner-performance))

**Cookiebot** injects ~209 DOM nodes from ~34 KB of integration code, deploys
synchronously unless you opt into manual mode, and has a cache TTL around 11
minutes that forces frequent re-downloads. It also has a documented
flash-of-unstyled-content while `uc.js` loads. *Flagged: the size figure is from
a competitor's comparison.*
([Agence Web Performance](https://agencewebperformance.fr/en/cmp-web-performance-comparison/),
[Cookiebot support](https://support.cookiebot.com/hc/en-us/articles/360005114894-Does-using-Cookiebot-affect-my-website-s-performance-SEO-ranking-and-indexation-of-content),
[Drupal #3164640](https://www.drupal.org/project/cookiebot/issues/3164640))

### What this library measures

From `npm run verify`, in real Chromium:

```
PASS  no cumulative layout shift from the banner  — CLS 0.0000
PASS  consent layer costs exactly one request     — 1 request(s)
```

And from `npm run build`:

```
adobe-consent.min.js  45.80 KB raw  14.66 KB gzip  12.81 KB brotli
```

As a Launch extension that request count goes to **zero**, because the bundle is
`require`d into the Tags runtime library rather than fetched separately.

The reasons the numbers are what they are: the dialog is built with direct DOM
calls into a shadow root with no framework; it is `position: fixed` from the
first paint so it cannot push content; and the click handler does a cookie
write, a small DOM teardown, and a handful of already-queued SDK calls.

---

## Adobe integration friction

The documented OneTrust-plus-Adobe pattern is: override `OptanonWrapper()`
(fires on load and on every change), read `window.OnetrustActiveGroups` (a
string like `,C0001,C0002,`), map those ids onto Adobe Opt-In categories, call
`adobe.optIn.approve(...)` and `complete()` in custom code, and separately build
Launch rules and data elements that call `setConsent` with the Adobe 2.0
standard.
([Adobe tutorial](https://experienceleague.adobe.com/en/docs/platform-learn/data-collection/web-sdk/consent/tutorial),
[Digital Data Tactics walkthrough](https://www.digitaldatatactics.com/index.php/2023/03/17/how-i-got-onetrust-to-work-with-adobe-launch/),
[OneTrust AEP doc](https://developer.onetrust.com/onetrust/docs/aep-adobe-launch-with-onetrust-web-cmp))

That code is per-site, and it rots. A OneTrust extension upgrade produced
`[OptIn] Invalid category(-ies)` errors in Launch for real customers.
([Experience League thread](https://experienceleaguecommunities.adobe.com/adobe-experience-platform-18/onetrust-consent-management-for-cookies-upgrade-causing-optin-invalid-category-ies-error-in-adobe-launch-249692))
This library filters unknown categories against the VisitorAPI actually loaded,
specifically so that failure mode cannot happen.

Cookiebot has no Adobe Launch extension that I could find — its only
Adobe-specific documentation targets the long-deprecated DTM, so Launch
integration is entirely custom via `CookieConsent` and its callbacks. *Flagged:
absence-of-evidence finding.*
([Cookiebot DTM article](https://support.cookiebot.com/hc/en-us/articles/360003816233-Adobe-Dynamic-Tag-Management-deployment),
[Cookiebot API](https://github.com/CybotAS/CookiebotWP/blob/master/documentation/CookiebotAPI.md))

One genuine cross-CMP quirk worth knowing: **Adobe Analytics has no IAB vendor
ID** (Audience Manager does), so TCF-based setups need custom vendor entries
regardless of which CMP you pick.
([Experience League thread](https://experienceleaguecommunities.adobe.com/t5/adobe-analytics-questions/iab-consent-setup-with-adobe-launch-visitor-service-analytics/td-p/634746))

---

## Compliance

The failure rate here is the argument for opinionated defaults.

- Only **11.8%** of UK top-10k sites using the five biggest CMPs met minimal
  GDPR consent requirements. ([Nouwens et al., CHI 2020](https://dl.acm.org/doi/10.1145/3313831.3376321))
- **141 of 1,426** crawled TCF sites registered positive consent *before the
  user chose*; 236 pre-selected options.
  ([Matte, Bielova & Santos, IEEE S&P 2020](https://arxiv.org/abs/1911.09964))
- Of noyb's first ~500 complaints, **81% had no reject option on the first
  layer** and 73% used deceptive colors.
  ([noyb](https://noyb.eu/en/where-did-all-reject-buttons-come))
- CNIL fined Google **€150M** and Meta **€60M** because refusing took more
  clicks than accepting.
  ([activeMind](https://www.activemind.legal/guides/cnil-fines/))
- Sephora settled for **$1.2M** partly for ignoring GPC.
  ([Crowell](https://www.crowell.com/en/insights/client-alerts/1-2-million-ccpa-settlement-with-sephora-focuses-on-sale-of-personal-information-and-global-privacy-controls))

Almost all of these are *configuration* failures. The products allowed them.

### Choices made here that are not configurable

| Behavior | Why |
| --- | --- |
| Accept and Reject render with identical styling and size | EDPB/ICO position that refusing must be as easy as accepting; the CNIL fines above |
| Nothing optional is pre-ticked in an opt-in region | CJEU *Planet49* C-673/17 |
| Escape / dismissal records a rejection, never consent | EDPB Guidelines 05/2020 — inactivity is not consent |
| The `Has Consent` condition fails closed | an unresolved state must not open the gate |

Verified in the browser on every run:

```
PASS  only the required category is pre-ticked (Planet49)  — 1 ticked
PASS  accept and reject are the same size                  — 48 vs 48
PASS  accept and reject are styled identically
PASS  GPC suppresses the prompt
PASS  GPC is recorded as the decision method
```

### Accessibility

Consent dialogs commonly fail on focus management, keyboard operability, and
leaving the background reachable by a screen reader.
([Make Things Accessible case study](https://www.makethingsaccessible.com/guides/cookie-banners-case-study/))
Since June 2025 the European Accessibility Act makes WCAG-level accessibility
mandatory for many EU-facing sites, consent UIs included.

Covered here: `role="dialog"` with `aria-modal`, a focus trap, focus
restoration to the invoking element, background marked `inert` **and**
`aria-hidden`, a polite live region announcing the save, visible focus rings,
`prefers-reduced-motion`, and `forced-colors` support. All asserted in the
browser suite.

---

## Where the alternatives are genuinely better

Not a fair comparison without this section.

- **Scanning and cookie discovery.** OneTrust and Cookiebot crawl your site and
  auto-populate the cookie tables. This library takes the disclosures you give
  it. If you do not already know what your site sets, that scan is worth money.
- **IAB TCF and Google Consent Mode.** Not implemented here. If you run
  programmatic advertising that requires a TC string, you need a registered CMP.
- **Multi-language and legal upkeep.** The commercial vendors maintain
  translations and track regulatory change as a service. Here you own the copy
  and the region rules.
- **Audit artifacts as a product.** They sell consent-record retention,
  dashboards, and DSAR tooling. This emits receipts to an endpoint you build.
- **Someone to call.** There is no support contract on an MIT library.

The trade is control and performance against managed breadth. For an Adobe
estate whose main pain is glue code and page weight, that trade is usually
favorable — but not always, and the list above is where it is not.

---

## Verifying these claims yourself

```bash
npm run build    # bundle sizes
npm test         # 74 unit tests
npm run verify   # 35 browser assertions, including CLS and request count
```
