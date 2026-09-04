import type { ConsentEngine } from '../core/engine';
import type { AdobeOptions } from '../core/types';
import { AnalyticsAdapter } from './analytics';
import { DataLayerAdapter } from './datalayer';
import { LaunchAdapter } from './launch';
import { MarketingConsentAdapter } from './marketing';
import { OptInAdapter } from './optin';
import { WebSdkAdapter } from './websdk';

export { AnalyticsAdapter } from './analytics';
export { DataLayerAdapter } from './datalayer';
export { LaunchAdapter } from './launch';
export { MarketingConsentAdapter } from './marketing';
export { OptInAdapter, OPT_IN_CATEGORIES } from './optin';
export { WebSdkAdapter } from './websdk';
export { DEFAULT_MAPPING, resolveMapping, anyGranted } from './mapping';
export { buildXdmConsents, buildMarketingConsents, marketingCategories } from './consents';
export type { ClearConsentPayload, ClearConsent1, ClearConsent2 } from './websdk';
export type { XdmConsents, XdmConsentValue, BuildConsentsOptions } from './consents';

export interface AdobeAdapters {
  webSdk: WebSdkAdapter;
  optIn: OptInAdapter;
  analytics: AnalyticsAdapter;
  dataLayer: DataLayerAdapter;
  launch: LaunchAdapter;
  marketing: MarketingConsentAdapter;
}

/**
 * Attaches every Adobe adapter to the engine.
 *
 * All five are safe to leave on: each one feature-detects its target and is a
 * no-op when that product is not on the page. A site running only the Web SDK
 * pays nothing for the AppMeasurement adapter being present.
 */
export function attachAdobe(engine: ConsentEngine, options: AdobeOptions = {}): AdobeAdapters {
  const mapping = options.mapping;

  const adapters: AdobeAdapters = {
    webSdk: new WebSdkAdapter(engine, options.webSdk || {}, mapping),
    optIn: new OptInAdapter(engine, options.optIn || {}, mapping),
    analytics: new AnalyticsAdapter(engine, options.analytics || {}, mapping),
    dataLayer: new DataLayerAdapter(engine, options.dataLayer || {}, mapping),
    launch: new LaunchAdapter(engine, options.launch || {}),
    marketing: new MarketingConsentAdapter(engine, options.marketing || {}),
  };

  adapters.webSdk.attach();
  adapters.optIn.attach();
  adapters.analytics.attach();
  adapters.dataLayer.attach();
  adapters.launch.attach();
  adapters.marketing.attach();

  return adapters;
}
