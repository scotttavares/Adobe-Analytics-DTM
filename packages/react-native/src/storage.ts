import { deserialize, serialize } from '../../../src/core/storage';
import type {
  ConsentState,
  ConsentStorageBackend,
  StorageOptions,
} from '../../../src/core/types';
import type { KeyValueStore } from './types';

const DEFAULT_KEY = 'clearconsent';
const PREFIX = '@clearconsent/';
const DEFAULT_EXPIRY_DAYS = 365;

/** The side keys the engine reads/writes through getItem/setItem. */
const SIDE_KEYS = ['region', 'receipts'];

/**
 * A synchronous {@link ConsentStorageBackend} backed by an async key-value
 * store (AsyncStorage, or an MMKV wrapper).
 *
 * The engine reads storage synchronously, but AsyncStorage is async — so this
 * hydrates the handful of keys the engine touches into an in-memory cache once
 * (`hydrate()`), then serves reads from the cache and writes through to the
 * store in the background. Call `hydrate()` before `engine.start()`;
 * `createMobileConsent` does that for you.
 *
 * Serialization is the *same* `serialize`/`deserialize` the web build uses, so a
 * decision has an identical on-disk shape across platforms.
 */
export class RnConsentStorage implements ConsentStorageBackend {
  private readonly cache = new Map<string, string>();
  private readonly decisionKey: string;
  private readonly expiryDays: number;

  constructor(
    private readonly kv: KeyValueStore,
    opts: StorageOptions = {},
    private readonly onError: (e: unknown) => void = () => {}
  ) {
    this.decisionKey = opts.cookieName ?? DEFAULT_KEY;
    this.expiryDays = opts.expiryDays ?? DEFAULT_EXPIRY_DAYS;
  }

  /** Load the decision and side keys into the cache. Safe to call more than once. */
  async hydrate(): Promise<void> {
    const keys = [this.decisionKey, ...SIDE_KEYS];
    await Promise.all(
      keys.map(async (key) => {
        try {
          const value = await this.kv.getItem(PREFIX + key);
          if (value != null) this.cache.set(key, value);
        } catch (e) {
          this.onError(e);
        }
      })
    );
  }

  read(): ConsentState | null {
    return deserialize(this.cache.get(this.decisionKey) ?? null);
  }

  write(state: ConsentState): void {
    const value = serialize(state);
    this.cache.set(this.decisionKey, value);
    this.persist(this.decisionKey, value);
  }

  clear(): void {
    this.cache.delete(this.decisionKey);
    this.remove(this.decisionKey);
  }

  getItem(key: string): string | null {
    return this.cache.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.cache.set(key, value);
    this.persist(key, value);
  }

  isExpired(state: ConsentState, reconsentDays?: number): boolean {
    const days = reconsentDays ?? this.expiryDays;
    if (!days) return false;
    return Date.now() - state.timestamp > days * 864e5;
  }

  private persist(key: string, value: string): void {
    void this.kv.setItem(PREFIX + key, value).catch(this.onError);
  }

  private remove(key: string): void {
    void this.kv.removeItem(PREFIX + key).catch(this.onError);
  }
}
