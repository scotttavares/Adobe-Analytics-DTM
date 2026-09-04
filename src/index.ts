import { attachAdobe, type AdobeAdapters } from './adobe';
import { AutoBlocker } from './blocking/autoblock';
import { ConsentEngine } from './core/engine';
import { DEFAULT_CATEGORIES, DEFAULT_TEXT, DEFAULT_REGIONS } from './core/defaults';
import type {
  CategoryId,
  ConsentConfig,
  ConsentDecision,
  ConsentEventName,
  ConsentReceipt,
  ConsentState,
} from './core/types';
import { isBrowser, onDomReady } from './core/util';
import { ConsentBanner } from './ui/banner';

export * from './core/types';
export { ConsentEngine } from './core/engine';
export { ConsentBanner } from './ui/banner';
export { AutoBlocker } from './blocking/autoblock';
export { DEFAULT_CATEGORIES, DEFAULT_TEXT, DEFAULT_REGIONS, DEFAULT_CONFIG } from './core/defaults';
export {
  attachAdobe,
  WebSdkAdapter,
  OptInAdapter,
  AnalyticsAdapter,
  DataLayerAdapter,
  LaunchAdapter,
  MarketingConsentAdapter,
  DEFAULT_MAPPING,
  OPT_IN_CATEGORIES,
  buildXdmConsents,
  buildMarketingConsents,
} from './adobe';
export type { XdmConsents } from './adobe';

interface ConfigWindow extends Window {
  clearConsentConfig?: ConsentConfig;
  ClearConsent?: unknown;
}

/**
 * The public façade. One object holds the engine, the UI, the blocker, and the
 * Adobe adapters so a page only ever touches `ClearConsent`.
 */
export class ConsentManager {
  readonly engine: ConsentEngine;
  readonly banner: ConsentBanner;
  readonly blocker: AutoBlocker | null;
  adobe: AdobeAdapters | null = null;

  private booted = false;

  constructor(config: ConsentConfig = {}) {
    // The hooks are closures, evaluated long after the constructor returns, so
    // referencing `this.banner` here is safe despite it being assigned below.
    this.engine = new ConsentEngine(config, {
      canShowUi: () => !config.ui?.headless,
      getCopy: () => this.banner.getCopy(),
    });

    this.banner = new ConsentBanner(this.engine, config.ui || {});
    this.blocker = config.autoBlock !== false ? new AutoBlocker(this.engine) : null;
  }

  /** Resolves consent, wires Adobe, renders UI if a decision is needed. */
  init(): ConsentManager {
    if (this.booted) return this;
    this.booted = true;

    // Adapters and the blocker subscribe before `start()` so they receive the
    // very first `ready` event rather than missing the initial state.
    this.adobe = attachAdobe(this.engine, this.engine.config.adobe || {});
    this.blocker?.start();

    this.engine.start();

    if (!this.engine.config.ui?.headless) {
      onDomReady(() => {
        if (this.engine.shouldPrompt()) this.banner.open('notice');
        else this.banner.renderBadge();
      });
    }
    return this;
  }

  // ------------------------------------------------------- delegated public API

  /** True when the category is currently granted. */
  hasConsent(category: CategoryId): boolean {
    return this.engine.hasConsent(category);
  }

  /** Runs `fn` now if granted, else the moment it becomes granted. */
  gate(category: CategoryId, fn: () => void): () => void {
    return this.engine.gate(category, fn);
  }

  acceptAll(): ConsentState {
    return this.engine.acceptAll();
  }

  rejectAll(): ConsentState {
    return this.engine.rejectAll();
  }

  save(decision: ConsentDecision): ConsentState {
    return this.engine.save(decision);
  }

  update(patch: ConsentDecision): ConsentState {
    return this.engine.update(patch);
  }

  /** Opens the preference center. */
  openPreferences(): void {
    this.banner.open('preferences');
  }

  /** Shows the first-layer notice again. */
  showBanner(): void {
    this.banner.open('notice');
  }

  hideBanner(): void {
    this.banner.close();
  }

  /** Clears the decision and re-prompts. */
  reset(): void {
    this.engine.reset();
    this.banner.open('notice');
  }

  on(event: ConsentEventName, fn: (payload: any) => void): () => void {
    return this.engine.on(event, fn);
  }

  off(event: ConsentEventName, fn: (payload: any) => void): void {
    this.engine.off(event, fn);
  }

  get decision(): ConsentDecision {
    return this.engine.decision;
  }

  get state(): ConsentState | null {
    return this.engine.getState();
  }

  get region(): string {
    return this.engine.region;
  }

  isPending(): boolean {
    return this.engine.isPending();
  }

  getReceipts(): ConsentReceipt[] {
    return this.engine.getReceipts();
  }

  /** Re-scans the DOM for blocked tags. Useful after a SPA route change. */
  rescan(): void {
    this.blocker?.sweep();
  }

  destroy(): void {
    this.banner.destroy();
    this.blocker?.stop();
  }
}

/** Creates a manager without starting it. */
export function create(config: ConsentConfig = {}): ConsentManager {
  return new ConsentManager(config);
}

/** Creates and starts a manager in one call. */
export function init(config: ConsentConfig = {}): ConsentManager {
  return new ConsentManager(config).init();
}

/**
 * Reads config from the script tag that loaded us, so the whole thing can be
 * deployed from Launch as a single hosted file with no companion code:
 *
 *   <script src="clearconsent.min.js" data-config='{"policyVersion":2}'></script>
 */
function configFromScriptTag(): ConsentConfig | null {
  if (typeof document === 'undefined') return null;
  const script =
    (document.currentScript as HTMLScriptElement | null) ||
    document.querySelector<HTMLScriptElement>('script[data-clearconsent]');
  const raw = script?.getAttribute('data-config');
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ConsentConfig;
  } catch {
    if (typeof console !== 'undefined') {
      console.warn('[clearconsent] data-config is not valid JSON; ignoring');
    }
    return null;
  }
}

/** The singleton created by auto-init, if it ran. */
export let instance: ConsentManager | null = null;

function autoInit(): void {
  if (!isBrowser()) return;
  const w = window as ConfigWindow;
  const config = w.clearConsentConfig || configFromScriptTag();
  if (!config) return;
  if (config.autoInit === false) return;
  instance = init(config);
}

autoInit();

export default {
  create,
  init,
  ConsentManager,
  ConsentEngine,
  ConsentBanner,
  AutoBlocker,
  attachAdobe,
  get instance() {
    return instance;
  },
};
