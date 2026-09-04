import { describe, expect, it, vi } from 'vitest';
import { createMobileConsent } from '../src/createMobileConsent';
import type { AepConsentModule, KeyValueStore } from '../src/types';

function fakeKv() {
  const map = new Map<string, string>();
  const kv: KeyValueStore = {
    getItem: async (k: string) => (map.has(k) ? map.get(k)! : null),
    setItem: async (k: string, v: string) => {
      map.set(k, v);
    },
    removeItem: async (k: string) => {
      map.delete(k);
    },
  };
  return { kv, map };
}

function fakeConsent() {
  const update = vi.fn();
  const mod: AepConsentModule = { update };
  return { mod, update };
}

const last = (update: ReturnType<typeof vi.fn>) =>
  update.mock.calls[update.mock.calls.length - 1]![0] as { consents: any };

describe('createMobileConsent', () => {
  it('re-asserts the region default on start, then the new decision on accept', async () => {
    const { kv } = fakeKv();
    const { mod, update } = fakeConsent();

    const engine = await createMobileConsent({ geo: { region: 'DE' } }, { consent: mod, storage: kv });

    // DE is opt-in: on start, collect is denied by default.
    expect(update).toHaveBeenCalledTimes(1);
    expect(last(update).consents.collect).toEqual({ val: 'n' });

    engine.acceptAll();
    expect(update).toHaveBeenCalledTimes(2);
    expect(last(update).consents.collect).toEqual({ val: 'y' });
  });

  it('restores a persisted decision across a cold start', async () => {
    const { kv } = fakeKv();

    // First launch: the user accepts.
    const first = await createMobileConsent(
      { geo: { region: 'DE' } },
      { consent: fakeConsent().mod, storage: kv }
    );
    first.acceptAll();

    // Second launch: same storage, fresh engine + Consent module.
    const { mod, update } = fakeConsent();
    const second = await createMobileConsent({ geo: { region: 'DE' } }, { consent: mod, storage: kv });

    expect(second.isPending()).toBe(false);
    expect(second.hasConsent('analytics')).toBe(true);
    // On ready it re-asserts the restored decision — collect granted.
    expect(update).toHaveBeenCalledTimes(1);
    expect(last(update).consents.collect).toEqual({ val: 'y' });
  });

  it('sends adID gated by ATT when adIdType is configured', async () => {
    const { kv } = fakeKv();
    const { mod, update } = fakeConsent();

    const engine = await createMobileConsent(
      { geo: { region: 'DE' } },
      { consent: mod, storage: kv, edge: { adIdType: 'IDFA', attAuthorized: () => false } }
    );
    engine.save({ advertising: true });

    expect(last(update).consents.adID).toEqual({ idType: 'IDFA', val: 'n' });
  });

  it('sends adID granted when advertising is on and no ATT gate is given', async () => {
    const { kv } = fakeKv();
    const { mod, update } = fakeConsent();

    const engine = await createMobileConsent(
      { geo: { region: 'DE' } },
      { consent: mod, storage: kv, edge: { adIdType: 'GAID' } }
    );
    engine.save({ advertising: true });

    expect(last(update).consents.adID).toEqual({ idType: 'GAID', val: 'y' });
  });
});
