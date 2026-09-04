import type { ConsentEngine } from '../core/engine';
import type { ConsentDecision, MarketingOptions } from '../core/types';
import { buildMarketingConsents } from './consents';

export type { MarketingOptions } from '../core/types';

interface AlloyWindow extends Window {
  __alloyNS?: string[];
  [key: string]: unknown;
}
type AlloyFn = (command: string, options?: unknown) => Promise<unknown> | void;

/**
 * Sends marketing / channel consent (`consents.marketing.*`) to the profile via
 * the Web SDK's `sendEvent`, so Real-Time CDP consent policies and Adobe Journey
 * Optimizer can gate on it.
 *
 * The data purposes (`collect`/`share`/`personalize`/`adID`) travel separately
 * via `setConsent` (WebSdkAdapter); the Adobe consent *standard* does not carry
 * communication opt-ins, so those go on an ExperienceEvent's Consents &
 * Preferences field group instead. This adapter is inert unless the property
 * configures at least one `kind: 'marketing'` category.
 */
export class MarketingConsentAdapter {
  private engine: ConsentEngine;
  private opts: MarketingOptions;

  constructor(engine: ConsentEngine, opts: MarketingOptions = {}) {
    this.engine = engine;
    this.opts = opts;
  }

  getInstanceNames(): string[] {
    if (this.opts.instanceNames?.length) return this.opts.instanceNames;
    const w = window as unknown as AlloyWindow;
    if (Array.isArray(w.__alloyNS) && w.__alloyNS.length) return w.__alloyNS.slice();
    return typeof w['alloy'] === 'function' ? ['alloy'] : [];
  }

  send(decision: ConsentDecision): void {
    const marketing = buildMarketingConsents(decision, this.engine.getCategories());
    if (!marketing) return; // no marketing categories configured — nothing to send

    const names = this.getInstanceNames();
    if (names.length === 0) {
      this.engine.log.warn('Web SDK not found; skipping marketing consent');
      return;
    }

    const xdm: Record<string, unknown> = { consents: marketing };
    if (this.opts.eventType) xdm['eventType'] = this.opts.eventType;

    for (const name of names) {
      const alloy = (window as unknown as AlloyWindow)[name] as AlloyFn | undefined;
      if (typeof alloy !== 'function') continue;
      try {
        const result = alloy('sendEvent', { xdm });
        this.engine.log.log('marketing consent ->', name, xdm);
        if (result && typeof (result as Promise<unknown>).catch === 'function') {
          (result as Promise<unknown>).catch((e: unknown) =>
            this.engine.log.error('marketing sendEvent rejected for ' + name, e)
          );
        }
      } catch (e) {
        this.engine.log.error('marketing sendEvent threw for ' + name, e);
      }
    }
  }

  attach(): void {
    if (this.opts.enabled === false) return;
    // Stay inert unless marketing categories are configured.
    if (!buildMarketingConsents(this.engine.decision, this.engine.getCategories())) return;
    this.engine.on('ready', () => this.send(this.engine.decision));
    this.engine.on('change', () => this.send(this.engine.decision));
  }
}
