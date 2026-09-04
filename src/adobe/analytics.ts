import type { ConsentEngine } from '../core/engine';
import type { AnalyticsOptions, ConsentDecision } from '../core/types';
import { anyGranted, resolveMapping } from './mapping';

interface AppMeasurementInstance {
  optOut?: boolean;
  /** Present on AppMeasurement 2.x. */
  visitor?: { isOptedOut?: () => boolean };
  abort?: boolean;
  trackingServer?: string;
  account?: string;
  t?: (...args: unknown[]) => unknown;
  tl?: (...args: unknown[]) => unknown;
}

interface AnalyticsWindow extends Window {
  [key: string]: unknown;
}

/**
 * Belt-and-braces gating for AppMeasurement.
 *
 * The Opt-In service already stops AppMeasurement from firing when analytics is
 * denied. This adapter additionally sets `s.abort` on the instance so that a
 * hardcoded `s.t()` outside Launch — the usual reality on a legacy DTM estate —
 * is also stopped.
 */
export class AnalyticsAdapter {
  private engine: ConsentEngine;
  private opts: AnalyticsOptions;
  private mapping: ReturnType<typeof resolveMapping>;

  constructor(
    engine: ConsentEngine,
    opts: AnalyticsOptions = {},
    mappingOverride?: Parameters<typeof resolveMapping>[0]
  ) {
    this.engine = engine;
    this.opts = opts;
    this.mapping = resolveMapping(mappingOverride);
  }

  private instance(): AppMeasurementInstance | null {
    const name = this.opts.instanceGlobal || 's';
    const candidate = (window as unknown as AnalyticsWindow)[name];
    if (candidate && typeof candidate === 'object') return candidate as AppMeasurementInstance;
    return null;
  }

  apply(decision: ConsentDecision): void {
    const granted = anyGranted(this.mapping.analytics, decision);
    const instance = this.instance();
    if (!instance) {
      this.engine.log.log('AppMeasurement instance not found; nothing to gate');
      return;
    }

    // `abort` short-circuits the next t()/tl() call; `optOut` is the durable
    // flag AppMeasurement checks on every beacon.
    instance.abort = !granted;
    instance.optOut = !granted;
    this.engine.log.log('AppMeasurement analytics consent:', granted ? 'granted' : 'denied');
  }

  attach(): void {
    if (this.opts.enabled === false) return;
    this.engine.on('ready', () => this.apply(this.engine.decision));
    this.engine.on('change', () => this.apply(this.engine.decision));
  }
}
