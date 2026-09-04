/**
 * React Native type surface for @clearconsent/react-native.
 *
 * The core consent types are re-exported from the shared engine so callers
 * import them from one place, and so web and mobile can never drift apart.
 */
export type {
  AdobeCategoryMapping,
  CategoryDefinition,
  CategoryId,
  ConsentConfig,
  ConsentDecision,
  ConsentModel,
  ConsentState,
  RegionRule,
} from '../../../src/core/types';

/**
 * The subset of `@adobe/react-native-aepedgeconsent`'s `Consent` API this
 * package uses. Declared structurally so the adapter is unit-testable without
 * the native module installed, and so the package isn't pinned to one SDK
 * version.
 */
export interface AepConsentModule {
  /** Merge a consents fragment, e.g. `{ consents: { collect: { val: 'y' } } }`. */
  update(consents: Record<string, unknown>): void;
  /** Optional — read current consents. Not required by this package. */
  getConsents?(): Promise<Record<string, unknown>>;
}

/**
 * The async key-value contract this package persists through. Matches
 * `@react-native-async-storage/async-storage`; a synchronous store such as MMKV
 * can be wrapped to satisfy it (see the README).
 */
export interface KeyValueStore {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

export type AdIdType = 'IDFA' | 'GAID';

export interface EdgeConsentOptions {
  /** Set false to disable the Edge Consent adapter entirely. */
  enabled?: boolean;
  /**
   * Call `Consent.update` on every start, not only on change. Default true — it
   * mirrors the web adapter and keeps the SDK and CMP in agreement; the SDK only
   * hits the network when the value actually changes.
   */
  sendOnEveryLoad?: boolean;
  /**
   * Send `adID` with this device identifier type. Unlike the web, mobile has a
   * real advertising id (IDFA on iOS, GAID on Android). Leave unset to omit it.
   */
  adIdType?: AdIdType;
  /**
   * iOS App Tracking Transparency gate. When it returns false, `adID` is sent as
   * denied regardless of the advertising category — without ATT authorization
   * there is no access to the IDFA.
   */
  attAuthorized?: () => boolean;
  /** Override the category -> Adobe purpose mapping (defaults match the web). */
  mapping?: import('../../../src/core/types').AdobeCategoryMapping;
}
