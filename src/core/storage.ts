import type { ConsentState, StorageOptions } from './types';

const SCHEMA = 1;
const LS_PREFIX = 'adobeConsent:';

export const DEFAULT_STORAGE: Required<
  Pick<
    StorageOptions,
    'cookieName' | 'cookiePath' | 'cookieSameSite' | 'expiryDays' | 'useLocalStorage'
  >
> = {
  cookieName: 'adobe_consent',
  cookiePath: '/',
  cookieSameSite: 'Lax',
  expiryDays: 365,
  useLocalStorage: true,
};

/**
 * On-disk shape. Keys are short because this lives in a cookie that is sent on
 * every request; the full state is ~140 bytes serialized.
 */
interface Wire {
  v: number;
  pv: number;
  c: Record<string, 0 | 1>;
  t: number;
  m: string;
  id: string;
  r?: string;
  g?: 0 | 1;
}

export function serialize(state: ConsentState): string {
  const c: Record<string, 0 | 1> = {};
  for (const key of Object.keys(state.categories)) c[key] = state.categories[key] ? 1 : 0;
  const wire: Wire = {
    v: SCHEMA,
    pv: state.policyVersion,
    c,
    t: state.timestamp,
    m: state.method,
    id: state.id,
  };
  if (state.region) wire.r = state.region;
  if (state.gpc) wire.g = 1;
  return encodeURIComponent(JSON.stringify(wire));
}

export function deserialize(raw: string | null): ConsentState | null {
  if (!raw) return null;
  let wire: Wire;
  try {
    wire = JSON.parse(decodeURIComponent(raw)) as Wire;
  } catch {
    return null;
  }
  if (!wire || typeof wire !== 'object' || !wire.c || typeof wire.t !== 'number') return null;

  const categories: Record<string, boolean> = {};
  for (const key of Object.keys(wire.c)) categories[key] = wire.c[key] === 1;

  return {
    schema: wire.v || SCHEMA,
    policyVersion: typeof wire.pv === 'number' ? wire.pv : 1,
    categories,
    timestamp: wire.t,
    method: (wire.m || 'restored') as ConsentState['method'],
    id: wire.id || '',
    region: wire.r,
    gpc: wire.g === 1,
  };
}

export function readCookie(name: string): string | null {
  if (typeof document === 'undefined' || !document.cookie) return null;
  const target = name + '=';
  for (const part of document.cookie.split(';')) {
    const trimmed = part.trim();
    if (trimmed.indexOf(target) === 0) return trimmed.substring(target.length);
  }
  return null;
}

export function writeCookie(name: string, value: string, opts: StorageOptions): void {
  if (typeof document === 'undefined') return;
  const days = opts.expiryDays ?? DEFAULT_STORAGE.expiryDays;
  const expires = new Date(Date.now() + days * 864e5).toUTCString();
  const sameSite = opts.cookieSameSite ?? DEFAULT_STORAGE.cookieSameSite;
  // SameSite=None is only honored alongside Secure, so force it in that case.
  const secure =
    opts.cookieSecure ??
    (sameSite === 'None' ||
      (typeof location !== 'undefined' && location.protocol === 'https:'));

  let cookie =
    name +
    '=' +
    value +
    ';expires=' +
    expires +
    ';path=' +
    (opts.cookiePath ?? DEFAULT_STORAGE.cookiePath) +
    ';SameSite=' +
    sameSite;
  if (opts.cookieDomain) cookie += ';domain=' + opts.cookieDomain;
  if (secure) cookie += ';Secure';
  document.cookie = cookie;
}

export function deleteCookie(name: string, opts: StorageOptions): void {
  if (typeof document === 'undefined') return;
  let cookie =
    name + '=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=' + (opts.cookiePath ?? '/');
  if (opts.cookieDomain) cookie += ';domain=' + opts.cookieDomain;
  document.cookie = cookie;
}

function lsGet(key: string): string | null {
  try {
    return window.localStorage.getItem(LS_PREFIX + key);
  } catch {
    return null;
  }
}

function lsSet(key: string, value: string): void {
  try {
    window.localStorage.setItem(LS_PREFIX + key, value);
  } catch {
    /* Safari private mode, storage full, or blocked by policy. Cookie still holds. */
  }
}

function lsRemove(key: string): void {
  try {
    window.localStorage.removeItem(LS_PREFIX + key);
  } catch {
    /* no-op */
  }
}

export class ConsentStorage {
  private opts: StorageOptions;

  constructor(opts: StorageOptions = {}) {
    this.opts = { ...DEFAULT_STORAGE, ...opts };
  }

  get cookieName(): string {
    return this.opts.cookieName ?? DEFAULT_STORAGE.cookieName;
  }

  /**
   * Reads the stored decision. Prefers the cookie, falling back to the
   * localStorage mirror when the cookie was dropped (ITP, a `clear cookies`
   * sweep, or a cross-subdomain move) and re-seeding the cookie from it.
   */
  read(): ConsentState | null {
    const fromCookie = deserialize(readCookie(this.cookieName));
    if (fromCookie) return fromCookie;

    if (this.opts.useLocalStorage) {
      const mirrored = deserialize(lsGet(this.cookieName));
      if (mirrored) {
        writeCookie(this.cookieName, serialize(mirrored), this.opts);
        return mirrored;
      }
    }
    return null;
  }

  write(state: ConsentState): void {
    const value = serialize(state);
    writeCookie(this.cookieName, value, this.opts);
    if (this.opts.useLocalStorage) lsSet(this.cookieName, value);
  }

  clear(): void {
    deleteCookie(this.cookieName, this.opts);
    if (this.opts.useLocalStorage) lsRemove(this.cookieName);
  }

  /** Arbitrary side storage (region cache, receipt history) sharing the prefix. */
  getItem(key: string): string | null {
    return lsGet(key);
  }

  setItem(key: string, value: string): void {
    lsSet(key, value);
  }

  /**
   * True when the decision is older than the re-consent window and the user
   * should be asked again.
   */
  isExpired(state: ConsentState, reconsentDays?: number): boolean {
    const days = reconsentDays ?? this.opts.expiryDays ?? DEFAULT_STORAGE.expiryDays;
    if (!days) return false;
    return Date.now() - state.timestamp > days * 864e5;
  }
}
