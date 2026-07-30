/**
 * Public type surface for clearconsent.
 *
 * The category ids are plain strings so a site can add its own, but the four
 * defaults are the ones the Adobe adapters know how to map without config:
 * `essential`, `analytics`, `personalization`, `advertising`.
 */

export type CategoryId = string;

/** Map of category id -> granted. */
export type ConsentDecision = Record<CategoryId, boolean>;

/**
 * How a decision was reached. Stored on the receipt because regulators ask
 * "how did you obtain this consent", and because `implied`/`gpc` decisions
 * need to be distinguishable from an explicit click in an audit.
 */
export type ConsentMethod =
  | 'accept_all'
  | 'reject_all'
  | 'save_choices'
  | 'programmatic'
  | 'gpc'
  | 'dnt'
  | 'region_default'
  | 'implied_close'
  | 'restored';

export type ConsentModel = 'opt_in' | 'opt_out' | 'notice_only';

export interface ConsentState {
  /** Storage format version, for forward-compatible migrations. */
  schema: number;
  /** The site's policy version at the time of the decision. */
  policyVersion: number;
  categories: ConsentDecision;
  /** Epoch ms when the decision was made. */
  timestamp: number;
  method: ConsentMethod;
  /** Opaque per-decision id, used as the consent receipt identifier. */
  id: string;
  /** Resolved region code at decision time, e.g. `EU`, `US-CA`. */
  region?: string;
  /** True when the decision was influenced by a Global Privacy Control signal. */
  gpc?: boolean;
}

export interface CategoryDefinition {
  id: CategoryId;
  /** Short label, e.g. "Analytics". */
  label: string;
  /** One line shown next to the toggle, e.g. "understand usage". */
  summary?: string;
  /** Longer copy shown in the expanded detail row. */
  description?: string;
  /** Essential categories are always on and render as a locked checkbox. */
  required?: boolean;
  /** Default when no decision exists yet and the model is `opt_out`. */
  defaultGranted?: boolean;
  /** Vendor/cookie rows shown when the category detail is expanded. */
  cookies?: CookieDisclosure[];
}

export interface CookieDisclosure {
  name: string;
  provider?: string;
  purpose?: string;
  /** Human duration, e.g. "13 months". */
  duration?: string;
  type?: 'cookie' | 'localStorage' | 'sessionStorage' | 'pixel' | 'sdk';
}

export interface RegionRule {
  /**
   * Region codes this rule applies to. `*` matches anything not matched by a
   * more specific rule. Codes are matched case-insensitively against both the
   * two-letter country (`DE`) and the country-subdivision form (`US-CA`).
   */
  match: string[];
  model: ConsentModel;
  /** Categories granted before any interaction, for `opt_out`/`notice_only`. */
  defaultGranted?: CategoryId[];
  /** Skip the banner entirely for this region (still records a state). */
  suppressBanner?: boolean;
}

export interface UiText {
  title: string;
  body: string;
  acceptAll: string;
  rejectAll: string;
  save: string;
  preferences: string;
  close: string;
  privacyPolicy?: string;
  privacyPolicyUrl?: string;
  poweredBy?: string;
  /** Screen-reader label for the dialog. */
  ariaLabel?: string;
  /** Announced via a live region after a decision is saved. */
  savedAnnouncement?: string;
  detailsShow?: string;
  detailsHide?: string;
  cookieTableName?: string;
  cookieTableProvider?: string;
  cookieTablePurpose?: string;
  cookieTableDuration?: string;
}

export interface ThemeOptions {
  /** Base surface color of the dialog. */
  surface?: string;
  surfaceAlt?: string;
  text?: string;
  textMuted?: string;
  /** Accent used by the primary buttons; accepts any CSS color or gradient. */
  accent?: string;
  accentText?: string;
  border?: string;
  radius?: string;
  fontFamily?: string;
  headingFontFamily?: string;
  /** Backdrop overlay color; set to `transparent` to disable dimming. */
  overlay?: string;
  /** Extra CSS injected into the shadow root, last, so it always wins. */
  customCss?: string;
}

export type BannerLayout = 'modal' | 'bar' | 'box';
export type BannerPosition =
  | 'center'
  | 'bottom'
  | 'top'
  | 'bottom-left'
  | 'bottom-right';

export interface UiOptions {
  layout?: BannerLayout;
  position?: BannerPosition;
  /** Dim and block the page behind the dialog. Required for a true modal. */
  blocking?: boolean;
  /** Show the small persistent "Privacy choices" re-open control. */
  showBadge?: boolean;
  badgePosition?: 'bottom-left' | 'bottom-right';
  badgeLabel?: string;
  /** Render the category toggles on the first layer, as in the reference design. */
  categoriesOnFirstLayer?: boolean;
  theme?: ThemeOptions;
  text?: Partial<UiText>;
  /** Language code for the `lang` attribute on the dialog. */
  lang?: string;
  /** Render into this element instead of appending to <body>. */
  root?: HTMLElement;
  /** Disable all built-in UI; drive everything through the API. */
  headless?: boolean;
}

export interface StorageOptions {
  /** Cookie name holding the decision. */
  cookieName?: string;
  /** Cookie domain, e.g. `.example.com` to share across subdomains. */
  cookieDomain?: string;
  cookiePath?: string;
  cookieSameSite?: 'Lax' | 'Strict' | 'None';
  cookieSecure?: boolean;
  /**
   * Days the decision is honored before re-prompting. CNIL recommends ~6 months
   * as a consent-validity best practice (13 months is the separate cap on the
   * lifetime of exempted analytics cookies). Default is 365 days.
   */
  expiryDays?: number;
  /** Mirror the decision into localStorage as a cookie-loss fallback. */
  useLocalStorage?: boolean;
}

export interface AdobeCategoryMapping {
  /** Category ids that grant AEP Web SDK `consent.collect`. */
  collect?: CategoryId[];
  /** Category ids that grant `consent.share` (cross-context data sharing). */
  share?: CategoryId[];
  /** Category ids that grant `consent.personalize.content`. */
  personalize?: CategoryId[];
  /** Category ids that grant `consent.adID` / advertising identifiers. */
  adId?: CategoryId[];
  /** Category ids that grant the ECID opt-in `aa` (Adobe Analytics) permission. */
  analytics?: CategoryId[];
  /** Category ids that grant the ECID opt-in `target` permission. */
  target?: CategoryId[];
  /** Category ids that grant the ECID opt-in `aam` (Audience Manager) permission. */
  audienceManager?: CategoryId[];
  /** Category ids that grant the ECID itself. */
  ecid?: CategoryId[];
}

export interface WebSdkOptions {
  enabled?: boolean;
  /**
   * Alloy instance names. When omitted the adapter discovers them from
   * `window.__alloyNS`, falling back to `alloy`.
   */
  instanceNames?: string[];
  /** Consent standard version to send. */
  standardVersion?: '2.0' | '1.0';
  /**
   * Send `setConsent` on every page load, not just on change. Defaults to true:
   * Adobe's guidance is to re-assert consent each page load, and alloy holds
   * events in the `pending` state until it hears from us.
   */
  sendOnEveryPageLoad?: boolean;
  /** Include an `identityMap` with the consent call. */
  identityMap?: Record<string, unknown>;
  /**
   * Send `consent.adID` using this device identifier type. Only set this in a
   * hybrid/app context — there is no IDFA or GAID on the web, and XDM rejects
   * an `adID` without an `idType`.
   */
  adIdType?: 'IDFA' | 'GAID';
}

export interface OptInOptions {
  enabled?: boolean;
  /**
   * Approve categories that have consent and deny the rest in one call.
   * Disable to only ever approve (never deny) — useful when another system
   * owns denials.
   */
  denyUnconsented?: boolean;
}

export interface AnalyticsOptions {
  enabled?: boolean;
  /** Global variable holding the AppMeasurement instance, e.g. `s`. */
  instanceGlobal?: string;
  /** Send an explicit opt-out beacon when analytics consent is withdrawn. */
  optOutBeacon?: boolean;
}

export interface DataLayerOptions {
  enabled?: boolean;
  /** Global array name. Defaults to `adobeDataLayer` (Adobe Client Data Layer). */
  name?: string;
  /** Event name pushed on every consent change. */
  eventName?: string;
  /** Also push a snapshot event on initial load. */
  pushOnLoad?: boolean;
}

export interface LaunchOptions {
  enabled?: boolean;
  /** Fire `_satellite.track(<id>, detail)` on each consent change. */
  directCallId?: string;
  /** Also fire a per-category direct call, e.g. `consent-analytics-granted`. */
  perCategoryDirectCalls?: boolean;
}

export interface AdobeOptions {
  /** Experience Cloud Org ID, e.g. `ABC123@AdobeOrg`. Used for cookie checks. */
  orgId?: string;
  mapping?: AdobeCategoryMapping;
  webSdk?: WebSdkOptions;
  optIn?: OptInOptions;
  analytics?: AnalyticsOptions;
  dataLayer?: DataLayerOptions;
  launch?: LaunchOptions;
}

export interface ReceiptOptions {
  enabled?: boolean;
  /**
   * Endpoint that receives the consent receipt as JSON via `sendBeacon`.
   * Leave unset to keep receipts client-side only.
   */
  endpoint?: string;
  /** Include the full text shown to the user in the receipt. */
  includeCopy?: boolean;
  /** Keep the last N receipts in localStorage for client-side audit. */
  historySize?: number;
}

export interface GeoOptions {
  /** Explicit region code, e.g. `EU`, `DE`, `US-CA`. Skips detection. */
  region?: string;
  /**
   * Endpoint returning `{ region?: string, country?: string, regionCode?: string }`.
   * Only called when `region` is not set and no cached value exists.
   */
  endpoint?: string;
  /** Read the region from a response header echoed into a meta tag. */
  metaTagName?: string;
  /** Region assumed while detection is in flight or if it fails. */
  fallbackRegion?: string;
  /** Minutes to cache a detected region. */
  cacheMinutes?: number;
}

export interface ConsentConfig {
  /**
   * Bump to invalidate stored decisions and re-prompt everyone. Required by
   * most regulators when the purposes of processing change.
   */
  policyVersion?: number;
  categories?: CategoryDefinition[];
  /** Default consent model when no region rule matches. */
  model?: ConsentModel;
  regions?: RegionRule[];
  geo?: GeoOptions;
  storage?: StorageOptions;
  ui?: UiOptions;
  adobe?: AdobeOptions;
  receipt?: ReceiptOptions;
  /** Honor the Global Privacy Control browser signal as a rejection. */
  honorGpc?: boolean;
  /** Honor legacy `navigator.doNotTrack`. Off by default — it is not a legal signal. */
  honorDnt?: boolean;
  /**
   * Block `<script type="text/plain" data-cc-category="...">` tags and unblock
   * them when their category is granted.
   */
  autoBlock?: boolean;
  /** Re-show the banner this many days after the last decision. */
  reconsentDays?: number;
  /** Emit verbose logging to the console. */
  debug?: boolean;
  /** Start automatically on script load. */
  autoInit?: boolean;
  /** Called after the engine has resolved its initial state. */
  onReady?: (state: ConsentState) => void;
  /** Called on every change after the first. */
  onChange?: (state: ConsentState, previous: ConsentState | null) => void;
}

export interface ConsentChangeEvent {
  state: ConsentState;
  previous: ConsentState | null;
  /** Category ids that flipped from denied to granted. */
  granted: CategoryId[];
  /** Category ids that flipped from granted to denied. */
  revoked: CategoryId[];
  /** True when this is the first resolved state of the page. */
  initial: boolean;
}

export type ConsentEventName =
  | 'ready'
  | 'change'
  | 'granted'
  | 'revoked'
  | 'show'
  | 'hide'
  | 'error';

export interface ConsentReceipt {
  id: string;
  timestamp: number;
  policyVersion: number;
  categories: ConsentDecision;
  method: ConsentMethod;
  region?: string;
  gpc?: boolean;
  /** Page the decision was made on. */
  url?: string;
  /** `document.referrer` at decision time. */
  referrer?: string;
  language?: string;
  userAgent?: string;
  /** Copy shown to the user, when `receipt.includeCopy` is on. */
  copy?: { title: string; body: string; categories: Record<string, string> };
  /** Non-cryptographic digest of the receipt body, for tamper-evidence. */
  digest?: string;
}
