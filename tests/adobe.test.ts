import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ConsentEngine } from '../src/core/engine';
import { AnalyticsAdapter } from '../src/adobe/analytics';
import { DataLayerAdapter } from '../src/adobe/datalayer';
import { LaunchAdapter } from '../src/adobe/launch';
import { OptInAdapter } from '../src/adobe/optin';
import { WebSdkAdapter, type AdobeConsent2 } from '../src/adobe/websdk';

function clearCookies(): void {
  for (const part of document.cookie.split(';')) {
    const name = part.split('=')[0]?.trim();
    if (name) document.cookie = name + '=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/';
  }
  window.localStorage.clear();
}

function startedEngine(): ConsentEngine {
  const engine = new ConsentEngine({ geo: { region: 'DE' } });
  engine.start();
  return engine;
}

describe('Web SDK adapter', () => {
  beforeEach(() => {
    clearCookies();
    delete (window as Record<string, unknown>).alloy;
    delete (window as Record<string, unknown>).__alloyNS;
  });

  it('builds an Adobe 2.0 payload with y/n values', () => {
    const engine = startedEngine();
    const adapter = new WebSdkAdapter(engine);

    const payload = adapter.buildPayload({
      essential: true,
      analytics: true,
      personalization: false,
      advertising: false,
    })[0] as AdobeConsent2;

    expect(payload.standard).toBe('Adobe');
    expect(payload.version).toBe('2.0');
    expect(payload.value.collect).toEqual({ val: 'y' });
    expect(payload.value.share).toEqual({ val: 'n' });
    expect(payload.value.personalize).toEqual({ content: { val: 'n' } });
    expect(payload.value.metadata?.time).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('grants collect when any data category is granted', () => {
    const engine = startedEngine();
    const adapter = new WebSdkAdapter(engine);

    // Personalization alone must still open collection, or the Web SDK would
    // discard the very events personalization depends on.
    const payload = adapter.buildPayload({
      essential: true,
      analytics: false,
      personalization: true,
      advertising: false,
    })[0] as AdobeConsent2;

    expect(payload.value.collect).toEqual({ val: 'y' });
    expect(payload.value.personalize).toEqual({ content: { val: 'y' } });
  });

  it('denies collect when everything optional is denied', () => {
    const engine = startedEngine();
    const payload = new WebSdkAdapter(engine).buildPayload({
      essential: true,
      analytics: false,
      personalization: false,
      advertising: false,
    })[0] as AdobeConsent2;

    expect(payload.value.collect).toEqual({ val: 'n' });
  });

  it('omits adID on the web, since XDM requires an idType', () => {
    const engine = startedEngine();
    const payload = new WebSdkAdapter(engine).buildPayload({
      essential: true,
      advertising: true,
    })[0] as AdobeConsent2;

    expect(payload.value.adID).toBeUndefined();
  });

  it('includes adID when a device id type is configured', () => {
    const engine = startedEngine();
    const payload = new WebSdkAdapter(engine, { adIdType: 'IDFA' }).buildPayload({
      essential: true,
      advertising: true,
    })[0] as AdobeConsent2;

    expect(payload.value.adID).toEqual({ idType: 'IDFA', val: 'y' });
  });

  it('emits the 1.0 in/out shape when asked', () => {
    const engine = startedEngine();
    const adapter = new WebSdkAdapter(engine, { standardVersion: '1.0' });

    expect(adapter.buildPayload({ analytics: true })[0]).toEqual({
      standard: 'Adobe',
      version: '1.0',
      value: { general: 'in' },
    });
    expect(adapter.buildPayload({ analytics: false })[0]).toEqual({
      standard: 'Adobe',
      version: '1.0',
      value: { general: 'out' },
    });
  });

  it('discovers instances from __alloyNS', () => {
    const engine = startedEngine();
    (window as Record<string, unknown>).__alloyNS = ['titanium', 'copper'];
    expect(new WebSdkAdapter(engine).getInstanceNames()).toEqual(['titanium', 'copper']);
  });

  it('falls back to a global named alloy', () => {
    const engine = startedEngine();
    (window as Record<string, unknown>).alloy = () => undefined;
    expect(new WebSdkAdapter(engine).getInstanceNames()).toEqual(['alloy']);
  });

  it('calls setConsent on every attached instance', () => {
    const engine = new ConsentEngine({ geo: { region: 'DE' } });
    const alloy = vi.fn(() => Promise.resolve());
    (window as Record<string, unknown>).alloy = alloy;
    (window as Record<string, unknown>).__alloyNS = ['alloy'];

    new WebSdkAdapter(engine).attach();
    engine.start();

    expect(alloy).toHaveBeenCalledTimes(1);
    expect(alloy.mock.calls[0]![0]).toBe('setConsent');

    engine.acceptAll();
    expect(alloy).toHaveBeenCalledTimes(2);
  });

  it('calls setConsent exactly once on a GPC page load', () => {
    Object.defineProperty(navigator, 'globalPrivacyControl', {
      value: true,
      configurable: true,
    });

    const alloy = vi.fn(() => Promise.resolve());
    (window as Record<string, unknown>).alloy = alloy;
    (window as Record<string, unknown>).__alloyNS = ['alloy'];

    const engine = new ConsentEngine({ geo: { region: 'US-CA' }, honorGpc: true });
    new WebSdkAdapter(engine).attach();
    engine.start();

    expect(alloy).toHaveBeenCalledTimes(1);
    const payload = alloy.mock.calls[0]![1] as { consent: AdobeConsent2[] };
    expect(payload.consent[0]!.value.collect).toEqual({ val: 'n' });

    // @ts-expect-error cleaning up the stub
    delete navigator.globalPrivacyControl;
  });

  it('survives an alloy instance that throws', () => {
    const engine = startedEngine();
    (window as Record<string, unknown>).alloy = () => {
      throw new Error('alloy exploded');
    };
    expect(() => new WebSdkAdapter(engine).send({ analytics: true })).not.toThrow();
  });
});

describe('Opt-In adapter', () => {
  beforeEach(() => {
    clearCookies();
    delete (window as Record<string, unknown>).adobe;
  });

  it('splits a decision into approvals and denials', () => {
    const engine = startedEngine();
    const adapter = new OptInAdapter(engine);

    const { approve, deny } = adapter.buildPermissions({
      essential: true,
      analytics: true,
      personalization: false,
      advertising: false,
    });

    expect(approve.sort()).toEqual(['aa', 'ecid']);
    expect(deny.sort()).toEqual(['aam', 'target']);
  });

  it('stages approve and deny, then completes once', () => {
    const engine = startedEngine();
    const approve = vi.fn();
    const deny = vi.fn();
    const complete = vi.fn();

    (window as Record<string, unknown>).adobe = {
      optIn: { approve, deny, complete, isApproved: () => false },
      OptInCategories: { AAM: 'aam', ANALYTICS: 'aa', ECID: 'ecid', TARGET: 'target' },
    };

    new OptInAdapter(engine).send({ essential: true, analytics: true });

    expect(approve).toHaveBeenCalledWith(['ecid', 'aa'], true);
    expect(deny).toHaveBeenCalledWith(['target', 'aam'], true);
    expect(complete).toHaveBeenCalledTimes(1);
  });

  it('drops categories the loaded VisitorAPI does not define', () => {
    const engine = new ConsentEngine({
      geo: { region: 'DE' },
      adobe: { mapping: { audienceManager: ['advertising'] } },
    });
    engine.start();

    const approve = vi.fn();
    const deny = vi.fn();
    // An older VisitorAPI that never heard of Target.
    (window as Record<string, unknown>).adobe = {
      optIn: { approve, deny, complete: vi.fn(), isApproved: () => false },
      OptInCategories: { AAM: 'aam', ANALYTICS: 'aa', ECID: 'ecid' },
    };

    new OptInAdapter(engine).send({ essential: true, analytics: true });

    const denied = deny.mock.calls[0]![0] as string[];
    expect(denied).not.toContain('target');
    expect(denied).toContain('aam');
  });

  it('does nothing when the Opt-In service is absent', () => {
    const engine = startedEngine();
    expect(() => new OptInAdapter(engine).send({ analytics: true })).not.toThrow();
  });
});

describe('AppMeasurement adapter', () => {
  beforeEach(() => {
    clearCookies();
    delete (window as Record<string, unknown>).s;
  });

  it('aborts the tracker when analytics is denied', () => {
    const engine = startedEngine();
    const tracker: Record<string, unknown> = { account: 'demo' };
    (window as Record<string, unknown>).s = tracker;

    new AnalyticsAdapter(engine).apply({ essential: true, analytics: false });

    expect(tracker.abort).toBe(true);
    expect(tracker.optOut).toBe(true);
  });

  it('releases the tracker when analytics is granted', () => {
    const engine = startedEngine();
    const tracker: Record<string, unknown> = { abort: true, optOut: true };
    (window as Record<string, unknown>).s = tracker;

    new AnalyticsAdapter(engine).apply({ essential: true, analytics: true });

    expect(tracker.abort).toBe(false);
    expect(tracker.optOut).toBe(false);
  });

  it('honors a custom tracker variable name', () => {
    const engine = startedEngine();
    const tracker: Record<string, unknown> = {};
    (window as Record<string, unknown>).s_meridian = tracker;

    new AnalyticsAdapter(engine, { instanceGlobal: 's_meridian' }).apply({ analytics: false });

    expect(tracker.abort).toBe(true);
  });
});

describe('data layer adapter', () => {
  beforeEach(() => {
    clearCookies();
    delete (window as Record<string, unknown>).adobeDataLayer;
  });

  it('pushes a consent event with the Adobe purpose mapping resolved', () => {
    const engine = startedEngine();
    new DataLayerAdapter(engine).push({
      essential: true,
      analytics: true,
      personalization: false,
      advertising: false,
    });

    const queue = (window as Record<string, unknown>).adobeDataLayer as Array<
      Record<string, any>
    >;
    expect(queue).toHaveLength(1);
    expect(queue[0]!.event).toBe('consent-updated');
    expect(queue[0]!.consent.granted.sort()).toEqual(['analytics', 'essential']);
    expect(queue[0]!.consent.adobe.collect).toBe(true);
    expect(queue[0]!.consent.adobe.target).toBe(false);
  });

  it('creates the queue when the data layer has not loaded yet', () => {
    const engine = startedEngine();
    new DataLayerAdapter(engine, { name: 'customDataLayer' }).push({ analytics: true });

    expect(
      Array.isArray((window as Record<string, unknown>).customDataLayer)
    ).toBe(true);
  });
});

describe('Launch adapter', () => {
  beforeEach(() => {
    clearCookies();
    delete (window as Record<string, unknown>)._satellite;
  });

  it('fires a direct call rule with the decision as detail', () => {
    const engine = startedEngine();
    const track = vi.fn();
    (window as Record<string, unknown>)._satellite = { track };

    new LaunchAdapter(engine).fire({ essential: true, analytics: true });

    expect(track).toHaveBeenCalledTimes(1);
    expect(track.mock.calls[0]![0]).toBe('adobe-consent-changed');
    expect((track.mock.calls[0]![1] as any).consent.analytics).toBe(true);
  });

  it('fires per-category calls when asked', () => {
    const engine = startedEngine();
    const track = vi.fn();
    (window as Record<string, unknown>)._satellite = { track };

    new LaunchAdapter(engine, { perCategoryDirectCalls: true }).fire({
      essential: true,
      analytics: true,
      advertising: false,
    });

    const ids = track.mock.calls.map((call) => call[0]);
    expect(ids).toContain('consent-analytics-granted');
    expect(ids).toContain('consent-advertising-denied');
  });
});
