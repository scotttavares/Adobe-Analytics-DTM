import { describe, expect, it, vi } from 'vitest';
import { ConsentEngine } from '../../../src/core/engine';
import { EdgeConsentAdapter } from '../src/edgeConsentAdapter';
import type { AepConsentModule } from '../src/types';

function fakeConsent() {
  const update = vi.fn();
  const mod: AepConsentModule = { update };
  return { mod, update };
}

function startedEngine() {
  const engine = new ConsentEngine({ geo: { region: 'DE' } });
  engine.start();
  return engine;
}

describe('EdgeConsentAdapter.buildConsents', () => {
  it('builds an XDM consents object with y/n values', () => {
    const adapter = new EdgeConsentAdapter(startedEngine(), fakeConsent().mod);
    const { consents } = adapter.buildConsents({
      essential: true,
      analytics: true,
      personalization: false,
      advertising: false,
    });

    expect(consents.collect).toEqual({ val: 'y' });
    expect(consents.share).toEqual({ val: 'n' });
    expect(consents.personalize).toEqual({ content: { val: 'n' } });
    expect(consents.metadata.time).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('grants collect when any data category is granted', () => {
    const adapter = new EdgeConsentAdapter(startedEngine(), fakeConsent().mod);
    const { consents } = adapter.buildConsents({
      essential: true,
      analytics: false,
      personalization: true,
      advertising: false,
    });

    // Personalization alone must still open collect, mirroring the web adapter.
    expect(consents.collect).toEqual({ val: 'y' });
    expect(consents.personalize).toEqual({ content: { val: 'y' } });
  });

  it('denies collect when everything optional is denied', () => {
    const adapter = new EdgeConsentAdapter(startedEngine(), fakeConsent().mod);
    const { consents } = adapter.buildConsents({
      essential: true,
      analytics: false,
      personalization: false,
      advertising: false,
    });
    expect(consents.collect).toEqual({ val: 'n' });
  });

  it('omits adID unless a device id type is configured', () => {
    const adapter = new EdgeConsentAdapter(startedEngine(), fakeConsent().mod);
    const { consents } = adapter.buildConsents({ essential: true, advertising: true });
    expect(consents.adID).toBeUndefined();
  });

  it('sends adID when adIdType is set (unlike the web)', () => {
    const adapter = new EdgeConsentAdapter(startedEngine(), fakeConsent().mod, {
      adIdType: 'IDFA',
    });
    const { consents } = adapter.buildConsents({ essential: true, advertising: true });
    expect(consents.adID).toEqual({ idType: 'IDFA', val: 'y' });
  });

  it('denies adID when ATT is not authorized, even with advertising granted', () => {
    const adapter = new EdgeConsentAdapter(startedEngine(), fakeConsent().mod, {
      adIdType: 'IDFA',
      attAuthorized: () => false,
    });
    const { consents } = adapter.buildConsents({ essential: true, advertising: true });
    expect(consents.adID).toEqual({ idType: 'IDFA', val: 'n' });
  });
});

describe('EdgeConsentAdapter delivery', () => {
  it('calls Consent.update with the { consents } payload', () => {
    const { mod, update } = fakeConsent();
    new EdgeConsentAdapter(startedEngine(), mod).send({ essential: true, analytics: true });

    expect(update).toHaveBeenCalledTimes(1);
    const arg = update.mock.calls[0]![0] as { consents: { collect: unknown } };
    expect(arg.consents.collect).toEqual({ val: 'y' });
  });

  it('updates on ready and again on change', () => {
    const engine = new ConsentEngine({ geo: { region: 'DE' } });
    const { mod, update } = fakeConsent();
    new EdgeConsentAdapter(engine, mod).attach();
    engine.start();

    // DE is opt-in: the ready call re-asserts the default (collect denied).
    expect(update).toHaveBeenCalledTimes(1);
    expect((update.mock.calls[0]![0] as any).consents.collect).toEqual({ val: 'n' });

    engine.acceptAll();
    expect(update).toHaveBeenCalledTimes(2);
    expect((update.mock.calls[1]![0] as any).consents.collect).toEqual({ val: 'y' });
  });

  it('does not send on load when sendOnEveryLoad is false', () => {
    const engine = new ConsentEngine({ geo: { region: 'DE' } });
    const { mod, update } = fakeConsent();
    new EdgeConsentAdapter(engine, mod, { sendOnEveryLoad: false }).attach();
    engine.start();
    expect(update).not.toHaveBeenCalled();

    engine.acceptAll();
    expect(update).toHaveBeenCalledTimes(1);
  });

  it('survives a Consent module that throws', () => {
    const engine = startedEngine();
    const mod: AepConsentModule = {
      update: () => {
        throw new Error('native module exploded');
      },
    };
    expect(() => new EdgeConsentAdapter(engine, mod).send({ analytics: true })).not.toThrow();
  });
});
