import { ConsentEngine } from '../../../src/core/engine';
import type { ConsentConfig } from '../../../src/core/types';
import { EdgeConsentAdapter } from './edgeConsentAdapter';
import { RnConsentStorage } from './storage';
import type { AepConsentModule, EdgeConsentOptions, KeyValueStore } from './types';

export interface MobileConsentSetup {
  /** The `Consent` export from `@adobe/react-native-aepedgeconsent`. */
  consent: AepConsentModule;
  /** Async key-value store, e.g. AsyncStorage (or an MMKV wrapper). */
  storage: KeyValueStore;
  /** Edge Consent adapter options. */
  edge?: EdgeConsentOptions;
  /** Called if a background persist fails (storage is best-effort). */
  onStorageError?: (e: unknown) => void;
}

/**
 * Wires the shared consent engine to React Native: hydrates the persisted
 * decision, injects the RN storage backend, attaches the Edge Consent adapter,
 * and starts. Returns the started engine.
 *
 * Because AsyncStorage is async, this is async — await it before rendering the
 * banner so a stored decision isn't briefly ignored on cold start.
 * `ClearConsentProvider` handles that for you.
 */
export async function createMobileConsent(
  config: ConsentConfig,
  setup: MobileConsentSetup
): Promise<ConsentEngine> {
  const backend = new RnConsentStorage(setup.storage, config.storage, setup.onStorageError);
  await backend.hydrate();

  const engine = new ConsentEngine(config, { storage: backend });
  new EdgeConsentAdapter(engine, setup.consent, setup.edge).attach();
  engine.start();
  return engine;
}
