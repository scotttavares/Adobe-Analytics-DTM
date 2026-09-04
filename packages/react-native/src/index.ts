// Plumbing (framework-agnostic; unit-tested)
export { createMobileConsent } from './createMobileConsent';
export type { MobileConsentSetup } from './createMobileConsent';
export { EdgeConsentAdapter } from './edgeConsentAdapter';
export type { EdgeConsents } from './edgeConsentAdapter';
export { RnConsentStorage } from './storage';

// React Native UI
export { ClearConsentProvider } from './ui/ClearConsentProvider';
export type { ClearConsentProviderProps } from './ui/ClearConsentProvider';
export { useConsent } from './ui/useConsent';
export type { ClearConsentContextValue } from './ui/context';
export { ConsentBanner } from './ui/ConsentBanner';
export type { ConsentBannerProps } from './ui/ConsentBanner';
export { PreferenceCenter } from './ui/PreferenceCenter';
export type { PreferenceCenterProps } from './ui/PreferenceCenter';
export { DEFAULT_THEME, DEFAULT_TEXT } from './ui/theme';
export type { ConsentTheme, ConsentUiText } from './ui/theme';

// Types
export type { AdIdType, AepConsentModule, EdgeConsentOptions, EdgeSender, KeyValueStore } from './types';
export type {
  AdobeCategoryMapping,
  CategoryDefinition,
  CategoryId,
  ConsentConfig,
  ConsentDecision,
  ConsentModel,
  ConsentState,
  RegionRule,
} from './types';
