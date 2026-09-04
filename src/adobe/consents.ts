import type {
  AdobeCategoryMapping,
  CategoryDefinition,
  ConsentDecision,
  MarketingChannel,
} from '../core/types';
import { anyGranted, resolveMapping, yn } from './mapping';

/** A single `{ val: 'y' | 'n' }` consent flag. */
export interface XdmConsentValue {
  val: 'y' | 'n';
}

/**
 * The Adobe **Consents & Preferences** XDM object, as it lands on a Real-Time
 * CDP profile. `collect`/`share`/`personalize`/`adID` are the data purposes the
 * Edge Network enforces; `marketing.*` are the communication opt-ins that RTCDP
 * consent policies and Adobe Journey Optimizer gate on.
 */
export interface XdmConsents {
  collect: XdmConsentValue;
  share: XdmConsentValue;
  personalize: { content: XdmConsentValue };
  adID?: { idType: 'IDFA' | 'GAID'; val: 'y' | 'n' };
  marketing?: {
    any?: XdmConsentValue;
    email?: XdmConsentValue;
    push?: XdmConsentValue;
    sms?: XdmConsentValue;
  };
  metadata?: { time: string };
}

export interface BuildConsentsOptions {
  /** Override the category → Adobe purpose mapping (defaults match the web). */
  mapping?: AdobeCategoryMapping;
  /**
   * Send `adID` with this device id type (IDFA/GAID). Mobile only — omit on the
   * web, where XDM rejects an `adID` without an `idType`.
   */
  adIdType?: 'IDFA' | 'GAID';
  /**
   * iOS ATT gate. When explicitly `false`, `adID` is denied regardless of the
   * advertising category (no IDFA access). Defaults to allowed.
   */
  attAuthorized?: boolean;
  /** Timestamp for `metadata.time`. Defaults to now. */
  time?: string;
}

/** Marketing categories carry a channel; this pulls them out of a category set. */
export function marketingCategories(categories: CategoryDefinition[]): CategoryDefinition[] {
  return categories.filter((c) => c.kind === 'marketing' && !!c.marketingChannel);
}

/**
 * Builds the full XDM Consents object for a decision — the one place both the
 * web and React Native adapters derive consent from, so a profile carries an
 * identical shape whatever captured it.
 */
export function buildXdmConsents(
  decision: ConsentDecision,
  categories: CategoryDefinition[],
  opts: BuildConsentsOptions = {}
): XdmConsents {
  const mapping = resolveMapping(opts.mapping);

  const consents: XdmConsents = {
    collect: { val: yn(anyGranted(mapping.collect, decision)) },
    share: { val: yn(anyGranted(mapping.share, decision)) },
    personalize: { content: { val: yn(anyGranted(mapping.personalize, decision)) } },
    metadata: { time: opts.time ?? new Date().toISOString() },
  };

  if (opts.adIdType) {
    const attOk = opts.attAuthorized !== false;
    consents.adID = {
      idType: opts.adIdType,
      val: yn(anyGranted(mapping.adId, decision) && attOk),
    };
  }

  const channels = marketingCategories(categories);
  if (channels.length) {
    const marketing: NonNullable<XdmConsents['marketing']> = {};
    let anyMarketing = false;
    for (const c of channels) {
      const granted = decision[c.id] === true;
      marketing[c.marketingChannel as MarketingChannel] = { val: yn(granted) };
      if (granted) anyMarketing = true;
    }
    marketing.any = { val: yn(anyMarketing) };
    consents.marketing = marketing;
  }

  return consents;
}

/**
 * The marketing-only slice, for the profile update that carries communication
 * consent (the data purposes travel separately via `setConsent`/`Consent.update`).
 * Returns `null` when the property configures no marketing categories.
 */
export function buildMarketingConsents(
  decision: ConsentDecision,
  categories: CategoryDefinition[],
  time?: string
): { marketing: NonNullable<XdmConsents['marketing']> } | null {
  const full = buildXdmConsents(decision, categories, { time });
  return full.marketing ? { marketing: full.marketing } : null;
}
