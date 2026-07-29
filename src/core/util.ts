/** Shared helpers. Deliberately dependency-free and ES2019-compatible. */

export function uid(): string {
  const c: Crypto | undefined =
    typeof crypto !== 'undefined' ? (crypto as Crypto) : undefined;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  if (c && typeof c.getRandomValues === 'function') {
    const bytes = c.getRandomValues(new Uint8Array(16));
    let out = '';
    for (let i = 0; i < bytes.length; i++) out += (bytes[i]! + 0x100).toString(16).slice(1);
    return out;
  }
  return (
    Date.now().toString(36) + Math.random().toString(36).slice(2, 10)
  );
}

/**
 * FNV-1a. Not a security primitive — it exists so a stored receipt carries a
 * cheap integrity marker that survives JSON round-trips.
 */
export function digest(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = (hash + ((hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24))) >>> 0;
  }
  return ('00000000' + hash.toString(16)).slice(-8);
}

export function shallowEqual(
  a: Record<string, boolean>,
  b: Record<string, boolean>
): boolean {
  const aKeys = Object.keys(a);
  if (aKeys.length !== Object.keys(b).length) return false;
  for (const key of aKeys) if (a[key] !== b[key]) return false;
  return true;
}

export function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof document !== 'undefined';
}

/** Runs `fn` when the DOM is parsed, or immediately if it already is. */
export function onDomReady(fn: () => void): void {
  if (!isBrowser()) return;
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', fn, { once: true });
  } else {
    fn();
  }
}

export function safe<T>(fn: () => T, onError?: (e: unknown) => void): T | undefined {
  try {
    return fn();
  } catch (e) {
    if (onError) onError(e);
    return undefined;
  }
}

export function createLogger(enabled: boolean, prefix = '[adobe-consent]') {
  const noop = () => {};
  if (!enabled || typeof console === 'undefined') {
    return { log: noop, warn: noop, error: noop, group: noop };
  }
  return {
    log: (...args: unknown[]) => console.log(prefix, ...args),
    warn: (...args: unknown[]) => console.warn(prefix, ...args),
    error: (...args: unknown[]) => console.error(prefix, ...args),
    group: (label: string, body: () => void) => {
      /* eslint-disable-next-line no-console */
      console.groupCollapsed(prefix + ' ' + label);
      body();
      /* eslint-disable-next-line no-console */
      console.groupEnd();
    },
  };
}

export type Logger = ReturnType<typeof createLogger>;

/** Deep-merges plain objects; arrays are replaced, not concatenated. */
export function merge<T extends Record<string, any>>(base: T, override?: Partial<T>): T {
  if (!override) return { ...base };
  const out: Record<string, any> = { ...base };
  for (const key of Object.keys(override)) {
    const value = (override as Record<string, any>)[key];
    if (value === undefined) continue;
    const existing = out[key];
    const bothPlain =
      value &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      existing &&
      typeof existing === 'object' &&
      !Array.isArray(existing);
    out[key] = bothPlain ? merge(existing, value) : value;
  }
  return out as T;
}
