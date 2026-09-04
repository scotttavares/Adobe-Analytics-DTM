import type { ConsentEngine } from '../core/engine';
import type { ConsentDecision, DataLayerOptions } from '../core/types';
import { anyGranted, resolveMapping } from './mapping';

interface DataLayerWindow extends Window {
  [key: string]: unknown;
}

/**
 * Pushes consent state into the Adobe Client Data Layer.
 *
 * ACDL's array stub swallows pushes made before the library loads and replays
 * them once it does, so pushing early is safe and is in fact the point: a Tags
 * rule listening for the consent event fires whether the data layer booted
 * before or after us.
 */
export class DataLayerAdapter {
  private engine: ConsentEngine;
  private opts: DataLayerOptions;
  private mapping: ReturnType<typeof resolveMapping>;

  constructor(
    engine: ConsentEngine,
    opts: DataLayerOptions = {},
    mappingOverride?: Parameters<typeof resolveMapping>[0]
  ) {
    this.engine = engine;
    this.opts = opts;
    this.mapping = resolveMapping(mappingOverride);
  }

  private get name(): string {
    return this.opts.name || 'adobeDataLayer';
  }

  private queue(): unknown[] {
    const w = window as unknown as DataLayerWindow;
    if (!Array.isArray(w[this.name])) w[this.name] = [];
    return w[this.name] as unknown[];
  }

  /** The object pushed onto the data layer. Kept flat for easy data elements. */
  buildPayload(decision: ConsentDecision, eventName: string): Record<string, unknown> {
    const state = this.engine.getState();
    return {
      event: eventName,
      consent: {
        categories: { ...decision },
        granted: Object.keys(decision).filter((k) => decision[k]),
        denied: Object.keys(decision).filter((k) => !decision[k]),
        adobe: {
          collect: anyGranted(this.mapping.collect, decision),
          share: anyGranted(this.mapping.share, decision),
          personalize: anyGranted(this.mapping.personalize, decision),
          adId: anyGranted(this.mapping.adId, decision),
          analytics: anyGranted(this.mapping.analytics, decision),
          target: anyGranted(this.mapping.target, decision),
          audienceManager: anyGranted(this.mapping.audienceManager, decision),
        },
        method: state?.method,
        region: this.engine.region,
        model: this.engine.model,
        policyVersion: state?.policyVersion,
        receiptId: state?.id,
        timestamp: state?.timestamp,
        pending: this.engine.isPending(),
      },
    };
  }

  push(decision: ConsentDecision, eventName?: string): void {
    const name = eventName || this.opts.eventName || 'consent-updated';
    try {
      this.queue().push(this.buildPayload(decision, name));
      this.engine.log.log('pushed "' + name + '" to ' + this.name);
    } catch (e) {
      this.engine.log.error('data layer push failed', e);
    }
  }

  attach(): void {
    if (this.opts.enabled === false) return;
    this.engine.on('ready', () => {
      if (this.opts.pushOnLoad !== false) this.push(this.engine.decision, 'consent-loaded');
    });
    this.engine.on('change', () => this.push(this.engine.decision));
  }
}
