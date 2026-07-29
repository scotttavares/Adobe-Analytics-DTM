import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { detectRegion } from '../src/core/geo';
import { ConsentEngine } from '../src/core/engine';

function clearStorage(): void {
  for (const part of document.cookie.split(';')) {
    const name = part.split('=')[0]?.trim();
    if (name) document.cookie = name + '=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/';
  }
  window.localStorage.clear();
}

/** Minimal storage double matching what detectRegion needs. */
function memoryStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => (map.has(k) ? map.get(k)! : null),
    setItem: (k: string, v: string) => void map.set(k, v),
    _map: map,
  };
}

function mockFetch(payload: unknown, ok = true) {
  const fn = vi.fn(() =>
    Promise.resolve({
      ok,
      json: () => Promise.resolve(payload),
    } as Response)
  );
  (globalThis as Record<string, unknown>).fetch = fn;
  return fn;
}

describe('region detection', () => {
  beforeEach(() => {
    clearStorage();
    document.head.innerHTML = '';
  });

  afterEach(() => {
    delete (globalThis as Record<string, unknown>).fetch;
  });

  it('uses an explicitly configured region without any lookup', () => {
    const fetchSpy = mockFetch({ region: 'US-CA' });
    const result = detectRegion({ region: 'DE', endpoint: '/geo' }, memoryStorage());

    expect(result.immediate).toBe('DE');
    expect(result.pending).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('reads a region from a meta tag without a network call', () => {
    document.head.innerHTML = '<meta name="x-geo" content="US-CO">';
    const fetchSpy = mockFetch({ region: 'DE' });

    const result = detectRegion(
      { metaTagName: 'x-geo', endpoint: '/geo' },
      memoryStorage()
    );

    expect(result.immediate).toBe('US-CO');
    expect(result.pending).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('falls through to the endpoint when the meta tag is absent', () => {
    const fetchSpy = mockFetch({ region: 'FR' });
    const result = detectRegion(
      { metaTagName: 'x-geo', endpoint: '/geo', fallbackRegion: 'EU' },
      memoryStorage()
    );

    expect(result.immediate).toBe('EU');
    expect(result.pending).not.toBeNull();
    expect(fetchSpy).toHaveBeenCalledOnce();
  });

  it('returns the fallback immediately so nothing blocks first paint', async () => {
    mockFetch({ region: 'US-CA' });
    const result = detectRegion(
      { endpoint: '/geo', fallbackRegion: 'EU' },
      memoryStorage()
    );

    expect(result.immediate).toBe('EU');
    await expect(result.pending).resolves.toBe('US-CA');
  });

  it('defaults the fallback to EU, the stricter model', () => {
    const result = detectRegion({ endpoint: '/geo' }, memoryStorage());
    expect(result.immediate).toBe('EU');
  });

  it('builds a subdivision code from country plus subdivision', async () => {
    mockFetch({ country: 'US', subdivision: 'CO' });
    const result = detectRegion({ endpoint: '/geo' }, memoryStorage());
    await expect(result.pending).resolves.toBe('US-CO');
  });

  it('accepts a bare country code', async () => {
    mockFetch({ country: 'BR' });
    const result = detectRegion({ endpoint: '/geo' }, memoryStorage());
    await expect(result.pending).resolves.toBe('BR');
  });

  it('caches a resolved region and skips the next lookup', async () => {
    const storage = memoryStorage();
    const first = mockFetch({ region: 'US-CA' });

    await detectRegion({ endpoint: '/geo', cacheMinutes: 60 }, storage).pending;
    expect(first).toHaveBeenCalledOnce();

    const second = mockFetch({ region: 'DE' });
    const cached = detectRegion({ endpoint: '/geo' }, storage);

    expect(cached.immediate).toBe('US-CA');
    expect(cached.pending).toBeNull();
    expect(second).not.toHaveBeenCalled();
  });

  it('ignores an expired cache entry', () => {
    const storage = memoryStorage();
    storage.setItem(
      'region',
      JSON.stringify({ region: 'US-CA', expires: Date.now() - 1000 })
    );
    const fetchSpy = mockFetch({ region: 'DE' });

    const result = detectRegion({ endpoint: '/geo', fallbackRegion: 'EU' }, storage);

    expect(result.immediate).toBe('EU');
    expect(fetchSpy).toHaveBeenCalledOnce();
  });

  it('ignores a corrupt cache entry rather than throwing', () => {
    const storage = memoryStorage();
    storage.setItem('region', 'not-json');
    mockFetch({ region: 'DE' });

    expect(() => detectRegion({ endpoint: '/geo' }, storage)).not.toThrow();
  });

  it('falls back when the endpoint returns an error status', async () => {
    mockFetch({ region: 'US-CA' }, false);
    const result = detectRegion(
      { endpoint: '/geo', fallbackRegion: 'GB' },
      memoryStorage()
    );
    await expect(result.pending).resolves.toBe('GB');
  });

  it('falls back when the request rejects outright', async () => {
    (globalThis as Record<string, unknown>).fetch = vi.fn(() =>
      Promise.reject(new Error('offline'))
    );
    const result = detectRegion(
      { endpoint: '/geo', fallbackRegion: 'GB' },
      memoryStorage()
    );
    await expect(result.pending).resolves.toBe('GB');
  });

  it('does not cache a failed lookup', async () => {
    const storage = memoryStorage();
    (globalThis as Record<string, unknown>).fetch = vi.fn(() =>
      Promise.reject(new Error('offline'))
    );

    await detectRegion({ endpoint: '/geo' }, storage).pending;
    expect(storage.getItem('region')).toBeNull();
  });

  it('skips the lookup entirely when fetch is unavailable', () => {
    delete (globalThis as Record<string, unknown>).fetch;
    const result = detectRegion(
      { endpoint: '/geo', fallbackRegion: 'JP' },
      memoryStorage()
    );

    expect(result.immediate).toBe('JP');
    expect(result.pending).toBeNull();
  });
});

describe('late region resolution', () => {
  beforeEach(() => {
    clearStorage();
    document.head.innerHTML = '';
  });

  afterEach(() => {
    delete (globalThis as Record<string, unknown>).fetch;
  });

  /** Lets the detection promise and its `.then` chain settle. */
  const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

  it('starts on the fallback model and corrects itself when the region arrives', async () => {
    mockFetch({ region: 'US-TX' });

    const engine = new ConsentEngine({
      geo: { endpoint: '/geo', fallbackRegion: 'DE' },
      honorGpc: false,
    });
    engine.start();

    // First paint: EU-style opt-in, nothing granted.
    expect(engine.region).toBe('DE');
    expect(engine.model).toBe('opt_in');
    expect(engine.hasConsent('analytics')).toBe(false);

    await settle();

    // The real region is opt-out, so the defaults open up.
    expect(engine.region).toBe('US-TX');
    expect(engine.model).toBe('opt_out');
    expect(engine.hasConsent('analytics')).toBe(true);
  });

  it('reports newly granted categories when the model loosens', async () => {
    mockFetch({ region: 'US-TX' });

    const engine = new ConsentEngine({
      geo: { endpoint: '/geo', fallbackRegion: 'DE' },
      honorGpc: false,
    });

    const granted: string[][] = [];
    engine.on('change', (e) => granted.push(e.granted));
    engine.start();
    await settle();

    expect(granted).toHaveLength(1);
    expect(granted[0]!.sort()).toEqual(['advertising', 'analytics', 'personalization']);
  });

  it('reports revoked categories when the model tightens', async () => {
    mockFetch({ region: 'DE' });

    // A site that assumes US visitors unless told otherwise starts permissive.
    const engine = new ConsentEngine({
      geo: { endpoint: '/geo', fallbackRegion: 'US-TX' },
      honorGpc: false,
    });

    const revoked: string[][] = [];
    engine.on('change', (e) => revoked.push(e.revoked));
    engine.start();

    expect(engine.hasConsent('analytics')).toBe(true);
    await settle();

    expect(engine.hasConsent('analytics')).toBe(false);
    expect(revoked).toHaveLength(1);
    expect(revoked[0]!.sort()).toEqual(['advertising', 'analytics', 'personalization']);
  });

  it('releases gates when the late region grants a category', async () => {
    mockFetch({ region: 'US-TX' });

    const engine = new ConsentEngine({
      geo: { endpoint: '/geo', fallbackRegion: 'DE' },
      honorGpc: false,
    });
    engine.start();

    const fn = vi.fn();
    engine.gate('analytics', fn);
    expect(fn).not.toHaveBeenCalled();

    await settle();
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('leaves an explicit decision alone when the region arrives later', async () => {
    mockFetch({ region: 'US-TX' });

    const engine = new ConsentEngine({
      geo: { endpoint: '/geo', fallbackRegion: 'DE' },
      honorGpc: false,
    });
    engine.start();
    engine.rejectAll();

    const changes: unknown[] = [];
    engine.on('change', (e) => changes.push(e));

    await settle();

    // The visitor said no. A later geo answer must not undo that.
    expect(engine.region).toBe('US-TX');
    expect(engine.hasConsent('analytics')).toBe(false);
    expect(changes).toHaveLength(0);
  });

  it('does nothing when the resolved region matches the fallback', async () => {
    mockFetch({ region: 'DE' });

    const engine = new ConsentEngine({
      geo: { endpoint: '/geo', fallbackRegion: 'DE' },
      honorGpc: false,
    });
    const changes: unknown[] = [];
    engine.on('change', (e) => changes.push(e));
    engine.start();

    await settle();
    expect(changes).toHaveLength(0);
  });

  it('still prompts while the region is in flight', () => {
    mockFetch({ region: 'US-TX' });
    const engine = new ConsentEngine({
      geo: { endpoint: '/geo', fallbackRegion: 'DE' },
      honorGpc: false,
    });
    engine.start();

    expect(engine.isPending()).toBe(true);
    expect(engine.shouldPrompt()).toBe(true);
  });
});
