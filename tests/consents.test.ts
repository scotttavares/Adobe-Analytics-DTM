import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildMarketingConsents, buildXdmConsents } from '../src/adobe/consents';
import { MarketingConsentAdapter } from '../src/adobe/marketing';
import { ConsentEngine } from '../src/core/engine';
import type { CategoryDefinition } from '../src/core/types';

const CATS: CategoryDefinition[] = [
  { id: 'essential', label: 'Essential', required: true },
  { id: 'analytics', label: 'Analytics' },
  { id: 'personalization', label: 'Personalization' },
  { id: 'advertising', label: 'Advertising' },
  { id: 'email', label: 'Email', kind: 'marketing', marketingChannel: 'email' },
  { id: 'push', label: 'Push', kind: 'marketing', marketingChannel: 'push' },
];
const DATA_ONLY: CategoryDefinition[] = [
  { id: 'essential', label: 'Essential', required: true },
  { id: 'analytics', label: 'Analytics' },
];

describe('buildXdmConsents', () => {
  it('maps data categories to collect/share/personalize', () => {
    const c = buildXdmConsents(
      { essential: true, analytics: true, personalization: false, advertising: false },
      CATS
    );
    expect(c.collect).toEqual({ val: 'y' });
    expect(c.share).toEqual({ val: 'n' });
    expect(c.personalize).toEqual({ content: { val: 'n' } });
    expect(c.metadata?.time).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('adds marketing.<channel> and a marketing.any roll-up', () => {
    const c = buildXdmConsents({ essential: true, email: true, push: false }, CATS);
    expect(c.marketing).toEqual({ email: { val: 'y' }, push: { val: 'n' }, any: { val: 'y' } });
  });

  it('marketing.any is n when no channel is granted', () => {
    const c = buildXdmConsents({ essential: true, email: false, push: false }, CATS);
    expect(c.marketing?.any).toEqual({ val: 'n' });
  });

  it('omits marketing entirely when no marketing categories exist', () => {
    const c = buildXdmConsents({ essential: true, analytics: true }, DATA_ONLY);
    expect(c.marketing).toBeUndefined();
  });

  it('marketing consent never leaks into collect', () => {
    // email granted, every data category denied → collect stays n.
    const c = buildXdmConsents(
      { essential: true, analytics: false, personalization: false, advertising: false, email: true },
      CATS
    );
    expect(c.collect).toEqual({ val: 'n' });
    expect(c.marketing?.email).toEqual({ val: 'y' });
  });

  it('sends adID only with an idType, gated by ATT', () => {
    expect(buildXdmConsents({ advertising: true }, CATS).adID).toBeUndefined();
    expect(buildXdmConsents({ advertising: true }, CATS, { adIdType: 'IDFA' }).adID).toEqual({
      idType: 'IDFA',
      val: 'y',
    });
    expect(
      buildXdmConsents({ advertising: true }, CATS, { adIdType: 'IDFA', attAuthorized: false }).adID
    ).toEqual({ idType: 'IDFA', val: 'n' });
  });
});

describe('buildMarketingConsents', () => {
  it('returns just the marketing slice', () => {
    expect(buildMarketingConsents({ email: true, push: false }, CATS)).toEqual({
      marketing: { email: { val: 'y' }, push: { val: 'n' }, any: { val: 'y' } },
    });
  });
  it('returns null without marketing categories', () => {
    expect(buildMarketingConsents({ analytics: true }, DATA_ONLY)).toBeNull();
  });
});

describe('MarketingConsentAdapter', () => {
  beforeEach(() => {
    delete (window as Record<string, unknown>).alloy;
    delete (window as Record<string, unknown>).__alloyNS;
    for (const part of document.cookie.split(';')) {
      const n = part.split('=')[0]?.trim();
      if (n) document.cookie = n + '=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/';
    }
    window.localStorage.clear();
  });

  const engineWith = (cats: CategoryDefinition[]) =>
    new ConsentEngine({ geo: { region: 'DE' }, categories: cats });

  it('sends marketing consent via sendEvent when marketing categories exist', () => {
    const engine = engineWith(CATS);
    const alloy = vi.fn(() => Promise.resolve());
    (window as Record<string, unknown>).alloy = alloy;
    (window as Record<string, unknown>).__alloyNS = ['alloy'];

    new MarketingConsentAdapter(engine).attach();
    engine.start();

    expect(alloy).toHaveBeenCalled();
    const [cmd, payload] = alloy.mock.calls[0] as [string, { xdm: { consents: { marketing: unknown } } }];
    expect(cmd).toBe('sendEvent');
    expect(payload.xdm.consents.marketing).toBeDefined();
  });

  it('is inert when no marketing categories are configured', () => {
    const engine = engineWith(DATA_ONLY);
    const alloy = vi.fn();
    (window as Record<string, unknown>).alloy = alloy;
    (window as Record<string, unknown>).__alloyNS = ['alloy'];

    new MarketingConsentAdapter(engine).attach();
    engine.start();
    expect(alloy).not.toHaveBeenCalled();
  });

  it('re-sends updated marketing consent on change', () => {
    const engine = engineWith(CATS);
    const alloy = vi.fn(() => Promise.resolve());
    (window as Record<string, unknown>).alloy = alloy;
    (window as Record<string, unknown>).__alloyNS = ['alloy'];

    new MarketingConsentAdapter(engine).attach();
    engine.start();
    engine.save({ email: true });

    const last = alloy.mock.calls[alloy.mock.calls.length - 1]![1] as {
      xdm: { consents: { marketing: { email: unknown } } };
    };
    expect(last.xdm.consents.marketing.email).toEqual({ val: 'y' });
  });

  it('survives an alloy instance that throws', () => {
    const engine = engineWith(CATS);
    (window as Record<string, unknown>).alloy = () => {
      throw new Error('alloy exploded');
    };
    (window as Record<string, unknown>).__alloyNS = ['alloy'];
    const adapter = new MarketingConsentAdapter(engine);
    expect(() => adapter.send(engine.decision)).not.toThrow();
  });
});
