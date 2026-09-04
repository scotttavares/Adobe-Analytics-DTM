import { buildMarketingConsents } from '../../../src/adobe/consents';
import { anyGranted, resolveMapping, yn } from '../../../src/adobe/mapping';
import type { ConsentEngine } from '../../../src/core/engine';
import type { ConsentDecision } from '../../../src/core/types';
import type { AepConsentModule, EdgeConsentOptions } from './types';

/** XDM Consents value object, as sent to the Edge Network. */
export interface EdgeConsents {
  collect: { val: 'y' | 'n' };
  share: { val: 'y' | 'n' };
  personalize: { content: { val: 'y' | 'n' } };
  /** Present only when an `adIdType` is configured (mobile has a real ad id). */
  adID?: { idType: 'IDFA' | 'GAID'; val: 'y' | 'n' };
  metadata: { time: string };
}

/**
 * Drives the AEP Mobile SDK's Edge Consent extension — the native counterpart to
 * the web `WebSdkAdapter`. Same category -> Adobe purpose mapping, delivered
 * through `Consent.update({ consents })` instead of `alloy("setConsent")`.
 *
 * Set **Default Consent = Pending** in your mobile Tags property so the SDK
 * holds hits until this answers, exactly as with the Web SDK.
 *
 * The one deliberate difference from the web: `adID`. On the web XDM rejects an
 * `adID` with no `idType`, so it is omitted; on mobile the id is real
 * (IDFA/GAID), so it is sent when `adIdType` is configured — gated by ATT on iOS.
 */
export class EdgeConsentAdapter {
  private readonly mapping: ReturnType<typeof resolveMapping>;

  constructor(
    private readonly engine: ConsentEngine,
    private readonly consent: AepConsentModule,
    private readonly opts: EdgeConsentOptions = {}
  ) {
    this.mapping = resolveMapping(opts.mapping);
  }

  /** Builds the `{ consents }` payload for a decision. Pure and testable. */
  buildConsents(decision: ConsentDecision): { consents: EdgeConsents } {
    const value: EdgeConsents = {
      collect: { val: yn(anyGranted(this.mapping.collect, decision)) },
      share: { val: yn(anyGranted(this.mapping.share, decision)) },
      personalize: {
        content: { val: yn(anyGranted(this.mapping.personalize, decision)) },
      },
      metadata: { time: new Date().toISOString() },
    };

    if (this.opts.adIdType) {
      const attOk = this.opts.attAuthorized ? this.opts.attAuthorized() : true;
      value.adID = {
        idType: this.opts.adIdType,
        val: yn(anyGranted(this.mapping.adId, decision) && attOk),
      };
    }

    return { consents: value };
  }

  send(decision: ConsentDecision): void {
    const payload = this.buildConsents(decision);
    try {
      this.consent.update(payload);
      this.engine.log.log('Consent.update ->', payload);
    } catch (e) {
      this.engine.log.error('Consent.update threw', e);
    }
    this.sendMarketing(decision);
  }

  /**
   * Writes marketing / channel consent to the profile via Edge. No-op unless an
   * `edge` sender is configured and the property has marketing categories — the
   * data purposes above are what `Consent.update` enforces at the Edge.
   */
  private sendMarketing(decision: ConsentDecision): void {
    if (!this.opts.edgeSender) return;
    const marketing = buildMarketingConsents(decision, this.engine.getCategories());
    if (!marketing) return;
    try {
      this.opts.edgeSender.sendEvent({ consents: marketing });
      this.engine.log.log('marketing consent ->', marketing);
    } catch (e) {
      this.engine.log.error('Edge.sendEvent threw', e);
    }
  }

  attach(): void {
    if (this.opts.enabled === false) return;
    this.engine.on('ready', () => {
      if (this.opts.sendOnEveryLoad !== false) this.send(this.engine.decision);
    });
    this.engine.on('change', () => this.send(this.engine.decision));
  }
}
