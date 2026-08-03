# Rule build sheet — AboutAmazon-US (WebSDK)

> **How to use this sheet.** Build each rule by hand in **Adobe Data Collection → Tags →
> your property → Rules**. For every rule below: create the rule, add the **event (IF)**
> exactly as listed, add each **action (THEN)** in order, then save. There are no conditions
> on any rule in this property. Values shown as `%Name%` are **data element references** —
> pick that data element in the field, do not type the literal text. Targets shown as
> `Data: …` are **Variable-type data elements** you select in the "Update variable" action.

- **Rules:** 38  ·  **Data elements:** 76  ·  **Extensions:** 4
- **One request per page.** Page-load and interaction rules both build an XDM variable, then
  send it on the single Alloy edge call — the durable fix for the two-pathway issue in the audit.
- **Build order:** create all Variable data elements first (`Data: Page View`, `Data: Interaction`,
  `Data: Site Error`), then the rules — the "Update variable" action needs those to exist.

## Conventions

| In this sheet | In the Tags UI |
|---|---|
| **IF** | The rule's **Events** section (the trigger) |
| **THEN** | The rule's **Actions** section, in order |
| `%Page: Name%` | A **data element** reference — select it, don't type it |
| `Data: Page View` | A **Variable** data element you target in *Update variable* |
| Extension names | `Adobe Client Data Layer`, `Adobe Experience Platform Web SDK`, `Core` |
| Consent `C000x` | OneTrust category gating the rule (see each rule header) |

## Rule index

| # | Rule | Consent | IF (event) | THEN (actions) |
|--:|---|---|---|---|
| 1 | [Global Page Load Rule](#1-global-page-load-rule) | C0002 | Data Pushed `pageLoaded` | Update variable → send-event |
| 2 | [Site Error](#2-site-error) | C0002 | Data Pushed `errorInteraction` | Update variable → send-event |
| 3 | [Amazon More News Tracking](#3-amazon-more-news-tracking) | C0002 | Data Pushed `moreAmazonNews` | Update variable → send-event |
| 4 | [Amazon Redirect Link Click](#4-amazon-redirect-link-click) | C0002 | Data Pushed `AmazonRedirectLinkClick` | Update variable → send-event |
| 5 | [Amazon Stories Link Click Tracking](#5-amazon-stories-link-click-tracking) | C0002 | Data Pushed `storyLinkClick` | Update variable → send-event |
| 6 | [Consent Selection](#6-consent-selection) | C0002 | Data Pushed `consentSelection` | Update variable → send-event |
| 7 | [File Download Tracking](#7-file-download-tracking) | C0002 | Data Pushed `FileDownloaded` | Update variable → send-event |
| 8 | [Filter Click Tracking](#8-filter-click-tracking) | C0002 | Data Pushed `FilterApplied` | Update variable → send-event |
| 9 | [Form Complete](#9-form-complete) | C0002 | Data Pushed `formComplete` | Update variable → send-event |
| 10 | [Form Error Tracking](#10-form-error-tracking) | C0002 | Data Pushed `formError` | Update variable → send-event |
| 11 | [Form Start](#11-form-start) | C0002 | Data Pushed `formStart` | Update variable → send-event |
| 12 | [Global CTA Button Tracking](#12-global-cta-button-tracking) | C0002 | Data Pushed `CTAButtonClicked` | Update variable → send-event |
| 13 | [Internal Search Click](#13-internal-search-click) | C0002 | Data Pushed `internalSearch` | Update variable → send-event |
| 14 | [Internal Search ClickThrough](#14-internal-search-clickthrough) | C0002 | Data Pushed `internalSearchClickThrough` | Update variable → send-event |
| 15 | [Map Button Click](#15-map-button-click) | C0002 | Data Pushed `mapButtonClick` | Update variable → send-event |
| 16 | [Map Button Close](#16-map-button-close) | C0002 | Data Pushed `mapButtonClose` | Update variable → send-event |
| 17 | [Map Zoom In](#17-map-zoom-in) | C0002 | Data Pushed `mapZoomIn` | Update variable → send-event |
| 18 | [Map Zoom Out](#18-map-zoom-out) | C0002 | Data Pushed `mapZoomOut` | Update variable → send-event |
| 19 | [Menu Link Click Tracking](#19-menu-link-click-tracking) | C0002 | Data Pushed `MenuLinkClicked` | Update variable → send-event |
| 20 | [Null Search Tracking](#20-null-search-tracking) | C0002 | Data Pushed `nullSearch` | Update variable → send-event |
| 21 | [Redirect Link Click Tracking](#21-redirect-link-click-tracking) | C0002 | Data Pushed `RedirectLinkClick` | Update variable → send-event |
| 22 | [Related Tag Click Tracking](#22-related-tag-click-tracking) | C0002 | Data Pushed `TagClick` | Update variable → send-event |
| 23 | [Scroll 25 percentage](#23-scroll-25-percentage) | C0002 | Data Pushed `scrollReach25` | Update variable → send-event |
| 24 | [Scroll 50 percentage](#24-scroll-50-percentage) | C0002 | Data Pushed `scrollReach50` | Update variable → send-event |
| 25 | [Scroll 75 percentage](#25-scroll-75-percentage) | C0002 | Data Pushed `scrollReach75` | Update variable → send-event |
| 26 | [Scroll 100 percentage](#26-scroll-100-percentage) | C0002 | Data Pushed `scrollReach100` | Update variable → send-event |
| 27 | [Search Close Click](#27-search-close-click) | C0002 | Data Pushed `SearchClosed` | Update variable → send-event |
| 28 | [Social Interaction Tracking](#28-social-interaction-tracking) | C0002 | Data Pushed `socialInteraction` | Update variable → send-event |
| 29 | [Video Start](#29-video-start) | C0002 | Data Pushed `videoPlaying` | Update variable → send-event |
| 30 | [Video 25 percentage complete](#30-video-25-percentage-complete) | C0002 | Data Pushed `videoViewed25` | Update variable → send-event |
| 31 | [Video 50 percentage complete](#31-video-50-percentage-complete) | C0002 | Data Pushed `videoViewed50` | Update variable → send-event |
| 32 | [Video 75 percentage complete](#32-video-75-percentage-complete) | C0002 | Data Pushed `videoViewed75` | Update variable → send-event |
| 33 | [Video 100 percentage complete](#33-video-100-percentage-complete) | C0002 | Data Pushed `videoComplete` | Update variable → send-event |
| 34 | [Video Pause](#34-video-pause) | C0002 | Data Pushed `videoPause` | Update variable → send-event |
| 35 | [Consent - Apply Visitor Choice](#35-consent-apply-visitor-choice) | — | Data Pushed `consentSelection` | set-consent |
| 36 | [Newsletter Test: Resolve Experience](#36-newsletter-test-resolve-experience) | C0004 | Send event complete | Custom Code |
| 37 | [Newsletter Test: Proposition Display Notification](#37-newsletter-test-proposition-display-notification) | C0004 | Element Exists `.signup-form.interrupter` | send-event |
| 38 | [Newsletter Test: Form Success](#38-newsletter-test-form-success) | C0004 | Custom Event `Form:onSuccess` | Custom Code |

---

## <a id="1-global-page-load-rule"></a>1. Global Page Load Rule

**Consent:** C0002 — Performance / analytics

> Single page-view request: personalization (renderDecisions) + Analytics ride the same edge call — the durable fix for the audit's two-pathway root cause (slides 26-27).

**IF — Data Pushed**  ·  *Adobe Client Data Layer*

- Data layer event = `pageLoaded`
- Trigger scope: `all`

**THEN**

**Action 1 — Update variable**  ·  *Adobe Experience Platform Web SDK*

- **Variable (data element to update):** `Data: Page View`

  **Analytics — page / link**

  | Field | Value |
  |---|---|
  | pageName | `%Page: Name%` |
  | channel | `%Site: Section%` |
  | pageURL | `%Page: URL%` |
  | referrer | `%Core: Referrer%` |
  | campaign | `%Campaign: External%` |

  **eVars**

  | Field | Value |
  |---|---|
  | eVar1 | `%Site: Domain%` |
  | eVar2 | `%Plugin: Previous Page Name%` |
  | eVar3 | `%Page: Name%` |
  | eVar4 | `%Site: Section%` |
  | eVar5 | `%Campaign: Internal%` |
  | eVar9 | `%Content: Type%` |
  | eVar12 | `%Page: URL%` |
  | eVar13 | `%Core: Page Query String%` |
  | eVar15 | `%User: Type%` |
  | eVar18 | `%Geo: Language%` |
  | eVar25 | `%Content: Publish Date%` |
  | eVar29 | `%Content: Category%` |
  | eVar30 | `%Content: Tags%` |
  | eVar37 | `%Plugin: Visit Duration%` |
  | eVar38 | `%UTM: Source%` |
  | eVar39 | `%UTM: Medium%` |
  | eVar40 | `%UTM: Content%` |
  | eVar41 | `%UTM: Campaign%` |
  | eVar42 | `%UTM: Term%` |
  | eVar47 | `%Geo: Country%` |

  **props**

  | Field | Value |
  |---|---|
  | prop1 | `%Page: Name%` |
  | prop2 | `%Core: Referrer%` |
  | prop3 | `%Core: Timestamp%` |
  | prop4 | `%Page: Title%` |
  | prop5 | `%Core: Clean URL%` |
  | prop6 | `%Site: Section%` |
  | prop7 | `%Site: Section 2%` |
  | prop8 | `%Site: Section 3%` |
  | prop9 | `%Site: Section 4%` |
  | prop10 | `%Site: Section 5%` |
  | prop11 | `%Plugin: Previous Page Name%` |
  | prop12 | `%Page: URL%` |
  | prop14 | `%Plugin: Visit Number%` |
  | prop15 | `%Plugin: Time Since Last Visit%` |
  | prop16 | `%Plugin: Repeat Vs New%` |
  | prop17 | `%Plugin: Visit Duration%` |
  | prop18 | `%Page: Title%` |
  | prop19 | `%Page: Error%` |
  | prop20 | `%Geo: Locale%` |

  **Lists**

  | Field | Value |
  |---|---|
  | list1 | `%Page: Error%` |
  | list2 | `%Content: Hidden Tags%` |

  **Events:** `event2`

**Action 2 — Send event**  ·  *Adobe Experience Platform Web SDK*

  | Setting | Value |
  |---|---|
  | Instance | `alloy` |
  | Type | `web.webpagedetails.pageViews` |
  | Render decisions | ✓ on |
  | Decision scopes | `newsletter-signup-contextual` |
  | Data | `%Data: Page View%` |

---

## <a id="2-site-error"></a>2. Site Error

**Consent:** C0002 — Performance / analytics

**IF — Data Pushed**  ·  *Adobe Client Data Layer*

- Data layer event = `errorInteraction`
- Trigger scope: `all`

**THEN**

**Action 1 — Update variable**  ·  *Adobe Experience Platform Web SDK*

- **Variable (data element to update):** `Data: Site Error`

  **Analytics — page / link**

  | Field | Value |
  |---|---|
  | pageName | `errorPage` |

  **props**

  | Field | Value |
  |---|---|
  | prop19 | `%Page: Error%` |

  **Lists**

  | Field | Value |
  |---|---|
  | list1 | `%Page: Error%` |

**Action 2 — Send event**  ·  *Adobe Experience Platform Web SDK*

  | Setting | Value |
  |---|---|
  | Instance | `alloy` |
  | Type | `web.webpagedetails.pageViews` |
  | Data | `%Data: Site Error%` |

---

## <a id="3-amazon-more-news-tracking"></a>3. Amazon More News Tracking

**Consent:** C0002 — Performance / analytics

**IF — Data Pushed**  ·  *Adobe Client Data Layer*

- Data layer event = `moreAmazonNews`
- Trigger scope: `all`

**THEN**

**Action 1 — Update variable**  ·  *Adobe Experience Platform Web SDK*

- **Variable (data element to update):** `Data: Interaction`
- **Link:** name = `More Amazon News Click`  ·  type = `o — custom/other link`

  **eVars**

  | Field | Value |
  |---|---|
  | eVar44 | `%Link: More Amazon News%` |

  **Events:** `event22`

**Action 2 — Send event**  ·  *Adobe Experience Platform Web SDK*

  | Setting | Value |
  |---|---|
  | Instance | `alloy` |
  | Type | `web.webinteraction.linkClicks` |
  | Data | `%Data: Interaction%` |

---

## <a id="4-amazon-redirect-link-click"></a>4. Amazon Redirect Link Click

**Consent:** C0002 — Performance / analytics

**IF — Data Pushed**  ·  *Adobe Client Data Layer*

- Data layer event = `AmazonRedirectLinkClick`
- Trigger scope: `all`

**THEN**

**Action 1 — Update variable**  ·  *Adobe Experience Platform Web SDK*

- **Variable (data element to update):** `Data: Interaction`
- **Link:** name = `Amazon Redirect Link Click`  ·  type = `o — custom/other link`

  **eVars**

  | Field | Value |
  |---|---|
  | eVar23 | `%Link: Destination%` |
  | eVar28 | `%Link: Redirect Text%` |

  **Events:** `event21`, `event22`

**Action 2 — Send event**  ·  *Adobe Experience Platform Web SDK*

  | Setting | Value |
  |---|---|
  | Instance | `alloy` |
  | Type | `web.webinteraction.linkClicks` |
  | Data | `%Data: Interaction%` |

---

## <a id="5-amazon-stories-link-click-tracking"></a>5. Amazon Stories Link Click Tracking

**Consent:** C0002 — Performance / analytics

**IF — Data Pushed**  ·  *Adobe Client Data Layer*

- Data layer event = `storyLinkClick`
- Trigger scope: `all`

**THEN**

**Action 1 — Update variable**  ·  *Adobe Experience Platform Web SDK*

- **Variable (data element to update):** `Data: Interaction`
- **Link:** name = `Amazon Stories Link Tracking`  ·  type = `o — custom/other link`

  **eVars**

  | Field | Value |
  |---|---|
  | eVar45 | `%Link: Stories Text%` |

  **Events:** `event22`

**Action 2 — Send event**  ·  *Adobe Experience Platform Web SDK*

  | Setting | Value |
  |---|---|
  | Instance | `alloy` |
  | Type | `web.webinteraction.linkClicks` |
  | Data | `%Data: Interaction%` |

---

## <a id="6-consent-selection"></a>6. Consent Selection

**Consent:** C0002 — Performance / analytics

**IF — Data Pushed**  ·  *Adobe Client Data Layer*

- Data layer event = `consentSelection`
- Trigger scope: `all`

**THEN**

**Action 1 — Update variable**  ·  *Adobe Experience Platform Web SDK*

- **Variable (data element to update):** `Data: Interaction`
- **Link:** name = `Cookie Consent Selection`  ·  type = `o — custom/other link`

  **eVars**

  | Field | Value |
  |---|---|
  | eVar48 | `%Consent: Selected%` |

  **Events:** `event30=%Consent: Click Count%`

**Action 2 — Send event**  ·  *Adobe Experience Platform Web SDK*

  | Setting | Value |
  |---|---|
  | Instance | `alloy` |
  | Type | `web.webinteraction.linkClicks` |
  | Data | `%Data: Interaction%` |

---

## <a id="7-file-download-tracking"></a>7. File Download Tracking

**Consent:** C0002 — Performance / analytics

**IF — Data Pushed**  ·  *Adobe Client Data Layer*

- Data layer event = `FileDownloaded`
- Trigger scope: `all`

**THEN**

**Action 1 — Update variable**  ·  *Adobe Experience Platform Web SDK*

- **Variable (data element to update):** `Data: Interaction`
- **Link:** name = `File Download`  ·  type = `d — download`

  **eVars**

  | Field | Value |
  |---|---|
  | eVar33 | `%File: Name%` |
  | eVar34 | `%File: Type%` |

  **Events:** `event16`

**Action 2 — Send event**  ·  *Adobe Experience Platform Web SDK*

  | Setting | Value |
  |---|---|
  | Instance | `alloy` |
  | Type | `web.webinteraction.linkClicks` |
  | Data | `%Data: Interaction%` |

---

## <a id="8-filter-click-tracking"></a>8. Filter Click Tracking

**Consent:** C0002 — Performance / analytics

**IF — Data Pushed**  ·  *Adobe Client Data Layer*

- Data layer event = `FilterApplied`
- Trigger scope: `all`

**THEN**

**Action 1 — Update variable**  ·  *Adobe Experience Platform Web SDK*

- **Variable (data element to update):** `Data: Interaction`
- **Link:** name = `News Filter Click`  ·  type = `o — custom/other link`

  **eVars**

  | Field | Value |
  |---|---|
  | eVar27 | `%News: Filter%` |

  **Events:** `event25`

**Action 2 — Send event**  ·  *Adobe Experience Platform Web SDK*

  | Setting | Value |
  |---|---|
  | Instance | `alloy` |
  | Type | `web.webinteraction.linkClicks` |
  | Data | `%Data: Interaction%` |

---

## <a id="9-form-complete"></a>9. Form Complete

**Consent:** C0002 — Performance / analytics

**IF — Data Pushed**  ·  *Adobe Client Data Layer*

- Data layer event = `formComplete`
- Trigger scope: `all`

**THEN**

**Action 1 — Update variable**  ·  *Adobe Experience Platform Web SDK*

- **Variable (data element to update):** `Data: Interaction`
- **Link:** name = `Form Complete`  ·  type = `o — custom/other link`

  **eVars**

  | Field | Value |
  |---|---|
  | eVar10 | `%Form: Name%` |
  | eVar19 | `%Form: Location%` |

  **Events:** `event10`

**Action 2 — Send event**  ·  *Adobe Experience Platform Web SDK*

  | Setting | Value |
  |---|---|
  | Instance | `alloy` |
  | Type | `web.webinteraction.linkClicks` |
  | Data | `%Data: Interaction%` |

---

## <a id="10-form-error-tracking"></a>10. Form Error Tracking

**Consent:** C0002 — Performance / analytics

**IF — Data Pushed**  ·  *Adobe Client Data Layer*

- Data layer event = `formError`
- Trigger scope: `all`

**THEN**

**Action 1 — Update variable**  ·  *Adobe Experience Platform Web SDK*

- **Variable (data element to update):** `Data: Interaction`
- **Link:** name = `Form Error`  ·  type = `o — custom/other link`

  **eVars**

  | Field | Value |
  |---|---|
  | eVar10 | `%Form: Name%` |
  | eVar19 | `%Form: Location%` |

  **Lists**

  | Field | Value |
  |---|---|
  | list1 | `%Form: Error Name%` |

  **Events:** `event8`

**Action 2 — Send event**  ·  *Adobe Experience Platform Web SDK*

  | Setting | Value |
  |---|---|
  | Instance | `alloy` |
  | Type | `web.webinteraction.linkClicks` |
  | Data | `%Data: Interaction%` |

---

## <a id="11-form-start"></a>11. Form Start

**Consent:** C0002 — Performance / analytics

**IF — Data Pushed**  ·  *Adobe Client Data Layer*

- Data layer event = `formStart`
- Trigger scope: `all`

**THEN**

**Action 1 — Update variable**  ·  *Adobe Experience Platform Web SDK*

- **Variable (data element to update):** `Data: Interaction`
- **Link:** name = `Form Start`  ·  type = `o — custom/other link`

  **eVars**

  | Field | Value |
  |---|---|
  | eVar10 | `%Form: Name%` |
  | eVar19 | `%Form: Location%` |

  **Events:** `event9`

**Action 2 — Send event**  ·  *Adobe Experience Platform Web SDK*

  | Setting | Value |
  |---|---|
  | Instance | `alloy` |
  | Type | `web.webinteraction.linkClicks` |
  | Data | `%Data: Interaction%` |

---

## <a id="12-global-cta-button-tracking"></a>12. Global CTA Button Tracking

**Consent:** C0002 — Performance / analytics

**IF — Data Pushed**  ·  *Adobe Client Data Layer*

- Data layer event = `CTAButtonClicked`
- Trigger scope: `all`

**THEN**

**Action 1 — Update variable**  ·  *Adobe Experience Platform Web SDK*

- **Variable (data element to update):** `Data: Interaction`
- **Link:** name = `CTA Button Click`  ·  type = `o — custom/other link`

  **eVars**

  | Field | Value |
  |---|---|
  | eVar22 | `%Link: CTA Button Name%` |
  | eVar23 | `%Link: Destination%` |

  **Events:** `event22`

**Action 2 — Send event**  ·  *Adobe Experience Platform Web SDK*

  | Setting | Value |
  |---|---|
  | Instance | `alloy` |
  | Type | `web.webinteraction.linkClicks` |
  | Data | `%Data: Interaction%` |

---

## <a id="13-internal-search-click"></a>13. Internal Search Click

**Consent:** C0002 — Performance / analytics

**IF — Data Pushed**  ·  *Adobe Client Data Layer*

- Data layer event = `internalSearch`
- Trigger scope: `all`

**THEN**

**Action 1 — Update variable**  ·  *Adobe Experience Platform Web SDK*

- **Variable (data element to update):** `Data: Interaction`
- **Link:** name = `Internal Search`  ·  type = `o — custom/other link`

  **eVars**

  | Field | Value |
  |---|---|
  | eVar6 | `%Search: Term%` |
  | eVar7 | `%Search: Results%` |
  | eVar8 | `%Search: Result Page Type%` |

  **Events:** `event26`

**Action 2 — Send event**  ·  *Adobe Experience Platform Web SDK*

  | Setting | Value |
  |---|---|
  | Instance | `alloy` |
  | Type | `web.webinteraction.linkClicks` |
  | Data | `%Data: Interaction%` |

---

## <a id="14-internal-search-clickthrough"></a>14. Internal Search ClickThrough

**Consent:** C0002 — Performance / analytics

**IF — Data Pushed**  ·  *Adobe Client Data Layer*

- Data layer event = `internalSearchClickThrough`
- Trigger scope: `all`

**THEN**

**Action 1 — Update variable**  ·  *Adobe Experience Platform Web SDK*

- **Variable (data element to update):** `Data: Interaction`
- **Link:** name = `Internal Search Click Through`  ·  type = `o — custom/other link`

  **eVars**

  | Field | Value |
  |---|---|
  | eVar6 | `%Search: Term%` |
  | eVar32 | `%Search: Result Click Name%` |

  **Events:** `event7`

**Action 2 — Send event**  ·  *Adobe Experience Platform Web SDK*

  | Setting | Value |
  |---|---|
  | Instance | `alloy` |
  | Type | `web.webinteraction.linkClicks` |
  | Data | `%Data: Interaction%` |

---

## <a id="15-map-button-click"></a>15. Map Button Click

**Consent:** C0002 — Performance / analytics

**IF — Data Pushed**  ·  *Adobe Client Data Layer*

- Data layer event = `mapButtonClick`
- Trigger scope: `all`

**THEN**

**Action 1 — Update variable**  ·  *Adobe Experience Platform Web SDK*

- **Variable (data element to update):** `Data: Interaction`
- **Link:** name = `Map Button Click`  ·  type = `o — custom/other link`

  **eVars**

  | Field | Value |
  |---|---|
  | eVar49 | `%Map: Name%` |
  | eVar50 | `%Map: Button Name%` |

  **Events:** `event32`

**Action 2 — Send event**  ·  *Adobe Experience Platform Web SDK*

  | Setting | Value |
  |---|---|
  | Instance | `alloy` |
  | Type | `web.webinteraction.linkClicks` |
  | Data | `%Data: Interaction%` |

---

## <a id="16-map-button-close"></a>16. Map Button Close

**Consent:** C0002 — Performance / analytics

**IF — Data Pushed**  ·  *Adobe Client Data Layer*

- Data layer event = `mapButtonClose`
- Trigger scope: `all`

**THEN**

**Action 1 — Update variable**  ·  *Adobe Experience Platform Web SDK*

- **Variable (data element to update):** `Data: Interaction`
- **Link:** name = `Map Button Close`  ·  type = `o — custom/other link`

  **eVars**

  | Field | Value |
  |---|---|
  | eVar49 | `%Map: Name%` |
  | eVar50 | `%Map: Button Name%` |

  **Events:** `event33`

**Action 2 — Send event**  ·  *Adobe Experience Platform Web SDK*

  | Setting | Value |
  |---|---|
  | Instance | `alloy` |
  | Type | `web.webinteraction.linkClicks` |
  | Data | `%Data: Interaction%` |

---

## <a id="17-map-zoom-in"></a>17. Map Zoom In

**Consent:** C0002 — Performance / analytics

**IF — Data Pushed**  ·  *Adobe Client Data Layer*

- Data layer event = `mapZoomIn`
- Trigger scope: `all`

**THEN**

**Action 1 — Update variable**  ·  *Adobe Experience Platform Web SDK*

- **Variable (data element to update):** `Data: Interaction`
- **Link:** name = `Map ZoomIn`  ·  type = `o — custom/other link`

  **eVars**

  | Field | Value |
  |---|---|
  | eVar49 | `%Map: Name%` |
  | eVar50 | `%Map: Button Name%` |

  **Events:** `event34`

**Action 2 — Send event**  ·  *Adobe Experience Platform Web SDK*

  | Setting | Value |
  |---|---|
  | Instance | `alloy` |
  | Type | `web.webinteraction.linkClicks` |
  | Data | `%Data: Interaction%` |

---

## <a id="18-map-zoom-out"></a>18. Map Zoom Out

**Consent:** C0002 — Performance / analytics

**IF — Data Pushed**  ·  *Adobe Client Data Layer*

- Data layer event = `mapZoomOut`
- Trigger scope: `all`

**THEN**

**Action 1 — Update variable**  ·  *Adobe Experience Platform Web SDK*

- **Variable (data element to update):** `Data: Interaction`
- **Link:** name = `Map Zoom Out`  ·  type = `o — custom/other link`

  **eVars**

  | Field | Value |
  |---|---|
  | eVar49 | `%Map: Name%` |
  | eVar50 | `%Map: Button Name%` |

  **Events:** `event31`

**Action 2 — Send event**  ·  *Adobe Experience Platform Web SDK*

  | Setting | Value |
  |---|---|
  | Instance | `alloy` |
  | Type | `web.webinteraction.linkClicks` |
  | Data | `%Data: Interaction%` |

---

## <a id="19-menu-link-click-tracking"></a>19. Menu Link Click Tracking

**Consent:** C0002 — Performance / analytics

**IF — Data Pushed**  ·  *Adobe Client Data Layer*

- Data layer event = `MenuLinkClicked`
- Trigger scope: `all`

**THEN**

**Action 1 — Update variable**  ·  *Adobe Experience Platform Web SDK*

- **Variable (data element to update):** `Data: Interaction`
- **Link:** name = `Menu Click`  ·  type = `o — custom/other link`

  **eVars**

  | Field | Value |
  |---|---|
  | eVar24 | `%Link: Menu Name%` |

  **Events:** `event23`

**Action 2 — Send event**  ·  *Adobe Experience Platform Web SDK*

  | Setting | Value |
  |---|---|
  | Instance | `alloy` |
  | Type | `web.webinteraction.linkClicks` |
  | Data | `%Data: Interaction%` |

---

## <a id="20-null-search-tracking"></a>20. Null Search Tracking

**Consent:** C0002 — Performance / analytics

**IF — Data Pushed**  ·  *Adobe Client Data Layer*

- Data layer event = `nullSearch`
- Trigger scope: `all`

**THEN**

**Action 1 — Update variable**  ·  *Adobe Experience Platform Web SDK*

- **Variable (data element to update):** `Data: Interaction`
- **Link:** name = `Null Search`  ·  type = `o — custom/other link`

  **eVars**

  | Field | Value |
  |---|---|
  | eVar6 | `%Search: Term%` |
  | eVar7 | `%Search: Results%` |
  | eVar8 | `%Search: Result Page Type%` |

  **Events:** `event6`

**Action 2 — Send event**  ·  *Adobe Experience Platform Web SDK*

  | Setting | Value |
  |---|---|
  | Instance | `alloy` |
  | Type | `web.webinteraction.linkClicks` |
  | Data | `%Data: Interaction%` |

---

## <a id="21-redirect-link-click-tracking"></a>21. Redirect Link Click Tracking

**Consent:** C0002 — Performance / analytics

**IF — Data Pushed**  ·  *Adobe Client Data Layer*

- Data layer event = `RedirectLinkClick`
- Trigger scope: `all`

**THEN**

**Action 1 — Update variable**  ·  *Adobe Experience Platform Web SDK*

- **Variable (data element to update):** `Data: Interaction`
- **Link:** name = `Redirect Link Click`  ·  type = `o — custom/other link`

  **eVars**

  | Field | Value |
  |---|---|
  | eVar21 | `%Link: Redirect Text%` |
  | eVar23 | `%Link: Destination%` |

  **Events:** `event21`, `event22`

**Action 2 — Send event**  ·  *Adobe Experience Platform Web SDK*

  | Setting | Value |
  |---|---|
  | Instance | `alloy` |
  | Type | `web.webinteraction.linkClicks` |
  | Data | `%Data: Interaction%` |

---

## <a id="22-related-tag-click-tracking"></a>22. Related Tag Click Tracking

**Consent:** C0002 — Performance / analytics

**IF — Data Pushed**  ·  *Adobe Client Data Layer*

- Data layer event = `TagClick`
- Trigger scope: `all`

**THEN**

**Action 1 — Update variable**  ·  *Adobe Experience Platform Web SDK*

- **Variable (data element to update):** `Data: Interaction`
- **Link:** name = `Related Tag Click`  ·  type = `o — custom/other link`

  **eVars**

  | Field | Value |
  |---|---|
  | eVar43 | `%Link: Related Tag%` |
  | eVar46 | `%Link: Related Tag URL%` |

  **Events:** `event29`

**Action 2 — Send event**  ·  *Adobe Experience Platform Web SDK*

  | Setting | Value |
  |---|---|
  | Instance | `alloy` |
  | Type | `web.webinteraction.linkClicks` |
  | Data | `%Data: Interaction%` |

---

## <a id="23-scroll-25-percentage"></a>23. Scroll 25 percentage

**Consent:** C0002 — Performance / analytics

**IF — Data Pushed**  ·  *Adobe Client Data Layer*

- Data layer event = `scrollReach25`
- Trigger scope: `all`

**THEN**

**Action 1 — Update variable**  ·  *Adobe Experience Platform Web SDK*

- **Variable (data element to update):** `Data: Interaction`
- **Link:** name = `Scroll 25 Percentage`  ·  type = `o — custom/other link`

  **eVars**

  | Field | Value |
  |---|---|
  | eVar20 | `%Scroll Depth%` |

  **Events:** `event17`

**Action 2 — Send event**  ·  *Adobe Experience Platform Web SDK*

  | Setting | Value |
  |---|---|
  | Instance | `alloy` |
  | Type | `web.webinteraction.linkClicks` |
  | Data | `%Data: Interaction%` |

---

## <a id="24-scroll-50-percentage"></a>24. Scroll 50 percentage

**Consent:** C0002 — Performance / analytics

**IF — Data Pushed**  ·  *Adobe Client Data Layer*

- Data layer event = `scrollReach50`
- Trigger scope: `all`

**THEN**

**Action 1 — Update variable**  ·  *Adobe Experience Platform Web SDK*

- **Variable (data element to update):** `Data: Interaction`
- **Link:** name = `Scroll 50 Percentage`  ·  type = `o — custom/other link`

  **eVars**

  | Field | Value |
  |---|---|
  | eVar20 | `%Scroll Depth%` |

  **Events:** `event18`

**Action 2 — Send event**  ·  *Adobe Experience Platform Web SDK*

  | Setting | Value |
  |---|---|
  | Instance | `alloy` |
  | Type | `web.webinteraction.linkClicks` |
  | Data | `%Data: Interaction%` |

---

## <a id="25-scroll-75-percentage"></a>25. Scroll 75 percentage

**Consent:** C0002 — Performance / analytics

**IF — Data Pushed**  ·  *Adobe Client Data Layer*

- Data layer event = `scrollReach75`
- Trigger scope: `all`

**THEN**

**Action 1 — Update variable**  ·  *Adobe Experience Platform Web SDK*

- **Variable (data element to update):** `Data: Interaction`
- **Link:** name = `Scroll 75 Percentage`  ·  type = `o — custom/other link`

  **eVars**

  | Field | Value |
  |---|---|
  | eVar20 | `%Scroll Depth%` |

  **Events:** `event19`

**Action 2 — Send event**  ·  *Adobe Experience Platform Web SDK*

  | Setting | Value |
  |---|---|
  | Instance | `alloy` |
  | Type | `web.webinteraction.linkClicks` |
  | Data | `%Data: Interaction%` |

---

## <a id="26-scroll-100-percentage"></a>26. Scroll 100 percentage

**Consent:** C0002 — Performance / analytics

**IF — Data Pushed**  ·  *Adobe Client Data Layer*

- Data layer event = `scrollReach100`
- Trigger scope: `all`

**THEN**

**Action 1 — Update variable**  ·  *Adobe Experience Platform Web SDK*

- **Variable (data element to update):** `Data: Interaction`
- **Link:** name = `Scroll 100 Percentage`  ·  type = `o — custom/other link`

  **eVars**

  | Field | Value |
  |---|---|
  | eVar20 | `%Scroll Depth%` |

  **Events:** `event20`

**Action 2 — Send event**  ·  *Adobe Experience Platform Web SDK*

  | Setting | Value |
  |---|---|
  | Instance | `alloy` |
  | Type | `web.webinteraction.linkClicks` |
  | Data | `%Data: Interaction%` |

---

## <a id="27-search-close-click"></a>27. Search Close Click

**Consent:** C0002 — Performance / analytics

**IF — Data Pushed**  ·  *Adobe Client Data Layer*

- Data layer event = `SearchClosed`
- Trigger scope: `all`

**THEN**

**Action 1 — Update variable**  ·  *Adobe Experience Platform Web SDK*

- **Variable (data element to update):** `Data: Interaction`
- **Link:** name = `Internal Search Close Click`  ·  type = `o — custom/other link`

  **eVars**

  | Field | Value |
  |---|---|
  | eVar6 | `%Search: Term%` |
  | eVar7 | `%Search: Results%` |
  | eVar8 | `%Search: Result Page Type%` |

  **Events:** `event27`

**Action 2 — Send event**  ·  *Adobe Experience Platform Web SDK*

  | Setting | Value |
  |---|---|
  | Instance | `alloy` |
  | Type | `web.webinteraction.linkClicks` |
  | Data | `%Data: Interaction%` |

---

## <a id="28-social-interaction-tracking"></a>28. Social Interaction Tracking

**Consent:** C0002 — Performance / analytics

**IF — Data Pushed**  ·  *Adobe Client Data Layer*

- Data layer event = `socialInteraction`
- Trigger scope: `all`

**THEN**

**Action 1 — Update variable**  ·  *Adobe Experience Platform Web SDK*

- **Variable (data element to update):** `Data: Interaction`
- **Link:** name = `Social Interaction`  ·  type = `o — custom/other link`

  **eVars**

  | Field | Value |
  |---|---|
  | eVar17 | `%Social: Interaction Info%` |

  **Events:** `event1`

**Action 2 — Send event**  ·  *Adobe Experience Platform Web SDK*

  | Setting | Value |
  |---|---|
  | Instance | `alloy` |
  | Type | `web.webinteraction.linkClicks` |
  | Data | `%Data: Interaction%` |

---

## <a id="29-video-start"></a>29. Video Start

**Consent:** C0002 — Performance / analytics

**IF — Data Pushed**  ·  *Adobe Client Data Layer*

- Data layer event = `videoPlaying`
- Trigger scope: `all`

**THEN**

**Action 1 — Update variable**  ·  *Adobe Experience Platform Web SDK*

- **Variable (data element to update):** `Data: Interaction`
- **Link:** name = `Video Start`  ·  type = `o — custom/other link`

  **eVars**

  | Field | Value |
  |---|---|
  | eVar11 | `%Video: Name%` |
  | eVar35 | `%Video: Type%` |

  **Events:** `event11`

**Action 2 — Send event**  ·  *Adobe Experience Platform Web SDK*

  | Setting | Value |
  |---|---|
  | Instance | `alloy` |
  | Type | `web.webinteraction.linkClicks` |
  | Data | `%Data: Interaction%` |

---

## <a id="30-video-25-percentage-complete"></a>30. Video 25 percentage complete

**Consent:** C0002 — Performance / analytics

**IF — Data Pushed**  ·  *Adobe Client Data Layer*

- Data layer event = `videoViewed25`
- Trigger scope: `all`

**THEN**

**Action 1 — Update variable**  ·  *Adobe Experience Platform Web SDK*

- **Variable (data element to update):** `Data: Interaction`
- **Link:** name = `Video 25 Percent completion`  ·  type = `o — custom/other link`

  **eVars**

  | Field | Value |
  |---|---|
  | eVar11 | `%Video: Name%` |

  **Events:** `event13`

**Action 2 — Send event**  ·  *Adobe Experience Platform Web SDK*

  | Setting | Value |
  |---|---|
  | Instance | `alloy` |
  | Type | `web.webinteraction.linkClicks` |
  | Data | `%Data: Interaction%` |

---

## <a id="31-video-50-percentage-complete"></a>31. Video 50 percentage complete

**Consent:** C0002 — Performance / analytics

**IF — Data Pushed**  ·  *Adobe Client Data Layer*

- Data layer event = `videoViewed50`
- Trigger scope: `all`

**THEN**

**Action 1 — Update variable**  ·  *Adobe Experience Platform Web SDK*

- **Variable (data element to update):** `Data: Interaction`
- **Link:** name = `Video 50 Percent completion`  ·  type = `o — custom/other link`

  **eVars**

  | Field | Value |
  |---|---|
  | eVar11 | `%Video: Name%` |
  | eVar35 | `%Video: Type%` |

  **Events:** `event14`

**Action 2 — Send event**  ·  *Adobe Experience Platform Web SDK*

  | Setting | Value |
  |---|---|
  | Instance | `alloy` |
  | Type | `web.webinteraction.linkClicks` |
  | Data | `%Data: Interaction%` |

---

## <a id="32-video-75-percentage-complete"></a>32. Video 75 percentage complete

**Consent:** C0002 — Performance / analytics

**IF — Data Pushed**  ·  *Adobe Client Data Layer*

- Data layer event = `videoViewed75`
- Trigger scope: `all`

**THEN**

**Action 1 — Update variable**  ·  *Adobe Experience Platform Web SDK*

- **Variable (data element to update):** `Data: Interaction`
- **Link:** name = `Video 75 Percent completion`  ·  type = `o — custom/other link`

  **eVars**

  | Field | Value |
  |---|---|
  | eVar11 | `%Video: Name%` |
  | eVar35 | `%Video: Type%` |

  **Events:** `event15`

**Action 2 — Send event**  ·  *Adobe Experience Platform Web SDK*

  | Setting | Value |
  |---|---|
  | Instance | `alloy` |
  | Type | `web.webinteraction.linkClicks` |
  | Data | `%Data: Interaction%` |

---

## <a id="33-video-100-percentage-complete"></a>33. Video 100 percentage complete

**Consent:** C0002 — Performance / analytics

**IF — Data Pushed**  ·  *Adobe Client Data Layer*

- Data layer event = `videoComplete`
- Trigger scope: `all`

**THEN**

**Action 1 — Update variable**  ·  *Adobe Experience Platform Web SDK*

- **Variable (data element to update):** `Data: Interaction`
- **Link:** name = `Video Complete`  ·  type = `o — custom/other link`

  **eVars**

  | Field | Value |
  |---|---|
  | eVar11 | `%Video: Name%` |
  | eVar35 | `%Video: Type%` |

  **Events:** `event12`

**Action 2 — Send event**  ·  *Adobe Experience Platform Web SDK*

  | Setting | Value |
  |---|---|
  | Instance | `alloy` |
  | Type | `web.webinteraction.linkClicks` |
  | Data | `%Data: Interaction%` |

---

## <a id="34-video-pause"></a>34. Video Pause

**Consent:** C0002 — Performance / analytics

**IF — Data Pushed**  ·  *Adobe Client Data Layer*

- Data layer event = `videoPause`
- Trigger scope: `all`

**THEN**

**Action 1 — Update variable**  ·  *Adobe Experience Platform Web SDK*

- **Variable (data element to update):** `Data: Interaction`
- **Link:** name = `Video Pause`  ·  type = `o — custom/other link`

  **eVars**

  | Field | Value |
  |---|---|
  | eVar11 | `%Video: Name%` |

  **Events:** `event28`

**Action 2 — Send event**  ·  *Adobe Experience Platform Web SDK*

  | Setting | Value |
  |---|---|
  | Instance | `alloy` |
  | Type | `web.webinteraction.linkClicks` |
  | Data | `%Data: Interaction%` |

---

## <a id="35-consent-apply-visitor-choice"></a>35. Consent - Apply Visitor Choice

**Consent:** No consent category set

> Maps the site banner selection to alloy setConsent. Runs on the same data-layer event as the Consent Selection tracking rule.

**IF — Data Pushed**  ·  *Adobe Client Data Layer*

- Data layer event = `consentSelection`
- Trigger scope: `all`

**THEN**

**Action 1 — Set consent**  ·  *Adobe Experience Platform Web SDK*

  | Setting | Value |
  |---|---|
  | Instance | `alloy` |
  | Standard | `Adobe` (v2.0) |
  | value.general | `%Consent: General Value%` |

---

## <a id="36-newsletter-test-resolve-experience"></a>36. Newsletter Test: Resolve Experience

**Consent:** C0004 — Targeting / advertising

> Property owner 2026-07-29: the live newsletter sign-up test CONTINUES through cutover, folded in natively (supersedes the old property's 3-rule pilot chain, which stays behind in the old property and retires with it at cutover).

**IF — Send event complete**  ·  *Adobe Experience Platform Web SDK*

- Fires when the Alloy `sendEvent` on `alloy` completes

**THEN**

**Action 1 — Custom code**  ·  *Core* · `javascript`

<details><summary>JavaScript source (paste into the code editor)</summary>

```javascript
// Newsletter sign-up test - CONTINUED from the pilot built in the old property.
// The page-view request already asked Target for the newsletter scope on the ONE
// edge call this property makes per page; this rule runs when that call completes
// and hands Target's answer to the site. Site contract UNCHANGED from the pilot:
// window.__newsletterProposition + CustomEvent 'adobeTarget:flag'.
var propositions = (event && event.propositions) || [];
var match = null;
for (var i = 0; i < propositions.length; i++) {
  if (propositions[i].scope === 'newsletter-signup-contextual') { match = propositions[i]; break; }
}
if (!match) return; // visitor not in the test, or a send that didn't carry the scope
window.__newsletterProposition = match; // report-back handle (display + sign-up credit)
var item = match.items && match.items[0];
var content = item && item.data && item.data.content;
if (!content || !content.variant) return;
window.dispatchEvent(new CustomEvent('adobeTarget:flag', {
  detail: {
    name: 'newsletter:design', // which feature this message is about
    value: content.variant     // which version to show ('contextual' | 'generic' | 'interstitial')
  }
}));
```

</details>

---

## <a id="37-newsletter-test-proposition-display-notification"></a>37. Newsletter Test: Proposition Display Notification

**Consent:** C0004 — Targeting / advertising

> Property owner 2026-07-29: the live newsletter sign-up test CONTINUES through cutover, folded in natively (supersedes the old property's 3-rule pilot chain, which stays behind in the old property and retires with it at cutover).

**IF — Element Exists**  ·  *Core*

- Element selector = `.signup-form.interrupter`

**THEN**

**Action 1 — Send event**  ·  *Adobe Experience Platform Web SDK*

  | Setting | Value |
  |---|---|
  | Instance | `alloy` |
  | Type | `decisioning.propositionDisplay` |
  | XDM | `%Target: Newsletter Proposition Data Element%` |

---

## <a id="38-newsletter-test-form-success"></a>38. Newsletter Test: Form Success

**Consent:** C0004 — Targeting / advertising

> Property owner 2026-07-29: the live newsletter sign-up test CONTINUES through cutover, folded in natively (supersedes the old property's 3-rule pilot chain, which stays behind in the old property and retires with it at cutover).

**IF — Custom Event**  ·  *Core*

- Custom event type = `Form:onSuccess`
- Element selector = `body`

**THEN**

**Action 1 — Custom code**  ·  *Core* · `javascript`

<details><summary>JavaScript source (paste into the code editor)</summary>

```javascript
// The message we get when someone actually signs up. It contains:
// { formName: 'Newsletter Module', location: 'Footer' | 'Article Interrupter' }
// NOTE (Known Gap, carried from the pilot): location only ever has these two
// values today - contextual / generic / interstitial are NOT distinguished yet.
var detail = (event && event.detail) || {};
var placement = detail.location || 'unknown'; // which part of the page they signed up from

if (window.__newsletterProposition) {
  // Combined event: tells Target AND Analytics a real sign-up happened, AND
  // credits the specific design that produced it - both signals on the one
  // request Target's service actually evaluates.
  var xdmPayload = {
    eventType: 'decisioning.propositionInteract',
    web: {
      webPageDetails: {
        name: 'newsletter:confirmation:' + placement,
        URL: 'newsletter:confirmation:' + placement
      }
    },
    _experience: {
      decisioning: {
        propositions: [window.__newsletterProposition],
        propositionEventType: { interact: 1 }
      }
    }
  };
  console.log('[Newsletter Test] Sending combined confirmation event:', xdmPayload);
  alloy('sendEvent', { xdm: xdmPayload });
} else {
  // Fallback: proposition unavailable - still record the confirmation so
  // Analytics has the signal, even though Target attribution is lost.
  console.warn('[Newsletter Test] No proposition on window.__newsletterProposition - falling back to plain pageview (Target attribution lost for this signup).');
  alloy('sendEvent', {
    xdm: {
      eventType: 'web.webpagedetails.pageViews',
      web: {
        webPageDetails: {
          name: 'newsletter:confirmation:' + placement,
          URL: 'newsletter:confirmation:' + placement
        }
      }
    }
  });
}
```

</details>

---
