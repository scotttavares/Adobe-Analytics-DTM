import { describe, expect, it, vi } from 'vitest';
import type { ConsentState } from '../../../src/core/types';
import { RnConsentStorage } from '../src/storage';
import type { KeyValueStore } from '../src/types';

function fakeKv() {
  const map = new Map<string, string>();
  const kv: KeyValueStore = {
    getItem: vi.fn(async (k: string) => (map.has(k) ? map.get(k)! : null)),
    setItem: vi.fn(async (k: string, v: string) => {
      map.set(k, v);
    }),
    removeItem: vi.fn(async (k: string) => {
      map.delete(k);
    }),
  };
  return { kv, map };
}

const state: ConsentState = {
  schema: 1,
  policyVersion: 1,
  categories: { essential: true, analytics: true, personalization: false, advertising: false },
  timestamp: Date.now(),
  method: 'accept_all',
  id: 'receipt-1',
  region: 'DE',
};

describe('RnConsentStorage', () => {
  it('writes through to the KV and reads back synchronously', () => {
    const { kv, map } = fakeKv();
    const store = new RnConsentStorage(kv);
    store.write(state);

    expect(map.get('@clearconsent/clearconsent')).toBeTruthy();
    const back = store.read();
    expect(back).not.toBeNull();
    expect(back!.categories).toEqual(state.categories);
    expect(back!.method).toBe('accept_all');
    expect(back!.id).toBe('receipt-1');
    expect(back!.region).toBe('DE');
  });

  it('restores a persisted decision on a fresh (cold-start) instance', async () => {
    const { kv } = fakeKv();
    new RnConsentStorage(kv).write(state);

    const cold = new RnConsentStorage(kv);
    expect(cold.read()).toBeNull(); // nothing hydrated yet
    await cold.hydrate();
    expect(cold.read()!.categories).toEqual(state.categories);
  });

  it('round-trips side keys and hydrates them too', async () => {
    const { kv } = fakeKv();
    const store = new RnConsentStorage(kv);
    store.setItem('region', JSON.stringify({ region: 'US-CA', expires: Date.now() + 1e6 }));
    expect(store.getItem('region')).toContain('US-CA');

    const cold = new RnConsentStorage(kv);
    await cold.hydrate();
    expect(cold.getItem('region')).toContain('US-CA');
  });

  it('clear removes the decision from cache and store', () => {
    const { kv, map } = fakeKv();
    const store = new RnConsentStorage(kv);
    store.write(state);
    store.clear();
    expect(store.read()).toBeNull();
    expect(map.has('@clearconsent/clearconsent')).toBe(false);
  });

  it('honors a custom decision key', () => {
    const { kv, map } = fakeKv();
    new RnConsentStorage(kv, { cookieName: 'myconsent' }).write(state);
    expect(map.has('@clearconsent/myconsent')).toBe(true);
  });

  it('reports expiry against the reconsent window', () => {
    const { kv } = fakeKv();
    const store = new RnConsentStorage(kv, { expiryDays: 365 });
    const old: ConsentState = { ...state, timestamp: Date.now() - 400 * 864e5 };
    expect(store.isExpired(old)).toBe(true);
    expect(store.isExpired(state)).toBe(false);
  });

  it('swallows a failing KV write rather than throwing', () => {
    const kv: KeyValueStore = {
      getItem: async () => null,
      setItem: async () => {
        throw new Error('disk full');
      },
      removeItem: async () => undefined,
    };
    const onError = vi.fn();
    const store = new RnConsentStorage(kv, {}, onError);
    expect(() => store.write(state)).not.toThrow();
  });
});
