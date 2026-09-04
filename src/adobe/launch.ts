import type { ConsentEngine } from '../core/engine';
import type { ConsentDecision, LaunchOptions } from '../core/types';

interface Satellite {
  track: (identifier: string, detail?: unknown) => void;
  setVar?: (name: string, value: unknown) => void;
  getVar?: (name: string) => unknown;
  logger?: { log: (msg: string) => void };
}

interface LaunchWindow extends Window {
  _satellite?: Satellite;
}

/**
 * Fires Launch direct call rules on consent changes, so a Tags property can
 * react without any custom code: build a Direct Call rule on
 * `clear-consent-changed` and read `%event.detail.consent.analytics%`.
 *
 * `_satellite` may not exist yet when consent resolves (the Launch embed is
 * async), so calls are retried briefly rather than dropped.
 */
export class LaunchAdapter {
  private engine: ConsentEngine;
  private opts: LaunchOptions;
  private retries = 0;

  constructor(engine: ConsentEngine, opts: LaunchOptions = {}) {
    this.engine = engine;
    this.opts = opts;
  }

  private get satellite(): Satellite | null {
    const s = (window as LaunchWindow)._satellite;
    return s && typeof s.track === 'function' ? s : null;
  }

  private detail(decision: ConsentDecision): Record<string, unknown> {
    const state = this.engine.getState();
    return {
      consent: { ...decision },
      method: state?.method,
      region: this.engine.region,
      model: this.engine.model,
      receiptId: state?.id,
      pending: this.engine.isPending(),
    };
  }

  fire(decision: ConsentDecision): void {
    const satellite = this.satellite;
    if (!satellite) {
      // Launch's embed is async; give it a moment before giving up.
      if (this.retries < 20) {
        this.retries++;
        window.setTimeout(() => this.fire(decision), 250);
      } else {
        this.engine.log.warn('_satellite never appeared; direct call rules not fired');
      }
      return;
    }
    this.retries = 0;

    const id = this.opts.directCallId || 'clear-consent-changed';
    try {
      satellite.track(id, this.detail(decision));
      this.engine.log.log('_satellite.track("' + id + '")');

      if (this.opts.perCategoryDirectCalls) {
        for (const category of Object.keys(decision)) {
          const suffix = decision[category] ? 'granted' : 'denied';
          satellite.track('consent-' + category + '-' + suffix, this.detail(decision));
        }
      }
    } catch (e) {
      this.engine.log.error('_satellite.track failed', e);
    }
  }

  attach(): void {
    if (this.opts.enabled === false) return;
    this.engine.on('ready', () => this.fire(this.engine.decision));
    this.engine.on('change', () => this.fire(this.engine.decision));
  }
}
