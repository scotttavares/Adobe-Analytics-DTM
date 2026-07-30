import type { ConsentEngine } from '../core/engine';
import type { ConsentDecision, WebSdkOptions } from '../core/types';
import { anyGranted, resolveMapping, yn } from './mapping';
import type { Required_ } from './types';

interface AlloyWindow extends Window {
  __alloyNS?: string[];
  [key: string]: unknown;
}

type AlloyFn = (command: string, options?: unknown) => Promise<unknown> | void;

/** Adobe consent standard 2.0 payload. */
export interface ClearConsent2 {
  standard: 'Adobe';
  version: '2.0';
  value: {
    collect?: { val: 'y' | 'n' };
    share?: { val: 'y' | 'n' };
    personalize?: { content?: { val: 'y' | 'n' } };
    /** XDM requires an `idType` alongside `val`; only meaningful in an app. */
    adID?: { idType: 'IDFA' | 'GAID'; val: 'y' | 'n' };
    metadata?: { time: string };
  };
}

/** Adobe consent standard 1.0 payload — a single in/out flag. */
export interface ClearConsent1 {
  standard: 'Adobe';
  version: '1.0';
  value: { general: 'in' | 'out' };
}

export type ClearConsentPayload = ClearConsent2 | ClearConsent1;

/**
 * Drives the AEP Web SDK (alloy).
 *
 * With `defaultConsent: "pending"` configured on the SDK, alloy holds every
 * `sendEvent` in memory until it is told the answer — and that queue does not
 * survive a reload — so this adapter's job is to answer as early as possible on
 * every page load, not only when the visitor clicks.
 *
 * Alloy does keep its own `kndctr_<orgId>_consent` cookie, so re-asserting an
 * unchanged decision costs nothing on the wire: Adobe only makes a server call
 * when the value actually changes. That is why `sendOnEveryPageLoad` defaults
 * to on — it is the cheap way to guarantee the SDK and the CMP never disagree.
 *
 * One caveat worth knowing: Adobe documents Web SDK consent enforcement as
 * currently all-or-nothing, keyed on `collect`. The finer-grained purposes are
 * recorded on the profile but `collect: n` is what actually stops collection.
 */
export class WebSdkAdapter {
  private engine: ConsentEngine;
  private opts: Required_<WebSdkOptions, 'standardVersion' | 'sendOnEveryPageLoad'>;
  private mapping: ReturnType<typeof resolveMapping>;

  constructor(
    engine: ConsentEngine,
    opts: WebSdkOptions = {},
    mappingOverride?: Parameters<typeof resolveMapping>[0]
  ) {
    this.engine = engine;
    this.opts = {
      standardVersion: '2.0',
      sendOnEveryPageLoad: true,
      ...opts,
    };
    this.mapping = resolveMapping(mappingOverride);
  }

  /** Instance names from `window.__alloyNS`, or the configured override. */
  getInstanceNames(): string[] {
    if (this.opts.instanceNames?.length) return this.opts.instanceNames;
    const w = window as unknown as AlloyWindow;
    if (Array.isArray(w.__alloyNS) && w.__alloyNS.length) return w.__alloyNS.slice();
    return typeof w['alloy'] === 'function' ? ['alloy'] : [];
  }

  /** Builds the `consent` array for a decision. Exported shape is testable. */
  buildPayload(decision: ConsentDecision): ClearConsentPayload[] {
    if (this.opts.standardVersion === '1.0') {
      const granted = anyGranted(this.mapping.collect, decision);
      return [
        { standard: 'Adobe', version: '1.0', value: { general: granted ? 'in' : 'out' } },
      ];
    }

    const value: ClearConsent2['value'] = {
      collect: { val: yn(anyGranted(this.mapping.collect, decision)) },
      share: { val: yn(anyGranted(this.mapping.share, decision)) },
      personalize: { content: { val: yn(anyGranted(this.mapping.personalize, decision)) } },
      metadata: { time: new Date().toISOString() },
    };

    // `adID` is an advertising *device* identifier (IDFA/GAID) and XDM requires
    // the `idType` next to the value. There is no such identifier on the web, so
    // it is only sent when a host app explicitly names the type.
    if (this.opts.adIdType) {
      value.adID = {
        idType: this.opts.adIdType,
        val: yn(anyGranted(this.mapping.adId, decision)),
      };
    }

    return [{ standard: 'Adobe', version: '2.0', value }];
  }

  send(decision: ConsentDecision): void {
    const names = this.getInstanceNames();
    if (names.length === 0) {
      this.engine.log.warn('Web SDK not found on the page; skipping setConsent');
      return;
    }

    const payload: Record<string, unknown> = { consent: this.buildPayload(decision) };
    if (this.opts.identityMap) payload.identityMap = this.opts.identityMap;

    for (const name of names) {
      const alloy = (window as unknown as AlloyWindow)[name] as AlloyFn | undefined;
      if (typeof alloy !== 'function') {
        this.engine.log.warn('alloy instance "' + name + '" is not callable');
        continue;
      }
      try {
        const result = alloy('setConsent', payload);
        this.engine.log.log('setConsent ->', name, payload);
        if (result && typeof (result as Promise<unknown>).catch === 'function') {
          (result as Promise<unknown>).catch((e: unknown) => {
            this.engine.log.error('setConsent rejected for ' + name, e);
          });
        }
      } catch (e) {
        this.engine.log.error('setConsent threw for ' + name, e);
      }
    }
  }

  attach(): void {
    if (this.opts.enabled === false) return;

    this.engine.on('ready', () => {
      if (this.opts.sendOnEveryPageLoad !== false) this.send(this.engine.decision);
    });
    this.engine.on('change', () => this.send(this.engine.decision));
  }
}
