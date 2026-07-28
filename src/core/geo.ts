import type { ConsentModel, GeoOptions, RegionRule } from './types';

const CACHE_KEY = 'region';

export interface ResolvedRegion {
  region: string;
  model: ConsentModel;
  defaultGranted: string[];
  suppressBanner: boolean;
}

/**
 * Picks the rule for a region. Specific beats general: an exact `US-CA` match
 * wins over `US`, which wins over `*`. Matching is case-insensitive.
 */
export function matchRegionRule(region: string, rules: RegionRule[]): RegionRule | null {
  const target = (region || '').toUpperCase();
  const country = target.split('-')[0] || '';

  let exact: RegionRule | null = null;
  let countryLevel: RegionRule | null = null;
  let wildcard: RegionRule | null = null;

  for (const rule of rules) {
    for (const raw of rule.match) {
      const candidate = raw.toUpperCase();
      if (candidate === '*') {
        if (!wildcard) wildcard = rule;
      } else if (candidate === target) {
        if (!exact) exact = rule;
      } else if (candidate === country) {
        if (!countryLevel) countryLevel = rule;
      }
    }
  }
  return exact || countryLevel || wildcard;
}

export function resolveRegion(
  region: string,
  rules: RegionRule[],
  fallbackModel: ConsentModel
): ResolvedRegion {
  const rule = matchRegionRule(region, rules);
  return {
    region,
    model: rule ? rule.model : fallbackModel,
    defaultGranted: rule?.defaultGranted ? rule.defaultGranted.slice() : [],
    suppressBanner: !!rule?.suppressBanner,
  };
}

function readMeta(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const el = document.querySelector('meta[name="' + name + '"]');
  const content = el?.getAttribute('content');
  return content ? content.trim() : null;
}

interface GeoCache {
  region: string;
  expires: number;
}

/**
 * Resolves the visitor's region without blocking first paint.
 *
 * Order: explicit config, then a meta tag (the CDN-header path — free and
 * synchronous), then a cached lookup, then the network endpoint. If the network
 * is the only option, the caller gets the fallback region immediately and a
 * promise that resolves later, so the banner can render now and correct itself.
 */
export function detectRegion(
  opts: GeoOptions,
  storage: { getItem(k: string): string | null; setItem(k: string, v: string): void }
): { immediate: string; pending: Promise<string> | null } {
  const fallback = opts.fallbackRegion || 'EU';

  if (opts.region) return { immediate: opts.region, pending: null };

  if (opts.metaTagName) {
    const fromMeta = readMeta(opts.metaTagName);
    if (fromMeta) return { immediate: fromMeta, pending: null };
  }

  const cachedRaw = storage.getItem(CACHE_KEY);
  if (cachedRaw) {
    try {
      const cached = JSON.parse(cachedRaw) as GeoCache;
      if (cached && cached.expires > Date.now() && cached.region) {
        return { immediate: cached.region, pending: null };
      }
    } catch {
      /* corrupt cache — fall through to a fresh lookup */
    }
  }

  if (!opts.endpoint || typeof fetch === 'undefined') {
    return { immediate: fallback, pending: null };
  }

  const minutes = opts.cacheMinutes ?? 720;
  const pending = fetch(opts.endpoint, { credentials: 'omit', mode: 'cors' })
    .then((res) => (res.ok ? res.json() : null))
    .then((data: Record<string, string> | null) => {
      if (!data) return fallback;
      const region =
        data.region ||
        data.regionCode ||
        (data.country && data.subdivision
          ? data.country + '-' + data.subdivision
          : data.country) ||
        fallback;
      storage.setItem(
        CACHE_KEY,
        JSON.stringify({ region, expires: Date.now() + minutes * 60000 } as GeoCache)
      );
      return region;
    })
    .catch(() => fallback);

  return { immediate: fallback, pending };
}
